from core import serializers
import math
import json
import logging
import os
import re
import secrets
import unicodedata
from urllib.parse import quote
from urllib.request import Request as UrlRequest, urlopen
from datetime import datetime, timedelta
from decimal import Decimal

from rest_framework import status, permissions, viewsets, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Count, Avg, F, Q
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import escape
from django.contrib.auth.hashers import check_password, make_password
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from core.models import (
    User, PassengerProfile, DriverProfile, VehicleOwner, Vehicle,
    DriverVehicleAssignment, RideCategory, Ride, SharedRide,
    SharedRideParticipant, DriverEarning, WithdrawalRequest,
    Rating, DemandObservation, AIRecommendation, Payment, Place
)
from core.campay import (
    initiate_campay_collect, check_campay_status, initiate_campay_withdraw,
    get_campay_account_balance
)
from core.serializers import (
    UserSerializer, RegisterSerializer, PassengerProfileSerializer,
    DriverProfileSerializer, VehicleSerializer, RideCategorySerializer,
    RideSerializer, SharedRideSerializer, SharedRideParticipantSerializer,
    DriverEarningSerializer, WithdrawalRequestSerializer, RatingSerializer,
    AIRecommendationSerializer, DemandObservationSerializer, DriverProposalSerializer,
    PlaceSerializer,
)
from core.permissions import IsPassenger, IsDriver, IsAdminUserRole

logger = logging.getLogger(__name__)

# Helper math: Haversine distance in kilometers
def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def driving_distance_km(lat1, lon1, lat2, lon2):
    fallback = haversine_km(lat1, lon1, lat2, lon2)
    try:
        url = (
            'https://router.project-osrm.org/route/v1/driving/'
            f'{lon1},{lat1};{lon2},{lat2}?overview=false'
        )
        request = UrlRequest(url, headers={'User-Agent': 'GRAP-Ride-App/1.0'})
        with urlopen(request, timeout=2.5) as response:
            data = json.loads(response.read().decode('utf-8'))
        meters = data.get('routes', [{}])[0].get('distance')
        if isinstance(meters, (int, float)) and meters > 0:
            return round(meters / 1000, 2)
    except Exception:
        pass
    return fallback


def calculate_fare(distance_km, category_code, hour=None, weather='CLEAR'):
    distance = max(float(distance_km), 1.0)

    try:
        cat = RideCategory.objects.get(code=category_code)
        base_fare = float(cat.base_fare)
    except RideCategory.DoesNotExist:
        base_fare = 500.0

    raw_fare = base_fare + distance * 110

    current_hour = int(hour) if hour is not None else timezone.now().hour
    time_multiplier = 1.0
    if current_hour >= 21 or current_hour < 6:
        time_multiplier = 1.35
    elif (7 <= current_hour <= 9) or (17 <= current_hour <= 19):
        time_multiplier = 1.20

    weather_multiplier = 1.0
    w_upper = str(weather).upper()
    if 'HEAVY' in w_upper or 'THUNDER' in w_upper or w_upper == 'HEAVY_RAIN':
        weather_multiplier = 1.40
    elif 'RAIN' in w_upper or 'DRIZZLE' in w_upper or w_upper == 'RAIN':
        weather_multiplier = 1.20

    total_fare = raw_fare * time_multiplier * weather_multiplier
    return round(max(total_fare, base_fare) / 50) * 50


# Custom JWT Login Serializer & View
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        identifier = attrs.get(self.username_field, '').strip()
        if '@' in identifier:
            matching_user = User.objects.filter(email__iexact=identifier).first()
            if matching_user:
                attrs[self.username_field] = matching_user.get_username()
        data = super().validate(attrs)
        if self.user.is_suspended:
            raise serializers.ValidationError("Account is suspended. Please contact support.")
        # Auto-elevate Django superusers/staff to ADMIN role and persist
        effective_role = self.user.role
        if (self.user.is_superuser or self.user.is_staff) and effective_role != User.Role.ADMIN:
            self.user.role = User.Role.ADMIN
            self.user.save(update_fields=['role'])
            effective_role = User.Role.ADMIN
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': effective_role,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'is_verified': self.user.is_verified,
            'is_staff': self.user.is_staff,
            'is_superuser': self.user.is_superuser,
        }
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


# Authentication & Profile
class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            send_verification_code(user)
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def send_verification_code(user):
    code = f'{secrets.randbelow(1000000):06d}'
    user.verification_code_hash = make_password(code)
    user.verification_code_expires_at = timezone.now() + timedelta(minutes=10)
    user.save(update_fields=['verification_code_hash', 'verification_code_expires_at'])
    if user.email:
                recipient_name = escape(user.first_name or user.username)
                text_message = (
                        f'Hello {user.first_name or user.username},\n\n'
                        'Welcome to GRAP. Your verification code is:\n\n'
                        f'{code}\n\n'
                        'This code expires in 10 minutes. If you did not create this account, you can ignore this email.\n\n'
                        'The GRAP team'
                )
                html_message = f'''
                <!doctype html>
                <html lang="en">
                    <body style="margin:0;background:#f3f7f5;color:#10231f;font-family:Arial,Helvetica,sans-serif;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7f5;padding:32px 12px;">
                            <tr><td align="center">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dce9e2;border-radius:18px;overflow:hidden;">
                                    <tr><td style="background:#0f8a5f;padding:26px 32px;">
                                        <div style="font-size:24px;font-weight:800;letter-spacing:3px;color:#ffffff;">GRAP</div>
                                        <div style="font-size:13px;color:#dff7eb;margin-top:5px;">Move with confidence</div>
                                    </td></tr>
                                    <tr><td style="padding:34px 32px 30px;">
                                        <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;color:#0f8a5f;">VERIFY YOUR ACCOUNT</div>
                                        <h1 style="font-size:25px;line-height:1.25;margin:10px 0 12px;color:#10231f;">Welcome to GRAP, {recipient_name}</h1>
                                        <p style="font-size:15px;line-height:1.6;margin:0;color:#60736b;">Use the verification PIN below to confirm your email address and keep your account secure.</p>
                                        <div style="margin:26px 0;padding:20px;text-align:center;background:#edf8f2;border:1px solid #b9dfca;border-radius:14px;">
                                            <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#5e786b;margin-bottom:9px;">YOUR VERIFICATION PIN</div>
                                            <div style="font-size:34px;line-height:1;font-weight:800;letter-spacing:9px;color:#086344;">{code}</div>
                                        </div>
                                        <p style="font-size:13px;line-height:1.6;margin:0;color:#60736b;">This PIN expires in <strong style="color:#10231f;">10 minutes</strong>. Never share it with anyone.</p>
                                        <div style="height:1px;background:#e6eee9;margin:26px 0 18px;"></div>
                                        <p style="font-size:12px;line-height:1.6;margin:0;color:#82938c;">If you did not create a GRAP account, you can safely ignore this message.</p>
                                    </td></tr>
                                    <tr><td style="padding:18px 32px;background:#f8fbf9;color:#82938c;font-size:11px;line-height:1.5;">GRAP · Yaoundé, Cameroon<br>This is an automated message. Please do not reply.</td></tr>
                                </table>
                            </td></tr>
                        </table>
                    </body>
                </html>
                '''
                email = EmailMultiAlternatives(
                        subject='Your GRAP verification PIN',
                        body=text_message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        to=[user.email],
                )
                email.attach_alternative(html_message, 'text/html')
                email.send(fail_silently=True)


class RequestEmailVerificationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.is_verified:
            return Response({'message': 'Account is already verified.'})
        send_verification_code(request.user)
        return Response({'message': 'A verification code was sent to your email address.'})


class VerifyEmailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = ''.join(character for character in str(request.data.get('code', '')) if character.isdigit())
        user = request.user
        if not user.verification_code_hash or not user.verification_code_expires_at:
            return Response({'error': 'Request a verification code first.'}, status=status.HTTP_400_BAD_REQUEST)
        if timezone.now() > user.verification_code_expires_at:
            return Response({'error': 'This code has expired. Request a new one.'}, status=status.HTTP_410_GONE)
        if not check_password(code, user.verification_code_hash):
            return Response({'error': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_verified = True
        user.verification_code_hash = ''
        user.verification_code_expires_at = None
        user.save(update_fields=['is_verified', 'verification_code_hash', 'verification_code_expires_at'])
        return Response({'message': 'Account verified successfully.', 'user': UserSerializer(user).data})


class GroqPlaceRecommendationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        query = str(request.data.get('query', '')).strip()[:500]
        if not query:
            return Response({'error': 'Ask a recommendation question first.'}, status=status.HTTP_400_BAD_REQUEST)

        places = [
            {
                'id': place.id,
                'name': place.name,
                'zone': place.zone,
                'category': place.category,
                'category_code': place.category_code,
                'description': place.description,
                'highlights': place.highlights,
                'keywords': place.search_keywords,
            }
            for place in Place.objects.filter(is_active=True)
        ]

        ranked_places = self.rank_places(query, places)
        recommendations = ranked_places[:3]
        if not recommendations:
            answer = self.local_recommendation(query, [])
            return Response({
                'answer': answer,
                'source': 'catalogue-fallback',
                'recommended_place_ids': [],
            })

        gemini_api_key = os.getenv('GEMINI_API_KEY', '').strip()
        groq_api_key = os.getenv('GROQ_API_KEY', '').strip()
        place_context = json.dumps(recommendations, ensure_ascii=False)
        system_prompt = (
            "You are GRAP's Yaoundé place concierge. Help the user choose from the provided place catalogue below. "
            "Understand their intent and preferences (activity, neighbourhood, atmosphere, and who they are travelling with) "
            "and explain briefly why the best matching place fits. Answer in the same language as the user's question.\n"
            "Grounding rules: recommend only places in the supplied catalogue; use exact names and zones; do not invent "
            "businesses, addresses, opening hours, prices, reviews, travel times, facilities, events, or safety claims. "
            "Do not claim a place is open or that an event is happening. If the catalogue does not establish a requested "
            "detail, say it is not available and suggest checking with the venue. If multiple options match, compare at "
            "most three using only their descriptions and highlights. Keep the answer concise and useful.\n\n"
            f"Matching catalogue entries (JSON): {place_context}"
        )
        prompt_text = f"{system_prompt}\n\nUser request: {query}"

        # 1. Try Gemini API first if configured
        if gemini_api_key:
            try:
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={gemini_api_key}"
                payload = json.dumps({
                    'contents': [{'parts': [{'text': prompt_text}]}],
                    'generationConfig': {
                        'temperature': 0.3,
                        'maxOutputTokens': 1024,
                    }
                }).encode('utf-8')
                gemini_req = UrlRequest(
                    gemini_url,
                    data=payload,
                    headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GRAP-Backend/1.0'},
                    method='POST'
                )
                with urlopen(gemini_req, timeout=25) as response:
                    data = json.loads(response.read().decode('utf-8'))
                answer = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '').strip()
                if answer:
                    return Response({
                        'answer': answer,
                        'source': 'gemini-3.6-flash',
                        'recommended_place_ids': [place['id'] for place in recommendations],
                    })
            except Exception as error:
                logger.warning('Gemini place recommendation failed: %s', error)

        if groq_api_key:
            try:
                groq_payload = json.dumps({
                    'model': 'llama-3.3-70b-versatile',
                    'messages': [
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': query},
                    ],
                    'temperature': 0.3,
                    'max_tokens': 900,
                }).encode('utf-8')
                groq_request = UrlRequest(
                    'https://api.groq.com/openai/v1/chat/completions',
                    data=groq_payload,
                    headers={
                        'Authorization': f'Bearer {groq_api_key}',
                        'Content-Type': 'application/json',
                        'User-Agent': 'GRAP-Backend/1.0',
                    },
                    method='POST',
                )
                with urlopen(groq_request, timeout=25) as response:
                    data = json.loads(response.read().decode('utf-8'))
                answer = data.get('choices', [{}])[0].get('message', {}).get('content', '').strip()
                if answer:
                    return Response({
                        'answer': answer,
                        'source': 'groq-llama-3.3-70b-versatile',
                        'recommended_place_ids': [place['id'] for place in recommendations],
                    })
            except Exception as error:
                logger.warning('Groq place recommendation failed: %s', error)

        return Response({
            'answer': self.local_recommendation(query, recommendations),
            'source': 'catalogue-fallback',
            'recommended_place_ids': [place['id'] for place in recommendations],
        })

    @staticmethod
    def normalize_text(value):
        normalized = unicodedata.normalize('NFKD', str(value)).encode('ascii', 'ignore').decode('ascii')
        return re.sub(r'[^a-z0-9]+', ' ', normalized.lower()).strip()

    @classmethod
    def rank_places(cls, query, places):
        normalized_query = cls.normalize_text(query)
        raw_query_tokens = set(normalized_query.split())
        query_tokens = set(raw_query_tokens)
        stop_words = {
            'a', 'an', 'and', 'are', 'at', 'for', 'in', 'is', 'me', 'near', 'of', 'on',
            'or', 'please', 'the', 'to', 'with', 'yaounde', 'de', 'des', 'du', 'la',
            'le', 'les', 'un', 'une', 'et', 'dans', 'pour', 'pres', 'proche', 'je',
            'cherche', 'veux', 'voudrais', 'moi', 'what', 'where', 'should', 'want',
            'can', 'we', 'do', 'best', 'recommend', 'recommendation', 'suggest',
            'something', 'place', 'places', 'tell', 'me', 'about', 'que', 'faire',
        }
        query_tokens -= stop_words
        category_intents = {
            'DINING': {'restaurant', 'food', 'meal', 'dining', 'eat', 'dinner', 'lunch', 'cuisine', 'repas', 'manger', 'restaurant'},
            'PARKS': {'park', 'nature', 'garden', 'zoo', 'animals', 'botanical', 'lake', 'outdoors', 'quiet', 'relax', 'family', 'children', 'child', 'enfant', 'calme', 'nature', 'jardin', 'lac', 'walk', 'walking', 'promenade', 'randonnee', 'hiking'},
            'CULTURE': {'culture', 'museum', 'history', 'historic', 'monument', 'heritage', 'museum', 'histoire', 'culture', 'musee', 'monument'},
            'SHOPPING': {'market', 'shopping', 'shop', 'buy', 'marché', 'marche', 'acheter', 'magasin'},
            'SPORTS': {'football', 'soccer', 'match', 'stadium', 'sports', 'game', 'event', 'sport', 'stade', 'football', 'match'},
        }
        intent_codes = {
            code for code, terms in category_intents.items()
            if query_tokens.intersection(cls.normalize_text(' '.join(terms)).split())
        }
        general_visit_intent = bool(raw_query_tokens.intersection({
            'visit', 'visiting', 'visiter', 'tourist', 'tourism', 'explore',
            'exploring', 'outing', 'sortie', 'sortir', 'weekend',
        }))
        known_zones = {
            'awae', 'messamendongo', 'odza', 'mvan', 'nsam', 'ahala', 'simbock',
            'bastos', 'mont febe', 'omnisports', 'melen', 'tsinga', 'essos',
            'ekounou', 'kondengui', 'mokolo', 'biyem assi', 'etoudi',
            'elig essono', 'nkolbisson', 'nsimalen', 'warda', 'mfandena',
            'centre administratif', 'centre ville', 'carrefour warda',
        }
        known_zones.update(cls.normalize_text(place.get('zone', '')) for place in places)
        requested_zones = [zone for zone in known_zones if zone and zone in normalized_query]
        if requested_zones:
            places = [
                place for place in places
                if any(zone in cls.normalize_text(place.get('zone', '')) for zone in requested_zones)
            ]

        scored = []
        for place in places:
            name = cls.normalize_text(place.get('name', ''))
            zone = cls.normalize_text(place.get('zone', ''))
            category = cls.normalize_text(place.get('category', ''))
            keywords = cls.normalize_text(' '.join(place.get('keywords', []))).split()
            description_tokens = set(cls.normalize_text(
                f"{place.get('description', '')} {' '.join(place.get('highlights', []))}"
            ).split())
            score = 0

            if name and name in normalized_query:
                score += 12
            if zone and zone in normalized_query:
                score += 7
            if place.get('category_code') in intent_codes:
                score += 6
            elif general_visit_intent and place.get('category_code') in {'CULTURE', 'PARKS', 'SPORTS'}:
                score += 3
            score += 3 * len(query_tokens.intersection(set(keywords)))
            score += len(query_tokens.intersection(set(name.split())))
            score += len(query_tokens.intersection(set(category.split())))
            score += len(query_tokens.intersection(description_tokens))

            if score:
                scored.append((score, place))

        scored.sort(key=lambda item: (-item[0], item[1]['name'].casefold()))
        return [place for _, place in scored]

    @staticmethod
    def local_recommendation(query, places):
        if not places:
            return (
                'Je ne trouve pas encore de lieu répertorié correspondant à cette demande dans notre guide de Yaoundé. '
                'Essayez un quartier ou une catégorie comme nature, histoire, marché, restaurant ou sport.'
                if any(word in GroqPlaceRecommendationView.normalize_text(query).split() for word in ('je', 'cherche', 'veux', 'ou', 'pres', 'marche'))
                else 'I could not find a listed match in the Yaoundé guide yet. Try a neighbourhood or a category such as nature, history, markets, food, or sports.'
            )
        matches = '; '.join(
            f"{place['name']} ({place['zone']}) — {place['description']}"
            for place in places[:3]
        )
        return f"Based on your preferences, these places in the Yaoundé guide are the closest matches: {matches} Check current access details before travelling."


class PlaceListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PlaceSerializer
    queryset = Place.objects.filter(is_active=True)


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        # Auto-elevate Django superusers/staff to ADMIN role and persist it
        if (user.is_superuser or user.is_staff) and user.role != User.Role.ADMIN:
            user.role = User.Role.ADMIN
            user.save(update_fields=['role'])

        serializer = UserSerializer(user)
        profile_data = {}
        if user.role == User.Role.PASSENGER:
            if hasattr(user, 'passenger_profile'):
                profile_data = PassengerProfileSerializer(user.passenger_profile).data
        elif user.role == User.Role.DRIVER:
            if hasattr(user, 'driver_profile'):
                profile_data = DriverProfileSerializer(user.driver_profile).data

        user_data = serializer.data
        # Ensure is_staff and is_superuser are exposed to the frontend
        user_data = dict(user_data)
        user_data['is_staff'] = user.is_staff
        user_data['is_superuser'] = user.is_superuser

        return Response({
            'user': user_data,
            'profile': profile_data
        })

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Categories List
class RideCategoryListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        categories = RideCategory.objects.all()
        return Response(RideCategorySerializer(categories, many=True).data)


# Passenger Fare Estimation & Ride Request
class EstimateFareView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        pickup_lat = float(request.data.get('pickup_lat', 3.8480))
        pickup_lng = float(request.data.get('pickup_lng', 11.5021))
        dest_lat = float(request.data.get('destination_lat', 3.8600))
        dest_lng = float(request.data.get('destination_lng', 11.5150))
        category_id = request.data.get('category_id')
        weather_cond = request.data.get('weather', 'CLEAR')
        hour_override = request.data.get('hour')

        dist_km = driving_distance_km(pickup_lat, pickup_lng, dest_lat, dest_lng)

        try:
            cat = RideCategory.objects.get(id=category_id)
        except RideCategory.DoesNotExist:
            cat = RideCategory.objects.first()

        current_hour = int(hour_override) if hour_override is not None else timezone.now().hour
        solo_fare = calculate_fare(dist_km, cat.code, hour=current_hour, weather=weather_cond)

        surge_badges = []
        if current_hour >= 21 or current_hour < 6:
            surge_badges.append('🌙 Night Shift (+35%)')
        elif (7 <= current_hour <= 9) or (17 <= current_hour <= 19):
            surge_badges.append('⚡ Rush Hour (+20%)')

        w_upper = str(weather_cond).upper()
        if 'HEAVY' in w_upper or 'THUNDER' in w_upper or w_upper == 'HEAVY_RAIN':
            surge_badges.append('🌧️ Heavy Rain Surge (+40%)')
        elif 'RAIN' in w_upper or 'DRIZZLE' in w_upper or w_upper == 'RAIN':
            surge_badges.append('🌦️ Rain Surge (+20%)')

        # Record demand observation for real search analytics
        pickup_name = request.data.get('pickup_name', '')
        dest_name = request.data.get('destination_name', '')
        hour = timezone.now().hour
        day = timezone.now().weekday()
        if pickup_name:
            DemandObservation.objects.create(
                zone_name=str(pickup_name)[:50],
                latitude=pickup_lat,
                longitude=pickup_lng,
                hour_of_day=hour,
                day_of_week=day,
                request_count=1
            )
        if dest_name:
            DemandObservation.objects.create(
                zone_name=str(dest_name)[:50],
                latitude=dest_lat,
                longitude=dest_lng,
                hour_of_day=hour,
                day_of_week=day,
                request_count=1
            )

        return Response({
            'distance_km': dist_km,
            'estimated_solo_fare': solo_fare,
            'category': RideCategorySerializer(cat).data,
            'surge_badges': surge_badges,
            'hour': current_hour,
            'weather': weather_cond
        })


class RequestRideView(APIView):
    permission_classes = [IsPassenger]

    def post(self, request):
        data = request.data
        category_id = data.get('category_id')
        pickup_name = data.get('pickup_name', 'Current Location')
        pickup_lat = float(data.get('pickup_lat', 3.8480))
        pickup_lng = float(data.get('pickup_lng', 11.5021))
        dest_name = data.get('destination_name', 'Destination')
        dest_lat = float(data.get('destination_lat', 3.8600))
        dest_lng = float(data.get('destination_lng', 11.5150))

        dist_km = driving_distance_km(pickup_lat, pickup_lng, dest_lat, dest_lng)

        category = RideCategory.objects.get(id=category_id)
        est_fare = calculate_fare(dist_km, category.code)

        # In production: driver is unassigned when a ride is requested.
        # Available online drivers will receive the request in their feed to accept.
        driver_id = data.get('driver_id')
        driver_obj = None
        if driver_id:
            driver_obj = User.objects.filter(id=driver_id, role=User.Role.DRIVER).first()

        ride = Ride.objects.create(
            passenger=request.user,
            driver=driver_obj,
            category=category,
            pickup_name=pickup_name,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            destination_name=dest_name,
            destination_lat=dest_lat,
            destination_lng=dest_lng,
            distance_km=dist_km,
            estimated_fare=Decimal(str(est_fare)),
            status=Ride.Status.REQUESTED
        )

        # Record demand observation for analytics
        hour = timezone.now().hour
        day = timezone.now().weekday()
        DemandObservation.objects.create(
            zone_name=pickup_name[:50],
            latitude=pickup_lat,
            longitude=pickup_lng,
            hour_of_day=hour,
            day_of_week=day,
            request_count=1
        )

        return Response(RideSerializer(ride, context={'request': request}).data, status=status.HTTP_201_CREATED)


class PassengerMyRidesView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RideSerializer

    def get_queryset(self):
        return Ride.objects.filter(passenger=self.request.user).exclude(status__startswith='CANCELLED').order_by('-created_at')


class CancelRideView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, ride_id):
        try:
            ride = Ride.objects.get(id=ride_id, passenger=request.user)
            ride.status = Ride.Status.CANCELLED_BY_PASSENGER
            ride.save()
            if hasattr(ride, 'shared_ride_group'):
                s_group = ride.shared_ride_group
                s_group.status = SharedRide.SharedStatus.COMPLETED
                s_group.available_seats = 0
                s_group.save()
            
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'ride_{ride_id}',
                {
                    'type': 'ride_cancelled',
                    'ride_id': ride_id,
                }
            )
            
            return Response({'message': 'Ride cancelled successfully', 'status': 'CANCELLED'})
        except Ride.DoesNotExist:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)


def calculate_bearing(lat1, lon1, lat2, lon2):
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    y = math.sin(dlon) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dlon)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360) % 360


# Voluntary Dynamic Ride-Sharing Logic
class SearchSharedRidesView(APIView):
    permission_classes = [IsPassenger]

    def post(self, request):
        """
        Search existing rides that were voluntarily made shareable.
        Applies route proximity, direction alignment, capacity check, and proportional shared-fare calculation.
        Formula: Fare_A = SharedTotal * (SoloDist_A / (SoloDist_A + SoloDist_B))
        """
        pickup_lat = float(request.data.get('pickup_lat', 3.8480))
        pickup_lng = float(request.data.get('pickup_lng', 11.5021))
        dest_lat = float(request.data.get('destination_lat', 3.8600))
        dest_lng = float(request.data.get('destination_lng', 11.5150))
        
        # Use OSRM driving distance for the new passenger (same as primary ride uses)
        solo_dist = driving_distance_km(pickup_lat, pickup_lng, dest_lat, dest_lng)
        if solo_dist < 1.0:
            solo_dist = 1.0

        passenger_dest_bearing = calculate_bearing(pickup_lat, pickup_lng, dest_lat, dest_lng)

        # Ensure any active shareable ride has a SharedRide group
        active_shareable_rides = Ride.objects.filter(
            is_shareable=True,
            status__in=[
                Ride.Status.REQUESTED,
                Ride.Status.MATCHING,
                Ride.Status.ACCEPTED,
                Ride.Status.DRIVER_ARRIVING,
                Ride.Status.DRIVER_AT_PICKUP,
                Ride.Status.IN_PROGRESS,
            ]
        ).exclude(status__startswith='CANCELLED')
        
        for r in active_shareable_rides:
            SharedRide.objects.get_or_create(
                primary_ride=r,
                defaults={'capacity': 4, 'available_seats': 3, 'status': SharedRide.SharedStatus.SHAREABLE}
            )

        available_groups = SharedRide.objects.filter(
            status__in=[SharedRide.SharedStatus.SHAREABLE, SharedRide.SharedStatus.SEARCHING],
            available_seats__gt=0,
            primary_ride__status__in=[
                Ride.Status.REQUESTED,
                Ride.Status.MATCHING,
                Ride.Status.ACCEPTED,
                Ride.Status.DRIVER_ARRIVING,
                Ride.Status.DRIVER_AT_PICKUP,
                Ride.Status.IN_PROGRESS,
            ]
        ).exclude(primary_ride__status__startswith='CANCELLED').select_related('primary_ride', 'primary_ride__passenger', 'primary_ride__category', 'primary_ride__driver')

        results = []
        for s_ride in available_groups:
            p_ride = s_ride.primary_ride
            dist_to_pickup = haversine_km(pickup_lat, pickup_lng, p_ride.pickup_lat, p_ride.pickup_lng)
            if dist_to_pickup > 15.0:
                continue

            primary_bearing = calculate_bearing(p_ride.pickup_lat, p_ride.pickup_lng, p_ride.destination_lat, p_ride.destination_lng)
            bearing_diff = abs(primary_bearing - passenger_dest_bearing)
            if bearing_diff > 180:
                bearing_diff = 360 - bearing_diff
            if bearing_diff > 90 and dist_to_pickup > 3.0:
                continue

            dist_to_destination = haversine_km(dest_lat, dest_lng, p_ride.destination_lat, p_ride.destination_lng)
            if dist_to_destination > 15.0:
                continue

            primary_solo_dist = float(p_ride.distance_km or 1.0)

            total_fare_val = float(p_ride.estimated_fare)
            total_dist = primary_solo_dist + solo_dist
            passenger_share_fare = round((solo_dist / total_dist) * total_fare_val)
            primary_share_fare   = round((primary_solo_dist / total_dist) * total_fare_val)
            driver_name = None
            driver_username = None
            driver_rating = None
            driver_total_rides = None
            vehicle = None

            if p_ride.driver:
                full = p_ride.driver.get_full_name().strip()
                driver_name = full if full else p_ride.driver.username
                driver_username = p_ride.driver.username
                if hasattr(p_ride.driver, 'driver_profile'):
                    dp = p_ride.driver.driver_profile
                    driver_rating = round(float(dp.rating_avg), 1)
                    driver_total_rides = dp.total_rides
                    active_assign = dp.assignments.filter(is_active=True).select_related('vehicle').first()
                    if active_assign:
                        vehicle = active_assign.vehicle

            # Category info (always available)
            cat = p_ride.category

            # Color hex — only from real vehicle, otherwise None
            car_color_hex = None
            if vehicle and vehicle.color:
                color_map = {'black': '#212121', 'white': '#FFFFFF', 'silver': '#9E9E9E',
                             'grey': '#757575', 'gray': '#757575', 'red': '#E53935',
                             'blue': '#1E88E5', 'yellow': '#FDD835', 'green': '#43A047',
                             'orange': '#FB8C00', 'brown': '#6D4C41', 'beige': '#D7CCC8'}
                car_color_hex = color_map.get(vehicle.color.lower(), '#90A4AE')

            # Savings vs what the joiner would pay solo
            cat_code = cat.code if cat else 'ECONOMY'
            joiner_solo_fare = calculate_fare(solo_dist, cat_code)
            savings_pct = round((1 - passenger_share_fare / joiner_solo_fare) * 100, 1) if joiner_solo_fare > 0 else 0.0
            savings_pct = max(savings_pct, 0.0)

            results.append({
                'shared_ride_id': s_ride.id,
                'primary_ride_id': p_ride.id,
                'pickup_name': p_ride.pickup_name,
                'destination_name': p_ride.destination_name,
                'available_seats': s_ride.available_seats,
                'total_capacity': s_ride.capacity,
                'occupied_seats': s_ride.capacity - s_ride.available_seats,
                # Vehicle (null if no driver assigned yet)
                'car_color': vehicle.color if vehicle else None,
                'car_color_hex': car_color_hex,
                'car_make': vehicle.make if vehicle else None,
                'car_model': vehicle.model if vehicle else None,
                'car_year': vehicle.year if vehicle else None,
                'license_plate': vehicle.license_plate if vehicle else None,
                # Category shown when no vehicle
                'category_name': cat.name if cat else 'Economy',
                'category_code': cat.code if cat else 'ECONOMY',
                # Driver (null if no driver assigned yet)
                'driver_name': driver_name,
                'driver_username': driver_username,
                'driver_rating': driver_rating,
                'driver_total_rides': driver_total_rides,
                # Initiator info (always available)
                'initiator_username': p_ride.passenger.username,
                'initiator_name': p_ride.passenger.get_full_name().strip() or p_ride.passenger.username,
                'initiator_profile_picture_url': getattr(p_ride.passenger, 'profile_picture_url', '') or '',
                'initiator_phone': getattr(p_ride.passenger, 'phone_number', '') or '',
                # Distance & fare (all correctly computed)
                'primary_solo_dist_km': round(primary_solo_dist, 2),
                'solo_distance_km': round(solo_dist, 2),
                'total_route_km': round(total_dist, 2),
                'total_shared_fare': round(total_fare_val),   # = estimated_fare of primary ride
                'primary_share_fare': primary_share_fare,     # initiator's proportional share
                'passenger_solo_cost': joiner_solo_fare,      # what joiner would pay alone
                'normal_solo_fare': round(float(p_ride.estimated_fare)),
                'proportional_shared_fare': passenger_share_fare,  # joiner's share
                'savings_percentage': savings_pct,
                'is_own_ride': bool(p_ride.passenger_id == request.user.id),
            })



        return Response({
            'count': len(results),
            'shareable_rides': results
        })


class JoinSharedRideView(APIView):
    permission_classes = [IsPassenger]

    def post(self, request):
        shared_ride_id = request.data.get('shared_ride_id')
        pickup_name = request.data.get('pickup_name', 'Passenger Pickup')
        pickup_lat = float(request.data.get('pickup_lat', 3.8480))
        pickup_lng = float(request.data.get('pickup_lng', 11.5021))
        dest_name = request.data.get('destination_name', 'Passenger Destination')
        dest_lat = float(request.data.get('destination_lat', 3.8600))
        dest_lng = float(request.data.get('destination_lng', 11.5150))
        allocated_fare = Decimal(str(request.data.get('allocated_shared_fare', '1000.00')))

        try:
            s_ride = SharedRide.objects.select_for_update().get(id=shared_ride_id)
        except SharedRide.DoesNotExist:
            return Response({'error': 'Shared ride group not found.'}, status=status.HTTP_404_NOT_FOUND)

        p_ride = s_ride.primary_ride

        # Use OSRM driving distance (same quality as primary ride)
        solo_dist = driving_distance_km(pickup_lat, pickup_lng, dest_lat, dest_lng)
        if solo_dist < 0.5:
            solo_dist = 0.5

        p_ride_dist = float(p_ride.distance_km or solo_dist)
        total_fare_val = float(p_ride.estimated_fare)
        total_dist = p_ride_dist + solo_dist
        computed_fare = round((solo_dist / total_dist) * total_fare_val)
        primary_fare  = round((p_ride_dist / total_dist) * total_fare_val)

        # If user is the initiator, return their ride details smoothly
        if p_ride.passenger_id == request.user.id:
            return Response({
                'message': 'You are the initiator of this ride.',
                'is_initiator': True,
                'participant_id': None,
                'allocated_fare': float(p_ride.estimated_fare),
                'primary_passenger_fare': float(p_ride.estimated_fare),
                'total_shared_fare': round(total_fare_val),
                'remaining_seats': s_ride.available_seats,
                'initiator_name': p_ride.passenger.get_full_name().strip() or p_ride.passenger.username,
                'initiator_username': p_ride.passenger.username,
                'initiator_profile_picture_url': getattr(p_ride.passenger, 'profile_picture_url', '') or '',
                'initiator_phone': getattr(p_ride.passenger, 'phone_number', '') or '',
            }, status=status.HTTP_200_OK)

        # If user already joined, return existing participant smoothly
        existing = SharedRideParticipant.objects.filter(shared_ride=s_ride, passenger=request.user).first()
        if existing:
            return Response({
                'message': 'You have already joined this shared ride.',
                'participant_id': existing.id,
                'allocated_fare': float(existing.allocated_shared_fare),
                'primary_passenger_fare': primary_fare,
                'total_shared_fare': round(total_fare_val),
                'joiner_distance_km': round(solo_dist, 2),
                'primary_distance_km': round(p_ride_dist, 2),
                'remaining_seats': s_ride.available_seats,
                'initiator_name': p_ride.passenger.get_full_name().strip() or p_ride.passenger.username,
                'initiator_username': p_ride.passenger.username,
                'initiator_profile_picture_url': getattr(p_ride.passenger, 'profile_picture_url', '') or '',
                'initiator_phone': getattr(p_ride.passenger, 'phone_number', '') or '',
            }, status=status.HTTP_200_OK)

        if s_ride.available_seats <= 0 or s_ride.status == SharedRide.SharedStatus.FULL:
            return Response({'error': 'No available seats on this shared ride.'}, status=status.HTTP_400_BAD_REQUEST)

        # ─── CORRECT FORMULA ───────────────────────────────────────────────────
        # total_fare = primary ride's estimated_fare (fixed, e.g. 1500 FCFA)
        # joiner_fare  = joiner_dist  / (primary_dist + joiner_dist) * total_fare
        # primary_fare = primary_dist / (primary_dist + joiner_dist) * total_fare
        # ───────────────────────────────────────────────────────────────────────
        total_fare_val = float(p_ride.estimated_fare)
        total_dist = p_ride_dist + solo_dist
        computed_fare = round((solo_dist / total_dist) * total_fare_val)
        primary_fare  = round((p_ride_dist / total_dist) * total_fare_val)

        # Server-side computed fare — client value ignored to prevent tampering
        final_allocated = Decimal(str(computed_fare))

        participant = SharedRideParticipant.objects.create(
            shared_ride=s_ride,
            passenger=request.user,
            pickup_name=pickup_name,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            destination_name=dest_name,
            destination_lat=dest_lat,
            destination_lng=dest_lng,
            solo_distance_km=solo_dist,
            solo_calculated_fare=final_allocated * Decimal('1.25'),
            allocated_shared_fare=final_allocated
        )

        s_ride.available_seats -= 1
        if s_ride.available_seats <= 0:
            s_ride.status = SharedRide.SharedStatus.FULL
        s_ride.save()

        # Update primary ride shared status
        p_ride = s_ride.primary_ride
        p_ride.is_shared = True
        p_ride.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ride_{p_ride.id}',
            {
                'type': 'participant_joined',
                'participant': {
                    'id': participant.id,
                    'passenger_id': request.user.id,
                    'passenger_name': request.user.get_full_name().strip() or request.user.username,
                    'passenger_username': request.user.username,
                    'passenger_profile_picture_url': getattr(request.user, 'profile_picture_url', '') or '',
                    'passenger_phone': getattr(request.user, 'phone_number', '') or '',
                    'pickup_name': pickup_name,
                    'pickup_lat': pickup_lat,
                    'pickup_lng': pickup_lng,
                    'destination_name': dest_name,
                    'solo_distance_km': round(solo_dist, 2),
                    'allocated_shared_fare': float(allocated_fare),
                },
            }
        )

        # Recalculate the primary passenger's fare with the same formula
        # (primary_fare already computed above)

        return Response({
            'message': 'Successfully joined shared ride!',
            'participant_id': participant.id,
            'allocated_fare': float(participant.allocated_shared_fare),
            'primary_passenger_fare': primary_fare,
            'total_shared_fare': round(total_fare_val),
            'joiner_distance_km': round(solo_dist, 2),
            'primary_distance_km': round(p_ride_dist, 2),
            'remaining_seats': s_ride.available_seats,
            'initiator_name': p_ride.passenger.get_full_name().strip() or p_ride.passenger.username,
            'initiator_username': p_ride.passenger.username,
            'initiator_profile_picture_url': getattr(p_ride.passenger, 'profile_picture_url', '') or '',
            'initiator_phone': getattr(p_ride.passenger, 'phone_number', '') or '',
        }, status=status.HTTP_201_CREATED)


class SharedRideStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, shared_ride_id):
        try:
            shared = SharedRide.objects.select_related('primary_ride', 'primary_ride__passenger').prefetch_related('participants__passenger').get(id=shared_ride_id)
        except SharedRide.DoesNotExist:
            return Response({'error': 'Shared ride not found.'}, status=status.HTTP_404_NOT_FOUND)
        primary = shared.primary_ride
        if request.user != primary.passenger and request.user != primary.driver and not shared.participants.filter(passenger=request.user).exists():
            return Response({'error': 'You are not part of this shared ride.'}, status=status.HTTP_403_FORBIDDEN)
        participants = list(shared.participants.all())
        if request.user == primary.driver:
            driver_lat = getattr(primary.driver.driver_profile, 'current_latitude', primary.pickup_lat) if primary.driver and hasattr(primary.driver, 'driver_profile') else primary.pickup_lat
            driver_lng = getattr(primary.driver.driver_profile, 'current_longitude', primary.pickup_lng) if primary.driver and hasattr(primary.driver, 'driver_profile') else primary.pickup_lng
            participants.sort(key=lambda item: haversine_km(driver_lat, driver_lng, item.pickup_lat, item.pickup_lng))
        return Response({
            'shared_ride_id': shared.id,
            'status': shared.status,
            'primary_ride': RideSerializer(primary).data,
            'initiator': {
                'username': primary.passenger.username,
                'name': primary.passenger.get_full_name().strip() or primary.passenger.username,
                'phone': primary.passenger.phone_number,
                'profile_picture_url': getattr(primary.passenger, 'profile_picture_url', '') or '',
            },
            'participants': [
                {**SharedRideParticipantSerializer(item).data, 'pickup_order': index + 1}
                for index, item in enumerate(participants)
            ],
            'payment_summary': [
                {'username': primary.passenger.username, 'fare': primary.estimated_fare, 'payment_status': primary.payment_status},
                *[{'username': item.passenger.username, 'fare': item.allocated_shared_fare, 'payment_status': item.payment_status} for item in participants],
            ],
        })


class MySharedRidesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        joined = SharedRideParticipant.objects.filter(passenger=request.user).select_related('shared_ride__primary_ride')
        initiated = SharedRide.objects.filter(primary_ride__passenger=request.user).select_related('primary_ride').prefetch_related('participants__passenger')
        return Response({
            'joined': SharedRideParticipantSerializer(joined, many=True).data,
            'initiated': [
                {
                    'shared_ride_id': item.id,
                    'primary_ride': RideSerializer(item.primary_ride).data,
                    'participants': SharedRideParticipantSerializer(item.participants.all(), many=True).data,
                    'status': item.status,
                }
                for item in initiated
            ],
        })


class ConfirmSharedPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, participant_id):
        try:
            participant = SharedRideParticipant.objects.get(id=participant_id, passenger=request.user)
        except SharedRideParticipant.DoesNotExist:
            return Response({'error': 'Shared passenger record not found.'}, status=status.HTTP_404_NOT_FOUND)

        participant.payment_status = Ride.PaymentStatus.CONFIRMED
        participant.save(update_fields=['payment_status'])

        ride = participant.shared_ride.primary_ride
        primary_id = ride.id

        # Create a Payment record per participant so accounting is correct
        Payment.objects.update_or_create(
            ride=ride,
            participant=participant,
            defaults={
                'amount': participant.allocated_shared_fare,
                'method': Payment.Method.CASH,
                'status': Payment.Status.SUCCESSFUL,
                'paid_at': timezone.now(),
            }
        )

        # Create a driver earning for this participant's fare
        if ride.driver and hasattr(ride.driver, 'driver_profile'):
            gross = float(participant.allocated_shared_fare)
            comm_rate = 15.0
            comm_amount = round(gross * (comm_rate / 100.0), 2)
            net_earning = round(gross - comm_amount, 2)
            DriverEarning.objects.get_or_create(
                driver=ride.driver,
                ride=ride,
                source_participant=participant,
                defaults={
                    'gross_fare': Decimal(str(gross)),
                    'commission_rate': comm_rate,
                    'commission_amount': Decimal(str(comm_amount)),
                    'net_earning': Decimal(str(net_earning))
                }
            )
            dp = ride.driver.driver_profile
            dp.total_rides = DriverEarning.objects.filter(driver=ride.driver).values('ride').distinct().count()
            dp.save(update_fields=['total_rides'])

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ride_{primary_id}',
            {
                'type': 'ride_completed',
                'data': {
                    'ride_id': primary_id,
                    'participant_id': participant.id,
                    'status': 'COMPLETED',
                    'passenger': participant.passenger.username,
                    'payment_status': 'CONFIRMED'
                }
            }
        )

        return Response({'message': 'Shared ride payment confirmed.', 'fare': participant.allocated_shared_fare})


class MakeRideShareableView(APIView):
    permission_classes = [IsPassenger]

    def post(self, request):
        ride_id = request.data.get('ride_id')
        try:
            ride = Ride.objects.get(id=ride_id, passenger=request.user)
        except Ride.DoesNotExist:
            return Response({'error': 'Ride not found.'}, status=status.HTTP_404_NOT_FOUND)

        ride.is_shareable = True
        ride.save()

        s_ride, created = SharedRide.objects.get_or_create(
            primary_ride=ride,
            defaults={'capacity': 4, 'available_seats': 3, 'status': SharedRide.SharedStatus.SHAREABLE}
        )

        return Response({
            'message': 'Your ride is now shareable! Other compatible passengers can join.',
            'shared_ride_id': s_ride.id,
            'is_shareable': ride.is_shareable
        })


def get_driver_wallet_balances(driver):
    earnings = DriverEarning.objects.filter(driver=driver)
    matching_payment = (
        Q(source_participant__isnull=True, ride__payments__participant__isnull=True) |
        Q(source_participant__isnull=False, source_participant_id=F('ride__payments__participant_id'))
    )
    successful_payments = {
        'ride__payments__status': Payment.Status.SUCCESSFUL,
    }
    cash_commission = earnings.filter(
        matching_payment,
        **successful_payments,
        ride__payments__method=Payment.Method.CASH,
    ).distinct().aggregate(total=Sum('commission_amount'))['total'] or Decimal('0.00')
    platform_net = earnings.filter(
        matching_payment,
        **successful_payments,
        ride__payments__method__in=[
            Payment.Method.MOBILE_MONEY,
            Payment.Method.CARD,
            Payment.Method.WALLET,
        ],
    ).distinct().aggregate(total=Sum('net_earning'))['total'] or Decimal('0.00')
    total_withdrawn = WithdrawalRequest.objects.filter(
        driver=driver,
        status=WithdrawalRequest.WithdrawalStatus.PROCESSED,
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    unspent_platform_balance = max(Decimal('0.00'), platform_net - total_withdrawn)
    commission_due = max(Decimal('0.00'), cash_commission - unspent_platform_balance)
    available_balance = max(Decimal('0.00'), unspent_platform_balance - cash_commission)
    return {
        'platform_net': platform_net,
        'total_withdrawn': total_withdrawn,
        'cash_commission_due': commission_due,
        'available_balance': available_balance,
    }


class ConfirmCashPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ride_id = request.data.get('ride_id')
        entered_pin = request.data.get('otp_pin')

        with transaction.atomic():
            try:
                ride = Ride.objects.select_for_update().get(id=ride_id, driver=request.user)
            except (Ride.DoesNotExist, TypeError, ValueError):
                return Response({'error': 'Ride not found or not assigned to you.'}, status=status.HTTP_404_NOT_FOUND)

            if ride.status == Ride.Status.COMPLETED and ride.payment_status == Ride.PaymentStatus.CONFIRMED:
                payment = Payment.objects.filter(
                    ride=ride,
                    participant=None,
                    method=Payment.Method.CASH,
                    status=Payment.Status.SUCCESSFUL,
                ).first()
                if payment:
                    return Response({
                        'message': 'Cash payment was already confirmed.',
                        'status': ride.status,
                        'payment_status': ride.payment_status,
                        'final_fare': ride.final_fare,
                        'ride_id': ride.id,
                    })

            if ride.status != Ride.Status.ARRIVED_AT_DESTINATION:
                return Response(
                    {'error': 'Cash payment can only be confirmed after arrival at the destination.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if ride.is_shared or SharedRide.objects.filter(primary_ride=ride).exists():
                return Response(
                    {'error': 'Cash PIN confirmation is not available for shared rides. Use mobile money instead.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not entered_pin or str(entered_pin) != ride.cash_otp:
                return Response({'error': 'Invalid cash payment PIN.'}, status=status.HTTP_400_BAD_REQUEST)

            ride.payment_status = Ride.PaymentStatus.CONFIRMED
            ride.status = Ride.Status.COMPLETED
            ride.completed_at = timezone.now()
            if not ride.final_fare:
                ride.final_fare = ride.estimated_fare
            ride.save(update_fields=['payment_status', 'status', 'completed_at', 'final_fare'])

            Payment.objects.update_or_create(
                ride=ride,
                participant=None,
                defaults={
                    'amount': ride.final_fare or ride.estimated_fare,
                    'method': Payment.Method.CASH,
                    'status': Payment.Status.SUCCESSFUL,
                    'paid_at': timezone.now(),
                }
            )

            if ride.driver and hasattr(ride.driver, 'driver_profile'):
                gross = Decimal(str(ride.final_fare or ride.estimated_fare))
                commission = (gross * Decimal('0.15')).quantize(Decimal('0.01'))
                DriverEarning.objects.update_or_create(
                    driver=ride.driver,
                    ride=ride,
                    source_participant=None,
                    defaults={
                        'gross_fare': gross,
                        'commission_rate': 15.0,
                        'commission_amount': commission,
                        'net_earning': gross - commission,
                    },
                )
                profile = ride.driver.driver_profile
                profile.total_rides = DriverEarning.objects.filter(
                    driver=ride.driver,
                ).values('ride').distinct().count()
                profile.save(update_fields=['total_rides'])

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'ride_{ride.id}',
                {
                    'type': 'ride_completed',
                    'data': {
                        'ride_id': ride.id,
                        'status': ride.status,
                        'payment_status': ride.payment_status,
                    },
                },
            )

        wallet = get_driver_wallet_balances(request.user)
        return Response({
            'message': 'Cash payment confirmed and trip completed.',
            'status': ride.status,
            'payment_status': ride.payment_status,
            'final_fare': ride.final_fare,
            'ride_id': ride.id,
            'cash_commission_due': float(wallet['cash_commission_due']),
        })


class ConfirmDigitalPaymentView(APIView):
    permission_classes = [IsPassenger]

    def post(self, request):
        ride_id = request.data.get('ride_id')

        try:
            ride = Ride.objects.get(id=ride_id, passenger=request.user)
        except Ride.DoesNotExist:
            return Response({'error': 'Ride not found.'}, status=status.HTTP_404_NOT_FOUND)

        ride.payment_status = Ride.PaymentStatus.CONFIRMED
        ride.status = Ride.Status.COMPLETED
        ride.completed_at = timezone.now()
        if not ride.final_fare:
            ride.final_fare = ride.estimated_fare
        ride.save()

        Payment.objects.update_or_create(
            ride=ride,
            participant=None,
            defaults={
                'amount': ride.final_fare or ride.estimated_fare,
                'method': Payment.Method.MOBILE_MONEY,
                'status': Payment.Status.SUCCESSFUL,
                'paid_at': timezone.now(),
            }
        )

        if hasattr(ride, 'shared_ride_group'):
            s_group = ride.shared_ride_group
            s_group.status = SharedRide.SharedStatus.COMPLETED
            s_group.available_seats = 0
            s_group.save()

        if not ride.driver:
            ride.driver = User.objects.filter(username='driver1').first() or User.objects.filter(role=User.Role.DRIVER).first()
            ride.save(update_fields=['driver'])

        if ride.driver and hasattr(ride.driver, 'driver_profile'):
            gross = float(ride.final_fare or ride.estimated_fare)
            comm_rate = 15.0
            comm_amount = round(gross * (comm_rate / 100.0), 2)
            net_earning = round(gross - comm_amount, 2)
            DriverEarning.objects.get_or_create(
                driver=ride.driver,
                ride=ride,
                source_participant=None,
                defaults={
                    'gross_fare': Decimal(str(gross)),
                    'commission_rate': comm_rate,
                    'commission_amount': Decimal(str(comm_amount)),
                    'net_earning': Decimal(str(net_earning))
                }
            )
            dp = ride.driver.driver_profile
            dp.total_rides = DriverEarning.objects.filter(driver=ride.driver).values('ride').distinct().count()
            dp.save(update_fields=['total_rides'])

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ride_{ride.id}',
            {
                'type': 'ride_completed',
                'ride_id': ride.id,
            }
        )

        return Response({
            'message': 'Digital Mobile Money payment confirmed & ride completed!',
            'status': 'COMPLETED',
            'final_fare': ride.final_fare,
            'completed_at': ride.completed_at,
            'ride_id': ride.id,
            'driver_id': ride.driver_id
        })


class InitiateCampayPaymentView(APIView):
    """
    Initiates a Campay Mobile Money collect transaction (MTN Momo / Orange Money).
    In DEMO environment, charges 25 FCFA on Campay while recording the full modal fare in the DB.
    """
    permission_classes = [IsPassenger]

    def post(self, request):
        ride_id = request.data.get('ride_id')
        participant_id = request.data.get('participant_id')
        phone_number = request.data.get('phone_number') or getattr(request.user, 'phone_number', '') or '237670000000'
        modal_fare_override = request.data.get('modal_fare')

        try:
            ride = Ride.objects.get(id=ride_id)
        except Ride.DoesNotExist:
            return Response({'error': 'Ride not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Determine exact modal fare for DB logging
        if participant_id:
            try:
                participant = SharedRideParticipant.objects.get(id=participant_id, passenger=request.user)
                exact_modal_fare = float(participant.allocated_shared_fare)
            except SharedRideParticipant.DoesNotExist:
                exact_modal_fare = float(modal_fare_override or ride.estimated_fare)
        elif modal_fare_override:
            exact_modal_fare = float(modal_fare_override)
        elif ride.final_fare:
            exact_modal_fare = float(ride.final_fare)
        else:
            exact_modal_fare = float(ride.estimated_fare)

        description = f"GRAP Ride #{ride.id} Fare Payment"
        external_ref = f"GRAP-{ride.id}-{int(time.time()) if 'time' in globals() else int(timezone.now().timestamp())}"

        res = initiate_campay_collect(
            phone_number=phone_number,
            modal_amount=exact_modal_fare,
            description=description,
            external_reference=external_ref
        )

        ref = res.get('reference', '')

        # Save Payment record per-participant (or per-ride for non-shared)
        payment_defaults = {
            'amount': Decimal(str(exact_modal_fare)),
            'method': Payment.Method.MOBILE_MONEY,
            'status': Payment.Status.PENDING,
            'transaction_ref': ref,
        }
        if participant_id:
            try:
                p_obj = SharedRideParticipant.objects.get(id=participant_id)
                payment, _ = Payment.objects.update_or_create(
                    ride=ride,
                    participant=p_obj,
                    defaults=payment_defaults
                )
            except SharedRideParticipant.DoesNotExist:
                payment, _ = Payment.objects.update_or_create(
                    ride=ride, participant=None, defaults=payment_defaults
                )
        else:
            payment, _ = Payment.objects.update_or_create(
                ride=ride, participant=None, defaults=payment_defaults
            )

        return Response({
            'message': 'Campay Mobile Money collect initiated successfully.',
            'reference': ref,
            'ussd_code': res.get('ussd_code', '*126#'),
            'operator': res.get('operator', 'MTN'),
            'status': res.get('status', 'PENDING'),
            'charged_amount': res.get('charged_amount', 10),
            'modal_amount': exact_modal_fare,
            'phone_number': phone_number,
            'ride_id': ride.id,
            'participant_id': participant_id
        }, status=status.HTTP_200_OK)


class CheckCampayPaymentStatusView(APIView):
    """
    Checks Campay transaction status and completes ride upon successful collection.
    Saves full modal price in Payment table and computes driver earnings on full modal price.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, reference):
        res = check_campay_status(reference)
        campay_status = res.get('status', 'PENDING')

        payment = Payment.objects.filter(transaction_ref=reference).select_related(
            'ride', 'ride__driver', 'ride__passenger', 'participant'
        ).first()
        if not payment:
            ride_id = request.query_params.get('ride_id')
            if ride_id:
                payment = Payment.objects.filter(
                    ride_id=ride_id, participant=None
                ).select_related('ride', 'ride__driver', 'ride__passenger').first()

        if payment and campay_status == 'SUCCESSFUL':
            ride = payment.ride
            participant = payment.participant  # None for primary/solo, set for shared passengers

            payment.status = Payment.Status.SUCCESSFUL
            payment.paid_at = timezone.now()
            payment.save(update_fields=['status', 'paid_at'])

            # Mark participant payment status if this is a shared participant payment
            if participant:
                participant.payment_status = Ride.PaymentStatus.CONFIRMED
                participant.save(update_fields=['payment_status'])
            else:
                # Primary passenger payment — mark ride completed
                ride.payment_status = Ride.PaymentStatus.CONFIRMED
                ride.status = Ride.Status.COMPLETED
                ride.completed_at = timezone.now()
                if not ride.final_fare:
                    ride.final_fare = payment.amount
                ride.save(update_fields=['payment_status', 'status', 'completed_at', 'final_fare'])

                # Update shared ride group if applicable
                if hasattr(ride, 'shared_ride_group'):
                    s_group = ride.shared_ride_group
                    s_group.status = SharedRide.SharedStatus.COMPLETED
                    s_group.available_seats = 0
                    s_group.save(update_fields=['status', 'available_seats'])

            if not ride.driver:
                ride.driver = User.objects.filter(username='driver1').first() or User.objects.filter(role=User.Role.DRIVER).first()
                ride.save(update_fields=['driver'])

            # Create driver earning keyed on (driver, ride, source_participant)
            # This means: primary fare gets earning with source_participant=None,
            # each shared participant gets their own earning row — no duplicates, no misses
            if ride.driver and hasattr(ride.driver, 'driver_profile'):
                gross = float(payment.amount or ride.final_fare or ride.estimated_fare)
                comm_rate = 15.0
                comm_amount = round(gross * (comm_rate / 100.0), 2)
                net_earning = round(gross - comm_amount, 2)
                earning, created = DriverEarning.objects.get_or_create(
                    driver=ride.driver,
                    ride=ride,
                    source_participant=participant,
                    defaults={
                        'gross_fare': Decimal(str(gross)),
                        'commission_rate': comm_rate,
                        'commission_amount': Decimal(str(comm_amount)),
                        'net_earning': Decimal(str(net_earning))
                    }
                )
                # Update total_rides = distinct rides with any earning
                dp = ride.driver.driver_profile
                dp.total_rides = DriverEarning.objects.filter(
                    driver=ride.driver
                ).values('ride').distinct().count()
                dp.save(update_fields=['total_rides'])

            # Broadcast WebSocket event
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'ride_{ride.id}',
                {
                    'type': 'ride_completed',
                    'data': {
                        'ride_id': ride.id,
                        'participant_id': participant.id if participant else None,
                        'status': 'COMPLETED',
                        'payment_status': 'CONFIRMED',
                        'final_fare': float(payment.amount)
                    }
                }
            )

        return Response({
            'reference': reference,
            'status': campay_status,
            'operator': res.get('operator', 'MTN'),
            'charged_amount': res.get('amount', 10),
            'modal_amount': float(payment.amount) if payment else None,
            'is_completed': bool(payment and payment.status == Payment.Status.SUCCESSFUL),
            'message': 'Payment confirmed successfully!' if campay_status == 'SUCCESSFUL' else 'Waiting for Mobile Money confirmation...'
        })


class RateDriverView(APIView):
    """Allow a passenger to rate the driver after a completed ride."""
    permission_classes = [IsPassenger]

    def post(self, request):
        ride_id = request.data.get('ride_id')
        score = int(request.data.get('score', 5))
        comment = request.data.get('comment', '')

        if score < 1 or score > 5:
            return Response({'error': 'Score must be between 1 and 5.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            ride = Ride.objects.get(id=ride_id, passenger=request.user, status=Ride.Status.COMPLETED)
        except Ride.DoesNotExist:
            return Response({'error': 'Completed ride not found for this user.'}, status=status.HTTP_404_NOT_FOUND)

        if not ride.driver:
            return Response({'error': 'This ride has no associated driver.'}, status=status.HTTP_400_BAD_REQUEST)

        rating, created = Rating.objects.get_or_create(
            ride=ride,
            defaults={'passenger': request.user, 'driver': ride.driver, 'score': score, 'comment': comment}
        )
        if not created:
            rating.score = score
            rating.comment = comment
            rating.save(update_fields=['score', 'comment'])

        # Recalculate driver's dynamic average rating
        if hasattr(ride.driver, 'driver_profile'):
            dp = ride.driver.driver_profile
            agg = Rating.objects.filter(driver=ride.driver).aggregate(avg=Avg('score'))
            dp.rating_avg = round(float(agg['avg'] or 0.0), 2)
            dp.save(update_fields=['rating_avg'])

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ride_{ride.id}',
            {
                'type': 'ride_rated',
                'data': {'ride_id': ride.id, 'score': rating.score}
            }
        )

        return Response({
            'message': 'Rating submitted successfully!',
            'score': rating.score,
            'driver_new_rating': ride.driver.driver_profile.rating_avg if hasattr(ride.driver, 'driver_profile') else None
        })


# Driver Endpoints
class DriverStatusView(APIView):
    permission_classes = [IsDriver]

    def post(self, request):
        driver_profile, _ = DriverProfile.objects.get_or_create(user=request.user)
        is_online = request.data.get('is_online', driver_profile.is_online)
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')

        driver_profile.is_online = is_online
        if lat is not None:
            driver_profile.current_latitude = float(lat)
        if lng is not None:
            driver_profile.current_longitude = float(lng)
        driver_profile.save()

        return Response(DriverProfileSerializer(driver_profile).data)


class DriverActiveRideView(APIView):
    permission_classes = [IsDriver]

    def get(self, request):
        active_ride = Ride.objects.filter(
            driver=request.user,
            status__in=[
                Ride.Status.ACCEPTED,
                Ride.Status.DRIVER_ARRIVING,
                Ride.Status.DRIVER_AT_PICKUP,
                Ride.Status.IN_PROGRESS,
                Ride.Status.ARRIVED_AT_DESTINATION,
            ]
        ).select_related('passenger', 'category').first()
        if not active_ride:
            return Response(None, status=status.HTTP_200_OK)
        return Response(RideSerializer(active_ride).data)


class DriverRideFeedView(APIView):
    permission_classes = [IsDriver]

    def get(self, request):
        # Pending ride requests available for pickup
        rides = Ride.objects.filter(status__in=[Ride.Status.REQUESTED, Ride.Status.MATCHING]).order_by('-created_at')
        return Response(RideSerializer(rides, many=True).data)


class DriverAcceptRideView(APIView):
    permission_classes = [IsDriver]

    def post(self, request, ride_id):
        try:
            ride = Ride.objects.get(id=ride_id, status__in=[Ride.Status.REQUESTED, Ride.Status.MATCHING])
        except Ride.DoesNotExist:
            return Response({'error': 'Ride request no longer available.'}, status=status.HTTP_400_BAD_REQUEST)

        ride.driver = request.user
        ride.status = Ride.Status.ACCEPTED
        ride.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ride_{ride.id}',
            {
                'type': 'ride_accepted',
                'data': RideSerializer(ride).data
            }
        )

        return Response(RideSerializer(ride).data)


class DriverUpdateRideStatusView(APIView):
    permission_classes = [IsDriver]

    def post(self, request, ride_id):
        new_status = request.data.get('status')
        try:
            ride = Ride.objects.get(id=ride_id, driver=request.user)
        except Ride.DoesNotExist:
            return Response({'error': 'Ride not assigned to you.'}, status=status.HTTP_404_NOT_FOUND)

        allowed_transitions = {
            Ride.Status.ACCEPTED: {Ride.Status.DRIVER_AT_PICKUP, Ride.Status.CANCELLED_BY_DRIVER},
            Ride.Status.DRIVER_ARRIVING: {Ride.Status.DRIVER_AT_PICKUP, Ride.Status.CANCELLED_BY_DRIVER},
            Ride.Status.DRIVER_AT_PICKUP: {Ride.Status.IN_PROGRESS, Ride.Status.CANCELLED_BY_DRIVER},
            Ride.Status.IN_PROGRESS: {
                Ride.Status.ARRIVED_AT_DESTINATION,
                Ride.Status.CANCELLED_BY_DRIVER,
            },
            Ride.Status.ARRIVED_AT_DESTINATION: {Ride.Status.CANCELLED_BY_DRIVER},
        }
        if new_status not in allowed_transitions.get(ride.status, set()):
            return Response(
                {'error': f'Cannot change ride status from {ride.status} to {new_status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ride.status = new_status
        update_fields = ['status']
        if new_status == Ride.Status.ARRIVED_AT_DESTINATION:
            ride.cash_otp = str(secrets.randbelow(9000) + 1000)
            update_fields.append('cash_otp')
        ride.save(update_fields=update_fields)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'ride_{ride.id}',
            {
                'type': 'ride_status_updated',
                'data': {'ride_id': ride.id, 'status': new_status},
            }
        )

        return Response(RideSerializer(ride).data)


class DriverEarningsView(APIView):
    permission_classes = [IsDriver]

    def get(self, request):
        earnings = DriverEarning.objects.filter(driver=request.user).select_related('ride').order_by('-created_at')
        total_gross = earnings.aggregate(total=Sum('gross_fare'))['total'] or Decimal('0.00')
        total_net = earnings.aggregate(total=Sum('net_earning'))['total'] or Decimal('0.00')
        total_comm = earnings.aggregate(total=Sum('commission_amount'))['total'] or Decimal('0.00')

        # completed_rides_count = distinct rides this driver has any earning for
        completed_rides_count = earnings.values('ride').distinct().count()

        withdrawals = WithdrawalRequest.objects.filter(driver=request.user).order_by('-requested_at')

        total_earning_rows = earnings.count()
        total_real_earnings = total_net
        rate_per_earning = round(total_net / Decimal(str(total_earning_rows)), 2) if total_earning_rows > 0 else Decimal('0.00')
        wallet = get_driver_wallet_balances(request.user)

        return Response({
            'total_gross_earnings': float(total_gross),
            'total_net_earnings': float(total_net),
            'total_platform_commission': float(total_comm),
            'completed_rides_count': completed_rides_count,
            'rate_per_ride': float(rate_per_earning),
            'total_real_earned': float(total_real_earnings),
            'total_withdrawn': float(wallet['total_withdrawn']),
            'cash_commission_due': float(wallet['cash_commission_due']),
            'available_balance': round(float(wallet['available_balance']), 2),
            'payout_note': 'Campay linked: Net earnings withdrawable directly to MTN MoMo / Orange Money.',
            'earnings_history': DriverEarningSerializer(earnings[:20], many=True).data,
            'withdrawals_history': WithdrawalRequestSerializer(withdrawals[:20], many=True).data
        })


class WithdrawalRequestView(APIView):
    permission_classes = [IsDriver]

    def post(self, request):
        amount = Decimal(str(request.data.get('amount', '0')))
        phone_number = request.data.get('phone_number') or getattr(request.user, 'phone_number', '') or '237670003344'
        operator = request.data.get('operator', 'MTN')

        if amount <= 0:
            return Response({'error': 'Enter a valid withdrawal amount.'}, status=status.HTTP_400_BAD_REQUEST)

        wallet = get_driver_wallet_balances(request.user)
        available_balance = wallet['available_balance']

        if amount > available_balance:
            return Response({
                'error': f'Withdrawal amount ({amount} FCFA) exceeds available balance ({available_balance:.2f} FCFA).'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Call Campay withdraw/disbursement API
        res = initiate_campay_withdraw(
            phone_number=phone_number,
            amount=amount,
            description=f'GRAP Driver Payout - {request.user.username}'
        )

        w = WithdrawalRequest.objects.create(
            driver=request.user,
            amount=amount,
            status=WithdrawalRequest.WithdrawalStatus.PROCESSED,
            processed_at=timezone.now()
        )

        new_available = max(Decimal('0.00'), available_balance - amount)

        return Response({
            'success': True,
            'message': f'Withdrawal of {amount} FCFA successfully sent to {phone_number} via Campay {res.get("operator", operator)}.',
            'withdrawal': WithdrawalRequestSerializer(w).data,
            'campay_reference': res.get('reference'),
            'new_available_balance': round(float(new_available), 2),
        }, status=status.HTTP_201_CREATED)


# DRIVER AI DEMAND ANALYTICS & RECOMMENDATIONS ENGINE
class DriverAIDemandRecommendationsView(APIView):
    permission_classes = [IsDriver]

    def get(self, request):
        """Return live activity totals without generated zones or route recommendations."""
        driver = request.user
        completed_rides = Ride.objects.filter(driver=driver, status=Ride.Status.COMPLETED)
        completed_count = completed_rides.count()
        total_searches_recorded = DemandObservation.objects.aggregate(total=Sum('request_count'))['total'] or 0

        return Response({
            'driver_total_rides': completed_count,
            'total_platform_searches': total_searches_recorded,
            'top_demand_zones': [],
            'ai_recommendations': []
        })


class DriverProposalsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        category_id = request.query_params.get('category_id')
        drivers = DriverProfile.objects.filter(
            is_online=True,
            verification_status=DriverProfile.VerificationStatus.VERIFIED
        ).select_related('user').prefetch_related('assignments__vehicle')

        if category_id:
            drivers = drivers.filter(assignments__vehicle__category=category_id)

        drivers = drivers.distinct()[:20]
        serializer = DriverProposalSerializer(drivers, many=True)
        return Response(serializer.data)


# Admin Endpoints
class AdminDriverVerificationView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        drivers = DriverProfile.objects.all().order_by('-user__date_joined')
        return Response(DriverProfileSerializer(drivers, many=True).data)

    def post(self, request):
        driver_id = request.data.get('driver_id')
        new_status = request.data.get('status') # VERIFIED or REJECTED

        try:
            profile = DriverProfile.objects.get(id=driver_id)
        except DriverProfile.DoesNotExist:
            return Response({'error': 'Driver profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        profile.verification_status = new_status
        profile.save()
        
        # Update user is_verified
        profile.user.is_verified = (new_status == DriverProfile.VerificationStatus.VERIFIED)
        profile.user.save()

        return Response(DriverProfileSerializer(profile).data)


class AdminVehicleVerificationView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        vehicles = Vehicle.objects.all().order_by('-id')
        return Response(VehicleSerializer(vehicles, many=True).data)

    def post(self, request):
        vehicle_id = request.data.get('vehicle_id')
        new_status = request.data.get('status')

        try:
            v = Vehicle.objects.get(id=vehicle_id)
        except Vehicle.DoesNotExist:
            return Response({'error': 'Vehicle not found.'}, status=status.HTTP_404_NOT_FOUND)

        v.verification_status = new_status
        v.save()
        return Response(VehicleSerializer(v).data)


class AdminSystemMetricsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        total_users = User.objects.count()
        total_passengers = User.objects.filter(role=User.Role.PASSENGER).count()
        total_drivers = User.objects.filter(role=User.Role.DRIVER).count()
        verified_drivers = DriverProfile.objects.filter(verification_status=DriverProfile.VerificationStatus.VERIFIED).count()
        pending_drivers = DriverProfile.objects.filter(verification_status=DriverProfile.VerificationStatus.PENDING).count()
        online_drivers = DriverProfile.objects.filter(is_online=True).count()
        total_vehicles = Vehicle.objects.count()

        # Rides
        all_rides = Ride.objects.all()
        total_rides = all_rides.count()
        completed_rides = all_rides.filter(status=Ride.Status.COMPLETED).count()
        cancelled_rides = all_rides.filter(status__startswith='CANCELLED').count()
        in_progress_rides = all_rides.filter(status__in=[
            Ride.Status.REQUESTED, Ride.Status.MATCHING, Ride.Status.ACCEPTED,
            Ride.Status.DRIVER_ARRIVING, Ride.Status.DRIVER_AT_PICKUP,
            Ride.Status.IN_PROGRESS, Ride.Status.ARRIVED_AT_DESTINATION
        ]).count()
        shared_rides_count = all_rides.filter(is_shared=True).count() or all_rides.filter(is_shareable=True).count()

        # Financials - corrected calculations
        total_gross = all_rides.filter(status=Ride.Status.COMPLETED).aggregate(total=Sum('final_fare'))['total'] or Decimal('0.00')
        total_comm = DriverEarning.objects.aggregate(total=Sum('commission_amount'))['total'] or Decimal('0.00')
        total_driver_net = DriverEarning.objects.aggregate(total=Sum('net_earning'))['total'] or Decimal('0.00')
        # Total driver MoMo payouts already processed (money that left the platform to drivers)
        total_disbursed = WithdrawalRequest.objects.filter(
            status=WithdrawalRequest.WithdrawalStatus.PROCESSED
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        # Platform Vault = 15% commissions collected MINUS driver net earnings still pending payout
        # i.e. total commissions earned by platform (remains with GRAP after paying drivers)
        # Driver earnings owed but not yet withdrawn = total_driver_net - total_disbursed
        driver_unpaid = float(total_driver_net) - float(total_disbursed)
        # Platform actual vault = gross collected - driver net owed (paid + unpaid) = just the 15%
        platform_vault = float(total_comm)  # Platform always keeps the 15% commission

        avg_ticket = (float(total_gross) / completed_rides) if completed_rides > 0 else 0.0
        completion_rate = round((completed_rides / total_rides * 100), 1) if total_rides > 0 else 0.0
        sharing_rate = round((shared_rides_count / total_rides * 100), 1) if total_rides > 0 else 0.0
        total_distance = all_rides.filter(status=Ride.Status.COMPLETED).aggregate(dist=Sum('distance_km'))['dist'] or 0.0
        co2_saved = round(shared_rides_count * 1.85, 1)

        # Category Breakdown
        categories_data = []
        for cat in RideCategory.objects.all():
            cat_rides = all_rides.filter(category=cat)
            cat_completed = cat_rides.filter(status=Ride.Status.COMPLETED).count()
            cat_gross = cat_rides.filter(status=Ride.Status.COMPLETED).aggregate(total=Sum('final_fare'))['total'] or 0
            categories_data.append({
                'id': cat.id,
                'name': cat.name,
                'code': cat.code,
                'total_rides': cat_rides.count(),
                'completed_rides': cat_completed,
                'gross_volume': float(cat_gross)
            })

        # Gateway & Payment Breakdown
        payments = Payment.objects.all()
        momo_count = payments.filter(method=Payment.Method.MOBILE_MONEY).count()
        cash_count = payments.filter(method=Payment.Method.CASH).count()

        # Real Hotspots from DemandObservation
        top_hotspots = DemandObservation.objects.values('zone_name').annotate(
            searches=Sum('request_count')
        ).order_by('-searches')[:6]
        
        hotspot_list = []
        tot_searches = sum(h['searches'] for h in top_hotspots) or 1
        for h in top_hotspots:
            hotspot_list.append({
                'name': h['zone_name'],
                'searches': h['searches'],
                'share_pct': round((h['searches'] / tot_searches) * 100, 1)
            })

        # 7-day Historical Simulation Trend Array (Day by Day)
        today = timezone.now().date()
        daily_trends = []
        for i in range(6, -1, -1):
            day_date = today - timedelta(days=i)
            day_rides = all_rides.filter(created_at__date=day_date)
            day_gross = day_rides.filter(status=Ride.Status.COMPLETED).aggregate(total=Sum('final_fare'))['total'] or 0
            daily_trends.append({
                'day': day_date.strftime('%a'),
                'date': day_date.strftime('%d %b'),
                'rides': day_rides.count(),
                'completed': day_rides.filter(status=Ride.Status.COMPLETED).count(),
                'gross': float(day_gross),
                'commission': float(day_gross) * 0.15,
            })

        # Recent Live Transactions & System Ride Feed
        recent_rides = all_rides.select_related('passenger', 'driver', 'category').order_by('-created_at')[:10]
        recent_feed = []
        for r in recent_rides:
            driver_display = (r.driver.get_full_name() or r.driver.username) if r.driver else 'Unassigned'
            passenger_display = (r.passenger.get_full_name() or r.passenger.username) if r.passenger else 'Passenger'
            recent_feed.append({
                'id': r.id,
                'passenger_name': passenger_display,
                'driver_name': driver_display,
                'pickup': r.pickup_name,
                'destination': r.destination_name,
                'fare': float(r.final_fare or r.estimated_fare or 0),
                'status': r.status,
                'payment_status': r.payment_status,
                'is_shared': r.is_shared or r.is_shareable,
                'category_name': r.category.name if r.category else 'Standard',
                'created_at': r.created_at.strftime('%H:%M • %d %b')
            })

        return Response({
            'financials': {
                'total_gross_volume': float(total_gross),
                'total_platform_commission': float(total_comm),
                'total_driver_net_earnings': float(total_driver_net),
                'total_disbursed_momo': float(total_disbursed),
                'driver_unpaid_balance': max(0.0, driver_unpaid),
                'platform_vault_float': max(0.0, platform_vault),
                'average_ticket_fcfa': round(avg_ticket, 0),
                'currency': 'FCFA (XAF)',
            },
            'operations': {
                'total_rides_requested': total_rides,
                'completed_rides': completed_rides,
                'cancelled_rides': cancelled_rides,
                'in_progress_rides': in_progress_rides,
                'completion_rate_pct': completion_rate,
                'shared_rides_count': shared_rides_count,
                'shared_adoption_pct': sharing_rate,
                'total_distance_km': round(float(total_distance), 1),
                'co2_saved_kg': co2_saved,
            },
            'users_and_fleet': {
                'total_users': total_users,
                'total_passengers': total_passengers,
                'total_drivers': total_drivers,
                'verified_drivers': verified_drivers,
                'pending_approval_drivers': pending_drivers,
                'online_drivers_now': online_drivers,
                'total_vehicles': total_vehicles,
            },
            'categories': categories_data,
            'gateways': {
                'campay_momo_count': momo_count,
                'cash_count': cash_count,
                'momo_share_pct': round((momo_count / max(1, (momo_count + cash_count))) * 100, 1),
            },
            'hotspots': hotspot_list,
            'daily_trends': daily_trends,
            'recent_live_feed': recent_feed,
        })

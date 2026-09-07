import math
import json
import os
import secrets
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
from django.db.models import Sum, Count, Avg, Q
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import escape
from django.contrib.auth.hashers import check_password, make_password

from core.models import (
    User, PassengerProfile, DriverProfile, VehicleOwner, Vehicle,
    DriverVehicleAssignment, RideCategory, Ride, SharedRide,
    SharedRideParticipant, DriverEarning, WithdrawalRequest,
    Rating, DemandObservation, AIRecommendation
)
from core.serializers import (
    UserSerializer, RegisterSerializer, PassengerProfileSerializer,
    DriverProfileSerializer, VehicleSerializer, RideCategorySerializer,
    RideSerializer, SharedRideSerializer, SharedRideParticipantSerializer,
    DriverEarningSerializer, WithdrawalRequestSerializer, RatingSerializer,
    AIRecommendationSerializer, DemandObservationSerializer
)
from core.permissions import IsPassenger, IsDriver, IsAdminUserRole

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
    rates = {
        'MOTO': (250, 70, 400),
        'ECONOMY': (300, 100, 400),
        'COMFORT': (700, 150, 1000),
        'COMFORT_PLUS': (1000, 200, 1500),
    }
    base, rate, minimum = rates.get(category_code, rates['ECONOMY'])
    raw_fare = base + distance * rate

    # Time-of-Day Multiplier
    current_hour = int(hour) if hour is not None else timezone.now().hour
    time_multiplier = 1.0
    if current_hour >= 21 or current_hour < 6:
        time_multiplier = 1.35  # Night Shift Surge +35%
    elif (7 <= current_hour <= 9) or (17 <= current_hour <= 19):
        time_multiplier = 1.20  # Peak Rush Hour Surge +20%

    # Weather Multiplier
    weather_multiplier = 1.0
    w_upper = str(weather).upper()
    if 'HEAVY' in w_upper or 'THUNDER' in w_upper or w_upper == 'HEAVY_RAIN':
        weather_multiplier = 1.40  # Heavy Rain / Storm Surge +40%
    elif 'RAIN' in w_upper or 'DRIZZLE' in w_upper or w_upper == 'RAIN':
        weather_multiplier = 1.20  # Rain Surge +20%

    total_fare = raw_fare * time_multiplier * weather_multiplier
    return round(max(total_fare, minimum) / 50) * 50


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
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'is_verified': self.user.is_verified,
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
        query = str(request.data.get('query', '')).strip()
        places = request.data.get('places', [])
        if not query:
            return Response({'error': 'Ask a recommendation question first.'}, status=status.HTTP_400_BAD_REQUEST)
        
        gemini_api_key = os.getenv('GEMINI_API_KEY', '').strip()
        groq_api_key = os.getenv('GROQ_API_KEY', '').strip()

        place_context = '\n'.join(
            f"- {item.get('name')} in {item.get('zone')}: {item.get('description', '')}"
            for item in places[:20] if isinstance(item, dict)
        )

        prompt_text = (
            "You are GRAP AI Concierge, an extremely intelligent, elegant, and warm Yaoundé urban guide & place expert. "
            "You possess deep geographical knowledge of ALL Yaoundé neighborhoods (Awae, Messamendongo, Odza, Mvan, Nsam, Ahala, Simbock, Bastos, Mont Fébé, Omnisports, Melen, Tsinga, Essos, Ekounou, Kondengui, Mokolo, Biyem-Assi, Etoudi, Elig-Essono, Avenue Kennedy, Nkolbisson, Nsimalen, and beyond) and Google Maps spatial layout.\n\n"
            "CRITICAL MANDATORY RULES:\n"
            "1. STRICT NEIGHBORHOOD FOCUS: Focus strictly on the exact neighborhood requested by the user and its immediate neighbor districts (e.g. for Awae, recommend spots in Awae Escalier, Carrefour Awae, Ekounou, Kondengui, Anguissa; for Messamendongo, recommend Messamendongo, Odza, Mvan).\n"
            "2. DO NOT MENTION DISTANT DISTRICTS: NEVER mention Bastos, Mont Fébé, or other far away areas if the user asked for a specific neighborhood like Awae, Messamendongo, Nsam, etc., UNLESS the user specifically asked for Bastos!\n"
            "3. NO GENERIC CATALOGUE FORCING: Do not force distant venues (like 'La Chaumière Bastos') into an answer for Awae or Messamendongo. Recommend 3-4 real, authentic local restaurants, grills, and lounges in/near the requested area.\n"
            "4. BEAUTIFUL FORMATTING: Format your response beautifully with bold venue names (**Venue Name**), location tags (📍 Location), vibe descriptions, key highlights, and date/hangout advice.\n\n"
            f"User Question: {query}"
        )


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
                    return Response({'answer': answer, 'source': 'gemini-3.6-flash'})
            except Exception as error:
                print(f'Gemini recommendation error: {error}')

        # 2. Fallback to local catalogue matching algorithm
        fallback = self.local_recommendation(query, places)
        return Response({'answer': fallback, 'source': 'catalogue-fallback'})



    @staticmethod
    def local_recommendation(query, places):
        query_words = set(str(query).lower().split())
        scored = []
        for place in places[:20]:
            text = f"{place.get('name', '')} {place.get('zone', '')} {place.get('description', '')}".lower()
            score = sum(1 for word in query_words if len(word) > 3 and word in text)
            scored.append((score, place))
        scored.sort(key=lambda item: item[0], reverse=True)
        chosen = [item[1] for item in scored[:2] if item[0] > 0] or places[:2]
        if not chosen:
            return 'I could not find a matching place in the Yaoundé catalogue yet. Try asking for dining, nature, culture, or shopping.'
        recommendations = ', '.join(f"{place.get('name')} in {place.get('zone')}" for place in chosen)
        return f"Based on our Yaoundé catalogue, I recommend {recommendations}. Open a place card to see its exact location and request a ride."


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        profile_data = {}
        if request.user.role == User.Role.PASSENGER:
            if hasattr(request.user, 'passenger_profile'):
                profile_data = PassengerProfileSerializer(request.user.passenger_profile).data
        elif request.user.role == User.Role.DRIVER:
            if hasattr(request.user, 'driver_profile'):
                profile_data = DriverProfileSerializer(request.user.driver_profile).data
        
        return Response({
            'user': serializer.data,
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

        ride = Ride.objects.create(
            passenger=request.user,
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

        return Response(RideSerializer(ride).data, status=status.HTTP_201_CREATED)


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
        
        solo_dist = haversine_km(pickup_lat, pickup_lng, dest_lat, dest_lng)
        if solo_dist < 1.0:
            solo_dist = 1.0

        passenger_dest_bearing = calculate_bearing(pickup_lat, pickup_lng, dest_lat, dest_lng)

        available_groups = SharedRide.objects.filter(
            status=SharedRide.SharedStatus.SHAREABLE,
            available_seats__gt=0,
            primary_ride__status__in=[
                Ride.Status.REQUESTED,
                Ride.Status.MATCHING,
                Ride.Status.ACCEPTED,
                Ride.Status.DRIVER_ARRIVING,
                Ride.Status.DRIVER_AT_PICKUP,
                Ride.Status.IN_PROGRESS,
            ]
        ).exclude(primary_ride__status__startswith='CANCELLED').exclude(primary_ride__passenger=request.user)

        results = []
        for s_ride in available_groups:
            p_ride = s_ride.primary_ride
            dist_to_pickup = haversine_km(pickup_lat, pickup_lng, p_ride.pickup_lat, p_ride.pickup_lng)
            if dist_to_pickup > 5.0:
                continue

            primary_bearing = calculate_bearing(p_ride.pickup_lat, p_ride.pickup_lng, p_ride.destination_lat, p_ride.destination_lng)
            bearing_diff = abs(primary_bearing - passenger_dest_bearing)
            if bearing_diff > 180:
                bearing_diff = 360 - bearing_diff
            if bearing_diff > 60:
                continue

            dist_to_destination = haversine_km(dest_lat, dest_lng, p_ride.destination_lat, p_ride.destination_lng)
            if dist_to_destination > 5.0:
                continue

            primary_solo_dist = p_ride.distance_km
            total_route_weight = primary_solo_dist + solo_dist
            
            combined_estimated_total = float(p_ride.estimated_fare) * 1.3
            passenger_share_fare = round(combined_estimated_total * (solo_dist / total_route_weight), 2)
            
            driver_name = p_ride.driver.get_full_name() if p_ride.driver else 'Jean-Paul Mbida'
            results.append({
                'shared_ride_id': s_ride.id,
                'primary_ride_id': p_ride.id,
                'pickup_name': p_ride.pickup_name,
                'destination_name': p_ride.destination_name,
                'available_seats': s_ride.available_seats,
                'total_capacity': s_ride.capacity,
                'occupied_seats': s_ride.capacity - s_ride.available_seats,
                'car_color': getattr(p_ride.driver.driver_profile.vehicle if hasattr(p_ride.driver, 'driver_profile') and p_ride.driver.driver_profile.vehicle else None, 'color', 'Yellow'),
                'car_color_hex': '#FFD600',
                'car_model': getattr(p_ride.driver.driver_profile.vehicle if hasattr(p_ride.driver, 'driver_profile') and p_ride.driver.driver_profile.vehicle else None, 'model', 'Toyota Yaris'),
                'license_plate': getattr(p_ride.driver.driver_profile.vehicle if hasattr(p_ride.driver, 'driver_profile') and p_ride.driver.driver_profile.vehicle else None, 'license_plate', 'LT-482-YA'),
                'driver_name': driver_name,
                'driver_rating': 4.9,
                'solo_distance_km': solo_dist,
                'normal_solo_fare': float(p_ride.estimated_fare),
                'proportional_shared_fare': passenger_share_fare,
                'savings_percentage': round((1 - (passenger_share_fare / float(p_ride.estimated_fare))) * 100, 1) if float(p_ride.estimated_fare) > 0 else 40.0
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

        if s_ride.available_seats <= 0 or s_ride.status == SharedRide.SharedStatus.FULL:
            return Response({'error': 'No available seats on this shared ride.'}, status=status.HTTP_400_BAD_REQUEST)

        solo_dist = haversine_km(pickup_lat, pickup_lng, dest_lat, dest_lng)
        
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
            solo_calculated_fare=allocated_fare * Decimal('1.25'),
            allocated_shared_fare=allocated_fare
        )

        s_ride.available_seats -= 1
        if s_ride.available_seats <= 0:
            s_ride.status = SharedRide.SharedStatus.FULL
        s_ride.save()

        # Update primary ride shared status
        p_ride = s_ride.primary_ride
        p_ride.is_shared = True
        p_ride.save()

        return Response({
            'message': 'Successfully joined shared ride!',
            'participant_id': participant.id,
            'allocated_fare': participant.allocated_shared_fare,
            'remaining_seats': s_ride.available_seats
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
            'initiator': {'username': primary.passenger.username, 'name': primary.passenger.get_full_name(), 'phone': primary.passenger.phone_number},
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


class ConfirmCashPaymentView(APIView):
    permission_classes = [IsPassenger]

    def post(self, request):
        ride_id = request.data.get('ride_id')
        entered_pin = request.data.get('otp_pin')

        try:
            ride = Ride.objects.get(id=ride_id, passenger=request.user)
        except Ride.DoesNotExist:
            return Response({'error': 'Ride not found.'}, status=status.HTTP_404_NOT_FOUND)

        if ride.cash_otp == str(entered_pin):
            ride.payment_status = Ride.PaymentStatus.CONFIRMED
            ride.save()
            return Response({'message': 'Cash payment confirmed successfully!'})
        else:
            return Response({'error': 'Invalid OTP PIN code. Please check with your driver.'}, status=status.HTTP_400_BAD_REQUEST)


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

        return Response(RideSerializer(ride).data)


class DriverUpdateRideStatusView(APIView):
    permission_classes = [IsDriver]

    def post(self, request, ride_id):
        new_status = request.data.get('status')
        try:
            ride = Ride.objects.get(id=ride_id, driver=request.user)
        except Ride.DoesNotExist:
            return Response({'error': 'Ride not assigned to you.'}, status=status.HTTP_404_NOT_FOUND)

        ride.status = new_status
        if new_status == Ride.Status.COMPLETED:
            ride.completed_at = timezone.now()
            ride.final_fare = ride.estimated_fare
            ride.save()

            # Calculate Earnings (15% platform commission)
            gross = float(ride.final_fare)
            comm_rate = 15.0
            comm_amount = round(gross * (comm_rate / 100.0), 2)
            net_earning = round(gross - comm_amount, 2)

            DriverEarning.objects.create(
                driver=request.user,
                ride=ride,
                gross_fare=Decimal(str(gross)),
                commission_rate=comm_rate,
                commission_amount=Decimal(str(comm_amount)),
                net_earning=Decimal(str(net_earning))
            )

            # Update Driver profile stats
            if hasattr(request.user, 'driver_profile'):
                dp = request.user.driver_profile
                dp.total_rides += 1
                dp.save()

        else:
            ride.save()

        return Response(RideSerializer(ride).data)


class DriverEarningsView(APIView):
    permission_classes = [IsDriver]

    def get(self, request):
        earnings = DriverEarning.objects.filter(driver=request.user).order_by('-created_at')
        total_net = earnings.aggregate(total=Sum('net_earning'))['total'] or Decimal('0.00')
        total_comm = earnings.aggregate(total=Sum('commission_amount'))['total'] or Decimal('0.00')

        withdrawals = WithdrawalRequest.objects.filter(driver=request.user).order_by('-requested_at')
        total_withdrawn = withdrawals.filter(status=WithdrawalRequest.WithdrawalStatus.PROCESSED).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        available_balance = Decimal(str(total_net)) - Decimal(str(total_withdrawn))

        return Response({
            'total_net_earnings': total_net,
            'total_commission_paid': total_comm,
            'available_balance': max(available_balance, Decimal('0.00')),
            'earnings_history': DriverEarningSerializer(earnings[:10], many=True).data,
            'withdrawals_history': WithdrawalRequestSerializer(withdrawals[:10], many=True).data
        })


class WithdrawalRequestView(APIView):
    permission_classes = [IsDriver]

    def post(self, request):
        amount = Decimal(str(request.data.get('amount', '0')))
        if amount <= 0:
            return Response({'error': 'Enter a valid withdrawal amount.'}, status=status.HTTP_400_BAD_REQUEST)

        w = WithdrawalRequest.objects.create(
            driver=request.user,
            amount=amount,
            status=WithdrawalRequest.WithdrawalStatus.PENDING
        )
        return Response(WithdrawalRequestSerializer(w).data, status=status.HTTP_201_CREATED)


# DRIVER AI DEMAND ANALYTICS & RECOMMENDATIONS ENGINE
class DriverAIDemandRecommendationsView(APIView):
    permission_classes = [IsDriver]

    def get(self, request):
        """
        GRAP Innovation Feature:
        Combines platform historical demand data (DemandObservation) with the driver's
        personal routine/activity history to provide tailored operational recommendations.
        """
        driver = request.user
        
        # 1. Platform-wide high demand zones
        top_zones = DemandObservation.objects.values('zone_name', 'hour_of_day').annotate(
            total_requests=Sum('request_count')
        ).order_by('-total_requests')[:5]

        zone_insights = []
        for zone in top_zones:
            hr = zone['hour_of_day']
            zone_insights.append({
                'zone_name': zone['zone_name'],
                'peak_time': f"{hr:02d}:00 - {hr+2:02d}:00",
                'demand_score': min(zone['total_requests'] * 15, 98),
            })

        # 2. Driver personal history analysis
        completed_rides = Ride.objects.filter(driver=driver, status=Ride.Status.COMPLETED)
        completed_count = completed_rides.count()

        recommendations = []
        if completed_count > 0:
            top_dest = completed_rides.values('destination_name').annotate(cnt=Count('id')).order_by('-cnt').first()
            if top_dest:
                dest_name = top_dest['destination_name']
                recommendations.append({
                    'id': 1,
                    'title': 'Personal Routine Insight',
                    'message': f"Based on your last 14 days, you frequently finish trips near {dest_name}. High demand is predicted around Mvan → {dest_name} between 17:00 and 19:00 today.",
                    'target_zone': dest_name,
                    'time_window': '17:00 - 19:00',
                    'confidence': 0.92
                })
        
        # Add default AI recommendations if not enough history
        if not recommendations:
            recommendations.append({
                'id': 1,
                'title': 'High Earning Opportunity',
                'message': 'Demand around Mvan → Bastos is currently 40% higher than average. Position near Mvan station before 17:30.',
                'target_zone': 'Mvan Station',
                'time_window': '17:00 - 19:30',
                'confidence': 0.89
            })
            recommendations.append({
                'id': 2,
                'title': 'Morning Peak Prediction',
                'message': 'High morning commuter demand predicted near Mokolo Market between 07:00 and 09:00 tomorrow.',
                'target_zone': 'Mokolo Market',
                'time_window': '07:00 - 09:00',
                'confidence': 0.85
            })

        return Response({
            'driver_total_rides': completed_count,
            'top_demand_zones': zone_insights,
            'ai_recommendations': recommendations
        })


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
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        total_users = User.objects.count()
        total_passengers = User.objects.filter(role=User.Role.PASSENGER).count()
        total_drivers = User.objects.filter(role=User.Role.DRIVER).count()
        total_rides = Ride.objects.count()
        completed_rides = Ride.objects.filter(status=Ride.Status.COMPLETED).count()
        total_gross = Ride.objects.filter(status=Ride.Status.COMPLETED).aggregate(total=Sum('final_fare'))['total'] or Decimal('0.00')
        total_comm = DriverEarning.objects.aggregate(total=Sum('commission_amount'))['total'] or Decimal('0.00')

        return Response({
            'total_users': total_users,
            'total_passengers': total_passengers,
            'total_drivers': total_drivers,
            'total_rides': total_rides,
            'completed_rides': completed_rides,
            'total_gross_revenue': total_gross,
            'total_platform_commission': total_comm
        })

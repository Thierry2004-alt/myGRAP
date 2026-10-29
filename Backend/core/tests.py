from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from core.views import GroqPlaceRecommendationView
from core.models import (
    User, PassengerProfile, DriverProfile, RideCategory, Ride,
    SharedRide, SharedRideParticipant, DriverEarning, DemandObservation, WithdrawalRequest, Payment, Place
)

class GRAPBackendTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Category
        self.category = RideCategory.objects.create(
            name='Economy', code='ECONOMY', base_fare=500.00, rate_per_km=200.00, multiplier=1.0
        )

        # Create Passenger 1
        self.passenger1 = User.objects.create_user(
            username='p1', password='password123', role=User.Role.PASSENGER, email='p1@test.com'
        )
        PassengerProfile.objects.create(user=self.passenger1)

        # Create Passenger 2
        self.passenger2 = User.objects.create_user(
            username='p2', password='password123', role=User.Role.PASSENGER, email='p2@test.com'
        )
        PassengerProfile.objects.create(user=self.passenger2)

        # Create Driver
        self.driver = User.objects.create_user(
            username='d1', password='password123', role=User.Role.DRIVER, email='d1@test.com'
        )
        DriverProfile.objects.create(user=self.driver, is_online=True, verification_status='VERIFIED')

        # Obtain JWT tokens
        res1 = self.client.post('/api/auth/login/', {'username': 'p1', 'password': 'password123'})
        self.p1_token = res1.data['access']

        res2 = self.client.post('/api/auth/login/', {'username': 'p2', 'password': 'password123'})
        self.p2_token = res2.data['access']

        res_d = self.client.post('/api/auth/login/', {'username': 'd1', 'password': 'password123'})
        self.driver_token = res_d.data['access']

    def test_place_concierge_ranks_only_catalogue_matches_for_french_queries(self):
        places = [
            {
                'id': 6,
                'name': 'Marché Mokolo',
                'zone': 'Mokolo',
                'category': 'Market & shopping',
                'category_code': 'SHOPPING',
                'description': 'A marketplace in the Mokolo neighbourhood.',
                'highlights': ['Marketplace'],
                'keywords': ['market', 'shopping', 'marché', 'mokolo'],
            },
            {
                'id': 7,
                'name': 'Lac Municipal de Yaoundé',
                'zone': 'Centre Administratif',
                'category': 'Waterfront & leisure',
                'category_code': 'PARKS',
                'description': 'The municipal lake in Yaoundé.',
                'highlights': ['Municipal lake'],
                'keywords': ['lake', 'nature', 'quiet', 'walk'],
            },
        ]

        ranked = GroqPlaceRecommendationView.rank_places('Je cherche un marché à Mokolo', places)

        self.assertEqual([place['id'] for place in ranked], [6])

    def test_place_concierge_does_not_default_to_unrelated_places(self):
        ranked = GroqPlaceRecommendationView.rank_places('Awae restaurant', [{
            'id': 3,
            'name': 'Bois Sainte Anastasie',
            'zone': 'Carrefour Warda',
            'category': 'Restaurant & leisure',
            'category_code': 'DINING',
            'description': 'A restaurant in Yaoundé.',
            'highlights': [],
            'keywords': ['restaurant', 'food'],
        }])

        self.assertEqual(ranked, [])
        self.assertIn('listed match', GroqPlaceRecommendationView.local_recommendation('Awae restaurant', []))

    def test_place_concierge_returns_ranked_catalogue_ids_in_api_response(self):
        self.client.force_authenticate(user=self.passenger1)
        place = Place.objects.create(
            slug='test-mokolo-market',
            name='Test Mokolo Market',
            category='Market & shopping',
            category_code=Place.Category.SHOPPING,
            zone='Mokolo',
            latitude=3.87,
            longitude=11.50,
            description='A marketplace in Mokolo.',
            search_keywords=['market', 'shopping', 'mokolo'],
        )

        with patch.dict('os.environ', {'GEMINI_API_KEY': '', 'GROQ_API_KEY': ''}):
            response = self.client.post('/api/ai/place-recommendation/', {
                'query': 'Je cherche un marché à Mokolo',
                'places': [{
                    'id': 999999,
                    'name': 'Client-only market',
                    'zone': 'Mokolo',
                    'category': 'Market & shopping',
                    'category_code': 'SHOPPING',
                    'description': 'Injected catalogue entry.',
                    'highlights': [],
                    'keywords': ['market', 'mokolo'],
                }],
            }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(place.id, response.data['recommended_place_ids'])
        self.assertNotIn(999999, response.data['recommended_place_ids'])
        self.assertEqual(response.data['source'], 'catalogue-fallback')
        self.assertIn('Test Mokolo Market', response.data['answer'])

    def test_places_api_returns_active_database_records_and_photo_urls(self):
        self.client.force_authenticate(user=self.passenger1)
        place = Place.objects.create(
            slug='test-database-place',
            name='Database Place',
            category='Dining',
            category_code=Place.Category.DINING,
            zone='Warda',
            latitude=3.87,
            longitude=11.51,
            description='A place managed in the database.',
            image_path='core/places/bois-sainte-anastasie.jpg',
            photo_credit='Test photographer',
            photo_license='CC BY-SA 4.0',
        )
        Place.objects.create(
            slug='test-inactive-place',
            name='Inactive Place',
            category='Dining',
            category_code=Place.Category.DINING,
            zone='Warda',
            latitude=3.87,
            longitude=11.51,
            description='An inactive place.',
            is_active=False,
        )

        response = self.client.get('/api/places/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = next(item for item in response.data if item['id'] == place.id)
        self.assertEqual(result['name'], 'Database Place')
        self.assertEqual(result['category_code'], Place.Category.DINING)
        self.assertTrue(result['photo_url'].endswith('/static/core/places/bois-sainte-anastasie.jpg'))
        self.assertEqual(result['photo_credit'], 'Test photographer')
        self.assertNotIn('Inactive Place', [item['name'] for item in response.data])

    def test_place_concierge_uses_groq_when_configured(self):
        self.client.force_authenticate(user=self.passenger1)
        place = Place.objects.get(slug='marche-mokolo')

        with patch.dict('os.environ', {'GEMINI_API_KEY': '', 'GROQ_API_KEY': 'unit-test-key'}):
            with patch('core.views.urlopen') as mocked_urlopen:
                mocked_urlopen.return_value.__enter__.return_value.read.return_value = (
                    b'{"choices":[{"message":{"content":"March\\u00e9 Mokolo is the closest match."}}]}'
                )
                response = self.client.post('/api/ai/place-recommendation/', {
                    'query': 'Je cherche un marché à Mokolo',
                }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'groq-llama-3.3-70b-versatile')
        self.assertEqual(response.data['recommended_place_ids'], [place.id])
        self.assertEqual(response.data['answer'], 'Marché Mokolo is the closest match.')
        self.assertIn('api.groq.com/openai/v1/chat/completions', mocked_urlopen.call_args.args[0].full_url)

    def test_jwt_auth_and_user_roles(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.p1_token}')
        res = self.client.get('/api/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['user']['role'], 'PASSENGER')

    def test_fare_estimation(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.p1_token}')
        res = self.client.post('/api/rides/estimate/', {
            'pickup_lat': 3.8480, 'pickup_lng': 11.5021,
            'destination_lat': 3.8600, 'destination_lng': 11.5150,
            'category_id': self.category.id
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue('estimated_solo_fare' in res.data)

    def test_voluntary_dynamic_ride_sharing_flow(self):
        # 1. Passenger 1 creates a ride request
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.p1_token}')
        ride_res = self.client.post('/api/rides/request/', {
            'category_id': self.category.id,
            'pickup_name': 'Mvan Bus Station',
            'pickup_lat': 3.8400, 'pickup_lng': 11.5000,
            'destination_name': 'Bastos Ambassades',
            'destination_lat': 3.8750, 'destination_lng': 11.5180
        })
        self.assertEqual(ride_res.status_code, status.HTTP_201_CREATED)
        ride1_id = ride_res.data['id']

        # 2. Passenger 1 toggles "Make My Ride Shareable"
        share_res = self.client.post('/api/rides/shared/make-shareable/', {'ride_id': ride1_id})
        self.assertEqual(share_res.status_code, status.HTTP_200_OK)
        self.assertTrue(share_res.data['is_shareable'])

        # 3. Passenger 2 searches for compatible shareable rides
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.p2_token}')
        search_res = self.client.post('/api/rides/shared/search/', {
            'pickup_lat': 3.8420, 'pickup_lng': 11.5010,
            'destination_lat': 3.8720, 'destination_lng': 11.5160
        })
        self.assertEqual(search_res.status_code, status.HTTP_200_OK)
        self.assertGreater(search_res.data['count'], 0)

        shared_item = search_res.data['shareable_rides'][0]
        shared_group_id = shared_item['shared_ride_id']
        allocated_fare = shared_item['proportional_shared_fare']

        # 4. Passenger 2 joins the shared ride
        join_res = self.client.post('/api/rides/shared/join/', {
            'shared_ride_id': shared_group_id,
            'pickup_name': 'Mvan Entrance',
            'pickup_lat': 3.8420, 'pickup_lng': 11.5010,
            'destination_name': 'Bastos Center',
            'destination_lat': 3.8720, 'destination_lng': 11.5160,
            'allocated_shared_fare': str(allocated_fare)
        })
        self.assertEqual(join_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(join_res.data['remaining_seats'], 2)

    def test_driver_ai_demand_recommendations(self):
        # Create demand observation
        DemandObservation.objects.create(
            zone_name='Mvan Station', latitude=3.8400, longitude=11.5000, hour_of_day=17, day_of_week=1, request_count=25
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        res = self.client.get('/api/driver/ai-recommendations/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue('top_demand_zones' in res.data)
        self.assertTrue('ai_recommendations' in res.data)
        self.assertEqual(res.data['top_demand_zones'], [])
        self.assertEqual(res.data['ai_recommendations'], [])

    def test_driver_ai_recommendations_never_include_zones_or_advice(self):
        ride = Ride.objects.create(
            passenger=self.passenger1,
            driver=self.driver,
            category=self.category,
            pickup_name='Mvan Bus Terminal',
            pickup_lat=3.84,
            pickup_lng=11.5,
            destination_name='Bastos Ambassades',
            destination_lat=3.875,
            destination_lng=11.518,
            distance_km=5.0,
            estimated_fare=Decimal('1500.00'),
            status=Ride.Status.COMPLETED,
        )
        DriverEarning.objects.create(
            driver=self.driver,
            ride=ride,
            gross_fare=Decimal('1500.00'),
            commission_rate=15.0,
            commission_amount=Decimal('225.00'),
            net_earning=Decimal('1275.00'),
        )
        DemandObservation.objects.create(
            zone_name='Mvan Bus Terminal',
            latitude=3.84,
            longitude=11.5,
            hour_of_day=17,
            day_of_week=1,
            request_count=25,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        res = self.client.get('/api/driver/ai-recommendations/')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['driver_total_rides'], 1)
        self.assertEqual(res.data['total_platform_searches'], 25)
        self.assertEqual(res.data['top_demand_zones'], [])
        self.assertEqual(res.data['ai_recommendations'], [])

    def test_driver_earnings_are_zero_without_history(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        res = self.client.get('/api/driver/earnings/')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total_gross_earnings'], 0)
        self.assertEqual(res.data['total_net_earnings'], 0)
        self.assertEqual(res.data['available_balance'], 0)
        self.assertEqual(res.data['earnings_history'], [])
        self.assertEqual(res.data['withdrawals_history'], [])

    def test_driver_withdrawal_uses_net_earnings_balance(self):
        ride = Ride.objects.create(
            passenger=self.passenger1,
            driver=self.driver,
            category=self.category,
            pickup_name='A',
            pickup_lat=3.8,
            pickup_lng=11.5,
            destination_name='B',
            destination_lat=3.86,
            destination_lng=11.51,
            distance_km=5.0,
            estimated_fare=Decimal('1000.00'),
            status=Ride.Status.COMPLETED,
        )
        DriverEarning.objects.create(
            driver=self.driver,
            ride=ride,
            gross_fare=Decimal('1000.00'),
            commission_rate=15.0,
            commission_amount=Decimal('150.00'),
            net_earning=Decimal('850.00'),
        )
        WithdrawalRequest.objects.create(
            driver=self.driver,
            amount=Decimal('600.00'),
            status=WithdrawalRequest.WithdrawalStatus.PROCESSED,
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        res = self.client.post('/api/driver/withdraw/', {
            'amount': '251.00',
            'phone_number': '+237670003344',
            'operator': 'MTN',
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('exceeds available balance', res.data['error'])

    def test_driver_cash_payment_requires_destination_pin_and_deducts_commission(self):
        ride = Ride.objects.create(
            passenger=self.passenger1,
            driver=self.driver,
            category=self.category,
            pickup_name='Pickup',
            pickup_lat=3.8,
            pickup_lng=11.5,
            destination_name='Destination',
            destination_lat=3.86,
            destination_lng=11.51,
            distance_km=5.0,
            estimated_fare=Decimal('1500.00'),
            status=Ride.Status.IN_PROGRESS,
        )
        original_pin = ride.cash_otp
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')

        before_arrival = self.client.post('/api/rides/confirm-cash-otp/', {
            'ride_id': ride.id,
            'otp_pin': original_pin,
        }, format='json')
        self.assertEqual(before_arrival.status_code, status.HTTP_400_BAD_REQUEST)

        arrival = self.client.post(f'/api/driver/update-ride/{ride.id}/', {
            'status': Ride.Status.ARRIVED_AT_DESTINATION,
        }, format='json')
        self.assertEqual(arrival.status_code, status.HTTP_200_OK)
        ride.refresh_from_db()
        self.assertNotEqual(ride.cash_otp, original_pin)
        self.assertIsNone(arrival.data['cash_otp'])

        invalid_pin = self.client.post('/api/rides/confirm-cash-otp/', {
            'ride_id': ride.id,
            'otp_pin': '4892',
        }, format='json')
        self.assertEqual(invalid_pin.status_code, status.HTTP_400_BAD_REQUEST)

        confirmed = self.client.post('/api/rides/confirm-cash-otp/', {
            'ride_id': ride.id,
            'otp_pin': ride.cash_otp,
        }, format='json')
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.assertEqual(confirmed.data['payment_status'], Ride.PaymentStatus.CONFIRMED)

        ride.refresh_from_db()
        payment = Payment.objects.get(ride=ride, participant=None)
        earning = DriverEarning.objects.get(ride=ride, source_participant=None)
        self.assertEqual(ride.status, Ride.Status.COMPLETED)
        self.assertEqual(payment.method, Payment.Method.CASH)
        self.assertEqual(earning.commission_amount, Decimal('225.00'))
        self.assertEqual(confirmed.data['cash_commission_due'], 225.0)

    def test_driver_profile_can_confirm_cash_when_user_role_is_stale(self):
        ride = Ride.objects.create(
            passenger=self.passenger1,
            driver=self.driver,
            category=self.category,
            pickup_name='Pickup',
            pickup_lat=3.8,
            pickup_lng=11.5,
            destination_name='Destination',
            destination_lat=3.86,
            destination_lng=11.51,
            distance_km=5.0,
            estimated_fare=Decimal('1500.00'),
            status=Ride.Status.ARRIVED_AT_DESTINATION,
        )
        self.driver.role = User.Role.PASSENGER
        self.driver.save(update_fields=['role'])
        self.client.force_authenticate(user=self.driver)

        response = self.client.post('/api/rides/confirm-cash-otp/', {
            'ride_id': ride.id,
            'otp_pin': ride.cash_otp,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ride.refresh_from_db()
        self.assertEqual(ride.status, Ride.Status.COMPLETED)

    def test_cash_pin_confirmation_requires_the_authenticated_user_to_own_the_ride(self):
        ride = Ride.objects.create(
            passenger=self.passenger1,
            driver=self.driver,
            category=self.category,
            pickup_name='Pickup',
            pickup_lat=3.8,
            pickup_lng=11.5,
            destination_name='Destination',
            destination_lat=3.86,
            destination_lng=11.51,
            distance_km=5.0,
            estimated_fare=Decimal('1500.00'),
            status=Ride.Status.ARRIVED_AT_DESTINATION,
        )
        self.client.force_authenticate(user=self.passenger2)

        response = self.client.post('/api/rides/confirm-cash-otp/', {
            'ride_id': ride.id,
            'otp_pin': ride.cash_otp,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cash_commission_is_deducted_from_platform_wallet_earnings(self):
        digital_ride = Ride.objects.create(
            passenger=self.passenger1,
            driver=self.driver,
            category=self.category,
            pickup_name='Digital pickup',
            pickup_lat=3.8,
            pickup_lng=11.5,
            destination_name='Digital destination',
            destination_lat=3.86,
            destination_lng=11.51,
            distance_km=5.0,
            estimated_fare=Decimal('1500.00'),
            status=Ride.Status.COMPLETED,
            payment_status=Ride.PaymentStatus.CONFIRMED,
        )
        Payment.objects.create(
            ride=digital_ride,
            amount=Decimal('1500.00'),
            method=Payment.Method.MOBILE_MONEY,
            status=Payment.Status.SUCCESSFUL,
        )
        DriverEarning.objects.create(
            driver=self.driver,
            ride=digital_ride,
            gross_fare=Decimal('1500.00'),
            commission_rate=15.0,
            commission_amount=Decimal('225.00'),
            net_earning=Decimal('1275.00'),
        )

        cash_ride = Ride.objects.create(
            passenger=self.passenger2,
            driver=self.driver,
            category=self.category,
            pickup_name='Cash pickup',
            pickup_lat=3.8,
            pickup_lng=11.5,
            destination_name='Cash destination',
            destination_lat=3.86,
            destination_lng=11.51,
            distance_km=5.0,
            estimated_fare=Decimal('1000.00'),
            status=Ride.Status.COMPLETED,
            payment_status=Ride.PaymentStatus.CONFIRMED,
        )
        Payment.objects.create(
            ride=cash_ride,
            amount=Decimal('1000.00'),
            method=Payment.Method.CASH,
            status=Payment.Status.SUCCESSFUL,
        )
        DriverEarning.objects.create(
            driver=self.driver,
            ride=cash_ride,
            gross_fare=Decimal('1000.00'),
            commission_rate=15.0,
            commission_amount=Decimal('150.00'),
            net_earning=Decimal('850.00'),
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        res = self.client.get('/api/driver/earnings/')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total_net_earnings'], 2125.0)
        self.assertEqual(res.data['available_balance'], 1125.0)
        self.assertEqual(res.data['cash_commission_due'], 0.0)

    def test_cash_pin_is_only_returned_to_the_passenger(self):
        ride = Ride.objects.create(
            passenger=self.passenger1,
            driver=self.driver,
            category=self.category,
            pickup_name='Pickup',
            pickup_lat=3.8,
            pickup_lng=11.5,
            destination_name='Destination',
            destination_lat=3.86,
            destination_lng=11.51,
            distance_km=5.0,
            estimated_fare=Decimal('1500.00'),
            status=Ride.Status.ACCEPTED,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        driver_response = self.client.get('/api/driver/active-ride/')
        self.assertEqual(driver_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(driver_response.data['cash_otp'])

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.p1_token}')
        passenger_response = self.client.get('/api/rides/my-rides/')
        passenger_ride = next(item for item in passenger_response.data if item['id'] == ride.id)
        self.assertEqual(passenger_ride['cash_otp'], ride.cash_otp)

    def test_driver_completion_and_commission(self):
        # Driver accepts and completes a ride
        ride = Ride.objects.create(
            passenger=self.passenger1, driver=self.driver, category=self.category,
            pickup_name='A', pickup_lat=3.8, pickup_lng=11.5,
            destination_name='B', destination_lat=3.86, destination_lng=11.51,
            distance_km=5.0, estimated_fare=Decimal('1500.00'), status=Ride.Status.IN_PROGRESS
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        res = self.client.post(f'/api/driver/update-ride/{ride.id}/', {
            'status': Ride.Status.ARRIVED_AT_DESTINATION,
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ride.refresh_from_db()
        res = self.client.post('/api/rides/confirm-cash-otp/', {
            'ride_id': ride.id,
            'otp_pin': ride.cash_otp,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Check driver earning record created (15% commission)
        earning = DriverEarning.objects.get(ride=ride)
        self.assertEqual(earning.gross_fare, Decimal('1500.00'))
        self.assertEqual(earning.commission_amount, Decimal('225.00'))
        self.assertEqual(earning.net_earning, Decimal('1275.00'))

    def test_production_real_driver_lifecycle(self):
        # 1. Passenger requests a ride (no driver assigned initially)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.p1_token}')
        req_res = self.client.post('/api/rides/request/', {
            'category_id': self.category.id,
            'pickup_name': 'Mokolo Market',
            'pickup_lat': 3.8680,
            'pickup_lng': 11.5050,
            'destination_name': 'Bastos Ambassades',
            'destination_lat': 3.8750,
            'destination_lng': 11.5180
        })
        self.assertEqual(req_res.status_code, status.HTTP_201_CREATED)
        ride_id = req_res.data['id']
        self.assertIsNone(req_res.data['driver'])
        self.assertEqual(req_res.data['status'], 'REQUESTED')
        self.assertTrue(bool(req_res.data.get('cash_otp')))

        # 2. Driver views incoming requests feed
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        feed_res = self.client.get('/api/driver/ride-requests/')
        self.assertEqual(feed_res.status_code, status.HTTP_200_OK)
        found = any(r['id'] == ride_id for r in feed_res.data)
        self.assertTrue(found)

        # 3. Real driver accepts the ride
        accept_res = self.client.post(f'/api/driver/accept-ride/{ride_id}/')
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_res.data['status'], 'ACCEPTED')
        self.assertEqual(accept_res.data['driver'], self.driver.id)

        # 4. Driver checks their active ride endpoint
        active_res = self.client.get('/api/driver/active-ride/')
        self.assertEqual(active_res.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(active_res.data)
        self.assertEqual(active_res.data['id'], ride_id)

        # 5. Driver updates status: Arrived at pickup
        arr_res = self.client.post(f'/api/driver/update-ride/{ride_id}/', {'status': 'DRIVER_AT_PICKUP'})
        self.assertEqual(arr_res.status_code, status.HTTP_200_OK)
        self.assertEqual(arr_res.data['status'], 'DRIVER_AT_PICKUP')

        # 6. Driver starts the trip
        start_res = self.client.post(f'/api/driver/update-ride/{ride_id}/', {'status': 'IN_PROGRESS'})
        self.assertEqual(start_res.status_code, status.HTTP_200_OK)
        self.assertEqual(start_res.data['status'], 'IN_PROGRESS')

        # 7. Driver completes the trip
        complete_res = self.client.post(f'/api/driver/update-ride/{ride_id}/', {'status': 'ARRIVED_AT_DESTINATION'})
        self.assertEqual(complete_res.status_code, status.HTTP_200_OK)
        self.assertEqual(complete_res.data['status'], 'ARRIVED_AT_DESTINATION')
        ride = Ride.objects.get(id=ride_id)
        cash_res = self.client.post('/api/rides/confirm-cash-otp/', {
            'ride_id': ride.id,
            'otp_pin': ride.cash_otp,
        }, format='json')
        self.assertEqual(cash_res.status_code, status.HTTP_200_OK)
        self.assertEqual(cash_res.data['status'], 'COMPLETED')

        # 8. Check active ride is cleared
        active_cleared = self.client.get('/api/driver/active-ride/')
        self.assertEqual(active_cleared.status_code, status.HTTP_200_OK)
        self.assertIsNone(active_cleared.data)

        # 9. Verify earnings calculation (15% commission)
        earnings_res = self.client.get('/api/driver/earnings/')
        self.assertEqual(earnings_res.status_code, status.HTTP_200_OK)
        self.assertGreater(earnings_res.data['total_net_earnings'], 0)
        self.assertEqual(earnings_res.data['available_balance'], 0)
        self.assertGreater(earnings_res.data['cash_commission_due'], 0)

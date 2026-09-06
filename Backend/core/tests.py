from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from core.models import (
    User, PassengerProfile, DriverProfile, RideCategory, Ride,
    SharedRide, SharedRideParticipant, DriverEarning, DemandObservation
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

    def test_driver_completion_and_commission(self):
        # Driver accepts and completes a ride
        ride = Ride.objects.create(
            passenger=self.passenger1, driver=self.driver, category=self.category,
            pickup_name='A', pickup_lat=3.8, pickup_lng=11.5,
            destination_name='B', destination_lat=3.86, destination_lng=11.51,
            distance_km=5.0, estimated_fare=Decimal('1500.00'), status=Ride.Status.ACCEPTED
        )

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.driver_token}')
        res = self.client.post(f'/api/driver/update-ride/{ride.id}/', {'status': 'COMPLETED'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Check driver earning record created (15% commission)
        earning = DriverEarning.objects.get(ride=ride)
        self.assertEqual(earning.gross_fare, Decimal('1500.00'))
        self.assertEqual(earning.commission_amount, Decimal('225.00'))
        self.assertEqual(earning.net_earning, Decimal('1275.00'))

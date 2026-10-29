from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application
from core.models import Payment, Ride, RideCategory, User


class RideLocationWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.category = RideCategory.objects.create(
            name='Economy',
            code='ECONOMY',
            base_fare=500,
            rate_per_km=200,
        )
        self.passenger = User.objects.create_user(
            username='tracking-passenger',
            password='test-password',
            role=User.Role.PASSENGER,
        )
        self.driver = User.objects.create_user(
            username='tracking-driver',
            password='test-password',
            role=User.Role.DRIVER,
        )
        self.outsider = User.objects.create_user(
            username='tracking-outsider',
            password='test-password',
            role=User.Role.PASSENGER,
        )
        self.ride = Ride.objects.create(
            passenger=self.passenger,
            driver=self.driver,
            category=self.category,
            pickup_name='Pickup',
            pickup_lat=3.84,
            pickup_lng=11.5,
            destination_name='Destination',
            destination_lat=3.875,
            destination_lng=11.518,
            estimated_fare=1500,
            status=Ride.Status.ACCEPTED,
        )

    def websocket_path(self, user):
        token = AccessToken.for_user(user)
        return f'/ws/rides/{self.ride.id}/?token={token}'

    def test_driver_and_passenger_can_exchange_live_locations(self):
        async def exercise():
            driver_socket = WebsocketCommunicator(application, self.websocket_path(self.driver))
            passenger_socket = WebsocketCommunicator(application, self.websocket_path(self.passenger))
            driver_connected, _ = await driver_socket.connect()
            passenger_connected, _ = await passenger_socket.connect()
            self.assertTrue(driver_connected)
            self.assertTrue(passenger_connected)
            await driver_socket.receive_json_from()
            await passenger_socket.receive_json_from()

            await driver_socket.send_json_to({
                'action': 'driver_location',
                'latitude': 3.841,
                'longitude': 11.501,
            })
            driver_update = await driver_socket.receive_json_from()
            passenger_update = await passenger_socket.receive_json_from()
            self.assertEqual(driver_update['type'], 'driver_location_updated')
            self.assertEqual(passenger_update['data']['latitude'], 3.841)
            self.assertEqual(passenger_update['data']['longitude'], 11.501)

            await passenger_socket.send_json_to({
                'action': 'passenger_location',
                'latitude': 3.842,
                'longitude': 11.502,
            })
            driver_update = await driver_socket.receive_json_from()
            self.assertEqual(driver_update['type'], 'passenger_location_updated')
            self.assertEqual(driver_update['data']['latitude'], 3.842)

            await driver_socket.disconnect()
            await passenger_socket.disconnect()

        async_to_sync(exercise)()

    def test_unrelated_user_cannot_join_ride_location_stream(self):
        async def connect_as_outsider():
            socket = WebsocketCommunicator(application, self.websocket_path(self.outsider))
            connected, close_code = await socket.connect()
            if connected:
                await socket.disconnect()
            return connected, close_code

        connected, close_code = async_to_sync(connect_as_outsider)()
        self.assertFalse(connected)
        self.assertEqual(close_code, 4403)


class DriverRideArrivalStatusTests(TransactionTestCase):
    def setUp(self):
        self.driver = User.objects.create_user(
            username='arrival-driver',
            password='test-password',
            role=User.Role.DRIVER,
        )
        passenger = User.objects.create_user(
            username='arrival-passenger',
            password='test-password',
            role=User.Role.PASSENGER,
        )
        category = RideCategory.objects.create(
            name='Arrival Test',
            code='ARRIVAL_TEST',
            base_fare=500,
            rate_per_km=200,
        )
        self.ride = Ride.objects.create(
            passenger=passenger,
            driver=self.driver,
            category=category,
            pickup_name='Pickup',
            pickup_lat=3.84,
            pickup_lng=11.5,
            destination_name='Destination',
            destination_lat=3.875,
            destination_lng=11.518,
            estimated_fare=1500,
            status=Ride.Status.IN_PROGRESS,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.driver)

    def test_driver_arrival_notifies_payment_stage_without_completing_or_charging(self):
        response = self.client.post(
            f'/api/driver/update-ride/{self.ride.id}/',
            {'status': Ride.Status.ARRIVED_AT_DESTINATION},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.ride.refresh_from_db()
        self.assertEqual(self.ride.status, Ride.Status.ARRIVED_AT_DESTINATION)
        self.assertFalse(Payment.objects.filter(ride=self.ride).exists())

    def test_driver_cannot_complete_ride_before_passenger_payment(self):
        response = self.client.post(
            f'/api/driver/update-ride/{self.ride.id}/',
            {'status': Ride.Status.COMPLETED},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.ride.refresh_from_db()
        self.assertEqual(self.ride.status, Ride.Status.IN_PROGRESS)
        self.assertFalse(Payment.objects.filter(ride=self.ride).exists())

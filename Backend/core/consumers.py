import math
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from core.models import Ride

User = get_user_model()

class RideConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.ride_id = self.scope['url_route']['kwargs']['ride_id']
        self.room_group_name = f'ride_{self.ride_id}'
        self.driver_location_group_name = f'{self.room_group_name}_driver_location'
        self.passenger_location_group_name = f'{self.room_group_name}_passenger_location'
        self.user = self.scope.get('user')

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        self.ride_role = await self.get_ride_role()
        if not self.ride_role:
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        if self.ride_role in ('driver', 'passenger', 'participant'):
            await self.channel_layer.group_add(
                self.driver_location_group_name,
                self.channel_name
            )
        if self.ride_role == 'driver':
            await self.channel_layer.group_add(
                self.passenger_location_group_name,
                self.channel_name
            )
        await self.accept()

        # Send initial connected acknowledgement
        await self.send_json({
            'type': 'connected',
            'ride_id': self.ride_id,
            'message': f'Connected to live updates for ride #{self.ride_id}',
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        if hasattr(self, 'driver_location_group_name') and getattr(
            self, 'ride_role', None
        ) in ('driver', 'passenger', 'participant'):
            await self.channel_layer.group_discard(self.driver_location_group_name, self.channel_name)
        if hasattr(self, 'passenger_location_group_name') and getattr(self, 'ride_role', None) == 'driver':
            await self.channel_layer.group_discard(self.passenger_location_group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if not isinstance(content, dict):
            return
        action = content.get('action') or content.get('type')
        data = content.get('data', content)
        if not isinstance(data, dict):
            return

        if action == 'ping':
            await self.send_json({'type': 'pong'})
        elif action == 'cancel_ride':
            await self.handle_cancel_ride(data)
        elif action == 'update_status':
            await self.handle_update_status(data)
        elif action == 'driver_location':
            await self.handle_location_update(data, 'driver')
        elif action == 'passenger_location':
            await self.handle_location_update(data, 'passenger')

    @database_sync_to_async
    def get_ride_role(self):
        try:
            ride = Ride.objects.get(id=self.ride_id)
        except (Ride.DoesNotExist, ValueError):
            return None

        if ride.driver_id == self.user.id:
            return 'driver'
        if ride.passenger_id == self.user.id:
            return 'passenger'
        if hasattr(ride, 'shared_ride_group') and ride.shared_ride_group.participants.filter(
            passenger_id=self.user.id
        ).exists():
            return 'participant'
        return None

    async def handle_cancel_ride(self, data):
        if self.ride_role != 'passenger':
            return
        ride_id = data.get('ride_id', self.ride_id)
        if str(ride_id) != str(self.ride_id):
            return
        await self.cancel_ride(ride_id)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'ride_cancelled',
                'data': {'ride_id': ride_id, 'status': 'CANCELLED'},
            }
        )

    async def handle_update_status(self, data):
        if self.ride_role != 'driver':
            return
        ride_id = data.get('ride_id', self.ride_id)
        new_status = data.get('status')
        if str(ride_id) != str(self.ride_id) or new_status not in Ride.Status.values:
            return
        await self.update_ride_status(ride_id, new_status)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'ride_status_updated',
                'data': {'ride_id': ride_id, 'status': new_status},
            }
        )

    async def handle_location_update(self, data, role):
        if role == 'driver' and self.ride_role != 'driver':
            return
        if role == 'passenger' and self.ride_role != 'passenger':
            return

        latitude = data.get('latitude', data.get('lat'))
        longitude = data.get('longitude', data.get('lng'))
        if isinstance(latitude, bool) or isinstance(longitude, bool):
            return
        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (TypeError, ValueError):
            return
        if (
            not math.isfinite(latitude)
            or not math.isfinite(longitude)
            or not -90 <= latitude <= 90
            or not -180 <= longitude <= 180
        ):
            return

        ride_status = await self.get_ride_status()
        if role == 'passenger' and ride_status not in (
            Ride.Status.ACCEPTED,
            Ride.Status.DRIVER_ARRIVING,
        ):
            return
        if role == 'driver' and ride_status not in (
            Ride.Status.ACCEPTED,
            Ride.Status.DRIVER_ARRIVING,
            Ride.Status.DRIVER_AT_PICKUP,
            Ride.Status.IN_PROGRESS,
            Ride.Status.ARRIVED_AT_DESTINATION,
        ):
            return

        await self.channel_layer.group_send(
            self.driver_location_group_name if role == 'driver' else self.passenger_location_group_name,
            {
                'type': f'{role}_location_updated',
                'data': {
                    'latitude': latitude,
                    'longitude': longitude,
                    'user_id': self.user.id,
                },
            }
        )

    @database_sync_to_async
    def get_ride_status(self):
        return Ride.objects.filter(id=self.ride_id).values_list('status', flat=True).first()

    @database_sync_to_async
    def cancel_ride(self, ride_id):
        Ride.objects.filter(id=ride_id).update(status='CANCELLED_BY_PASSENGER')

    @database_sync_to_async
    def update_ride_status(self, ride_id, status_val):
        Ride.objects.filter(id=ride_id).update(status=status_val)

    async def participant_joined(self, event):
        await self.send_json({
            'type': 'participant_joined',
            'data': event.get('participant', event.get('data')),
        })

    async def ride_cancelled(self, event):
        await self.send_json({
            'type': 'ride_cancelled',
            'data': event.get('data', {'ride_id': event.get('ride_id'), 'status': 'CANCELLED'}),
        })

    async def ride_completed(self, event):
        await self.send_json({
            'type': 'ride_completed',
            'data': event.get('data', {'ride_id': event.get('ride_id'), 'status': 'COMPLETED'}),
        })

    async def ride_accepted(self, event):
        await self.send_json({
            'type': 'ride_accepted',
            'data': event.get('data', {'ride_id': event.get('ride_id'), 'status': 'ACCEPTED'}),
        })

    async def ride_status_updated(self, event):
        await self.send_json({
            'type': 'ride_status_updated',
            'data': event.get('data', {'ride_id': event.get('ride_id'), 'status': event.get('status')}),
        })

    async def driver_location_updated(self, event):
        await self.send_json({
            'type': 'driver_location_updated',
            'data': event.get('data', event),
        })

    async def passenger_location_updated(self, event):
        await self.send_json({
            'type': 'passenger_location_updated',
            'data': event.get('data', event),
        })

    async def ride_rated(self, event):
        await self.send_json({
            'type': 'ride_rated',
            'data': event.get('data', {'ride_id': event.get('ride_id')}),
        })


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        user_id = self.user.id if self.user and self.user.is_authenticated else self.scope.get('url_route', {}).get('kwargs', {}).get('user_id')
        
        self.group_name = f'notifications_{user_id}' if user_id else 'notifications_general'
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def send_notification(self, event):
        await self.send_json({
            'type': 'notification',
            'data': event.get('data', event),
        })
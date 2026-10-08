import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from core.models import Ride, SharedRide, SharedRideParticipant

User = get_user_model()

class RideConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.ride_id = self.scope['url_route']['kwargs']['ride_id']
        self.room_group_name = f'ride_{self.ride_id}'
        self.user = self.scope.get('user')

        await self.channel_layer.group_add(
            self.room_group_name,
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
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive_json(self, content, **kwargs):
        action = content.get('action') or content.get('type')
        data = content.get('data', {})

        if action == 'ping':
            await self.send_json({'type': 'pong'})
        elif action == 'join_ride':
            await self.handle_join_ride(data)
        elif action == 'cancel_ride':
            await self.handle_cancel_ride(data)
        elif action == 'update_status':
            await self.handle_update_status(data)
        elif action == 'driver_location':
            await self.handle_driver_location(data)

    async def handle_join_ride(self, data):
        participant = await self.create_participant(data)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'participant_joined',
                'participant': participant,
            }
        )

    async def handle_cancel_ride(self, data):
        ride_id = data.get('ride_id', self.ride_id)
        await self.cancel_ride(ride_id)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'ride_cancelled',
                'data': {'ride_id': ride_id, 'status': 'CANCELLED'},
            }
        )

    async def handle_update_status(self, data):
        ride_id = data.get('ride_id', self.ride_id)
        new_status = data.get('status')
        await self.update_ride_status(ride_id, new_status)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'ride_status_updated',
                'data': {'ride_id': ride_id, 'status': new_status},
            }
        )

    async def handle_driver_location(self, data):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'driver_location_updated',
                'data': data,
            }
        )

    @database_sync_to_async
    def create_participant(self, data):
        ride = Ride.objects.get(id=data['ride_id'])
        shared_ride, _ = SharedRide.objects.get_or_create(
            primary_ride=ride,
            defaults={'capacity': 4, 'available_seats': 3, 'status': 'SHAREABLE'}
        )
        passenger = User.objects.get(id=data['passenger_id'])
        participant = SharedRideParticipant.objects.create(
            shared_ride=shared_ride,
            passenger=passenger,
            pickup_name=data['pickup_name'],
            pickup_lat=data['pickup_lat'],
            pickup_lng=data['pickup_lng'],
            destination_name=data['destination_name'],
            destination_lat=data['destination_lat'],
            destination_lng=data['destination_lng'],
        )
        shared_ride.available_seats = max(0, shared_ride.available_seats - 1)
        shared_ride.save()
        return {
            'id': participant.id,
            'passenger_id': passenger.id,
            'passenger_name': passenger.username,
            'pickup_name': participant.pickup_name,
            'pickup_lat': participant.pickup_lat,
            'pickup_lng': participant.pickup_lng,
            'allocated_shared_fare': data.get('allocated_shared_fare', 0),
        }

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
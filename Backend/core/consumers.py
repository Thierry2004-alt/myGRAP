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

        if self.user and self.user.is_authenticated:
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive_json(self, content, **kwargs):
        action = content.get('action')
        data = content.get('data', {})

        if action == 'join_ride':
            await self.handle_join_ride(data)
        elif action == 'cancel_ride':
            await self.handle_cancel_ride(data)

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
        await self.cancel_ride(data.get('ride_id'))
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'ride_cancelled',
                'ride_id': data.get('ride_id'),
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
        shared_ride.available_seats -= 1
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
        Ride.objects.filter(id=ride_id).update(status='CANCELLED')

    async def participant_joined(self, event):
        await self.send_json({
            'type': 'participant_joined',
            'data': event['participant'],
        })

    async def ride_cancelled(self, event):
        await self.send_json({
            'type': 'ride_cancelled',
            'data': {'ride_id': event['ride_id']},
        })


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get('user')
        if self.user and self.user.is_authenticated:
            self.group_name = f'notifications_{self.user.id}'
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def send_notification(self, event):
        await self.send_json({
            'type': 'notification',
            'data': event['data'],
        })
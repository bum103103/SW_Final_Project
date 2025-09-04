import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Marker, Message
from accounts.models import User


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for chat functionality"""

    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'

        # Get user from scope
        self.user = self.scope.get('user', AnonymousUser())
        
        # 디버깅을 위한 로그
        print(f"WebSocket connect attempt - Room: {self.room_id}, User: {self.user}")
        
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            print(f"WebSocket connection rejected - User not authenticated: {self.user}")
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        print(f"WebSocket connection accepted - Room: {self.room_id}, User: {self.user.username}")

        # Notify others that user joined
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'user': self.user.username,
                'message': f'{self.user.username}님이 입장했습니다.'
            }
        )

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Notify others that user left
        if hasattr(self, 'user') and self.user.is_authenticated:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_left',
                    'user': self.user.username,
                    'message': f'{self.user.username}님이 퇴장했습니다.'
                }
            )

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'message')

            if message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type == 'location_update':
                await self.handle_location_update(data)
            elif message_type == 'marker_update':
                await self.handle_marker_update(data)

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
            }))

    async def handle_chat_message(self, data):
        """Handle chat message"""
        message_text = data.get('message', '').strip()
        if not message_text:
            return

        # Save message to database
        message_obj = await self.save_message(message_text)

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message_text,
                'user': self.user.username,
                'timestamp': message_obj.timestamp.isoformat(),
                'message_id': str(message_obj.id)
            }
        )

    async def handle_location_update(self, data):
        """Handle location update"""
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if latitude is not None and longitude is not None:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'location_update',
                    'user': self.user.username,
                    'latitude': latitude,
                    'longitude': longitude
                }
            )

    async def handle_marker_update(self, data):
        """Handle marker update"""
        # This would handle marker position updates
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'marker_update',
                'user': self.user.username,
                'data': data
            }
        )

    # Event handlers
    async def chat_message(self, event):
        """Send chat message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'user': event['user'],
            'timestamp': event['timestamp'],
            'message_id': event['message_id']
        }))

    async def user_joined(self, event):
        """Send user joined notification"""
        await self.send(text_data=json.dumps({
            'type': 'user_joined',
            'user': event['user'],
            'message': event['message']
        }))

    async def user_left(self, event):
        """Send user left notification"""
        await self.send(text_data=json.dumps({
            'type': 'user_left',
            'user': event['user'],
            'message': event['message']
        }))

    async def location_update(self, event):
        """Send location update"""
        await self.send(text_data=json.dumps({
            'type': 'location_update',
            'user': event['user'],
            'latitude': event['latitude'],
            'longitude': event['longitude']
        }))

    async def marker_update(self, event):
        """Send marker update"""
        await self.send(text_data=json.dumps({
            'type': 'marker_update',
            'user': event['user'],
            'data': event['data']
        }))

    @database_sync_to_async
    def save_message(self, message_text):
        """Save message to database"""
        return Message.objects.create(
            username=self.user,
            text=message_text,
            room_id=self.room_id
        )

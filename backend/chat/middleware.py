from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from django.db import close_old_connections

User = get_user_model()


@database_sync_to_async
def get_user(token_key):
    """Get user from JWT token"""
    try:
        print(f"Attempting to validate token: {token_key[:20]}...")
        access_token = AccessToken(token_key)
        user = User.objects.get(id=access_token.payload['user_id'])
        print(f"Token validation successful for user: {user.username}")
        return user
    except Exception as e:
        print(f"Token validation failed: {str(e)}")
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """JWT Authentication middleware for Django Channels"""

    def __init__(self, inner):
        super().__init__(inner)

    async def __call__(self, scope, receive, send):
        # Close old database connections to prevent usage of timed out connections
        close_old_connections()

        # Get token from query parameters
        query_params = dict((x.split('=') for x in scope['query_string'].decode().split('&') if '=' in x))
        token = query_params.get('token')
        
        print(f"WebSocket middleware - Token found: {bool(token)}")

        if token:
            scope['user'] = await get_user(token)
        else:
            print("WebSocket middleware - No token provided")
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)

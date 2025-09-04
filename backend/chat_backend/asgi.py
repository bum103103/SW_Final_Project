"""
ASGI config for chat_backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
import logging
import django

# 환경 변수 설정을 가장 먼저 수행
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_backend.settings')

# Django 초기화 (앱 레지스트리 준비)
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from chat.middleware import JWTAuthMiddleware
from chat import routing as chat_routing

# 로깅 설정
logger = logging.getLogger(__name__)

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": JWTAuthMiddleware(
        URLRouter(
            chat_routing.websocket_urlpatterns
        )
    ),
})

# ASGI 애플리케이션 로드 확인
logger.info("ASGI application loaded successfully")
logger.info(f"WebSocket URL patterns: {chat_routing.websocket_urlpatterns}")
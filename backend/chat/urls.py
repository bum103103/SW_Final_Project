from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'chat'

router = DefaultRouter()
router.register(r'markers', views.MarkerViewSet, basename='marker')

urlpatterns = [
    path('', include(router.urls)),
    path('messages/', views.MessageListCreateView.as_view(), name='message_list'),
    path('rooms/<str:room_id>/info/', views.get_room_info, name='room_info'),
    path('rooms/<str:room_id>/join/', views.join_room, name='join_room'),
    path('rooms/<str:room_id>/leave/', views.leave_room, name='leave_room'),
    path('user-markers/', views.get_user_markers, name='user_markers'),
]

from rest_framework import viewsets, status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from .models import Marker, Message
from .serializers import MarkerSerializer, MarkerCreateSerializer, MessageSerializer


class MarkerViewSet(viewsets.ModelViewSet):
    """Marker CRUD operations"""

    queryset = Marker.objects.all()
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    lookup_url_kwarg = 'pk'

    def get_serializer_class(self):
        if self.action == 'create':
            return MarkerCreateSerializer
        return MarkerSerializer

    def get_object(self):
        queryset = self.get_queryset()
        lookup_value = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        # 디버깅용 로그
        print(f"MarkerViewSet.get_object lookup_value={lookup_value}")
        obj = get_object_or_404(queryset, id=str(lookup_value))
        self.check_object_permissions(self.request, obj)
        return obj

    def get_queryset(self):
        queryset = Marker.objects.select_related('created_by')
        marker_type = self.request.query_params.get('type', None)
        if marker_type:
            queryset = queryset.filter(type=marker_type)
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)

        # Add user count for each marker (mock data for now)
        for marker_data in serializer.data:
            marker_data['user_count'] = 0  # This will be updated with WebSocket

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        marker: Marker = self.get_object()
        if marker.created_by_id != request.user.id:
            return Response({'detail': '삭제 권한이 없습니다.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class MessageListCreateView(generics.ListCreateAPIView):
    """Message list and create operations"""

    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        room_id = self.request.query_params.get('room_id')
        if room_id:
            return Message.objects.filter(room_id=room_id).select_related('username')
        return Message.objects.none()

    def perform_create(self, serializer):
        room_id = self.request.data.get('room_id')
        if not room_id:
            return Response({'error': 'room_id is required'},
                          status=status.HTTP_400_BAD_REQUEST)
        serializer.save(username=self.request.user, room_id=room_id)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_room_info(request, room_id):
    """Get room information"""
    try:
        marker = get_object_or_404(Marker, id=room_id)
        # Mock user data - this will be replaced with WebSocket user tracking
        users = [marker.created_by.username]  # Creator is always in room

        return Response({
            'room_id': room_id,
            'user_count': len(users),
            'max_users': marker.max_number,
            'marker_title': marker.title,
            'users': users
        })
    except Marker.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_room(request, room_id):
    """Join a room"""
    try:
        marker = get_object_or_404(Marker, id=room_id)

        # Check if room is full (simplified - WebSocket will handle this properly)
        # For now, just return success
        return Response({
            'message': f'Joined room {room_id}',
            'marker': MarkerSerializer(marker).data
        })
    except Marker.DoesNotExist:
        return Response({'error': 'Room not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_room(request, room_id):
    """Leave a room"""
    return Response({'message': f'Left room {room_id}'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_markers(request):
    """Get markers created by current user"""
    markers = Marker.objects.filter(created_by=request.user)
    serializer = MarkerSerializer(markers, many=True)
    return Response(serializer.data)
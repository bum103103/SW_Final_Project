from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils import timezone
from .models import User
from .serializers import UserSerializer, LoginSerializer, UserProfileSerializer


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """User registration endpoint"""
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': '회원가입이 완료되었습니다.'
        }, status=status.HTTP_201_CREATED)
    # 실패 원인 로깅
    print('Register validation errors:', serializer.errors)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """User login endpoint"""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']

        # Update user status to online
        user.status = 1
        user.save(update_fields=['status'])

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'message': '로그인에 성공했습니다.'
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """User logout endpoint"""
    try:
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()

        # Update user status to offline
        request.user.status = 0
        request.user.save(update_fields=['status'])

        return Response({'message': '로그아웃되었습니다.'})
    except Exception as e:
        return Response({'error': '로그아웃 처리 중 오류가 발생했습니다.'},
                       status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """User profile view"""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        # Only allow status update for now
        serializer.save()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def online_users_view(request):
    """Get list of online users"""
    online_users = User.objects.filter(status=1).exclude(id=request.user.id)
    serializer = UserProfileSerializer(online_users, many=True)
    return Response(serializer.data)
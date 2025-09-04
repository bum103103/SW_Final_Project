from rest_framework import serializers
from .models import Marker, Message


class MarkerSerializer(serializers.ModelSerializer):
    """Marker serializer"""

    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Marker
        fields = ('id', 'title', 'created_by', 'created_by_username', 'context',
                 'latitude', 'longitude', 'max_number', 'type', 'image',
                 'created_at', 'user_count')
        read_only_fields = ('id', 'created_at', 'created_by')

    def get_user_count(self, obj):
        # This will be populated by the view
        return getattr(obj, 'user_count', 0)

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class MarkerCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating markers"""

    class Meta:
        model = Marker
        fields = ('title', 'context', 'latitude', 'longitude',
                 'max_number', 'type', 'image')

    def create(self, validated_data):
        # 서버에서만 created_by, id를 설정
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class MessageSerializer(serializers.ModelSerializer):
    """Message serializer"""

    username = serializers.CharField(source='username.username', read_only=True)

    class Meta:
        model = Message
        fields = ('id', 'username', 'text', 'room_id', 'timestamp')
        read_only_fields = ('id', 'timestamp', 'username')

    def create(self, validated_data):
        validated_data['username'] = self.context['request'].user
        return super().create(validated_data)


class RoomInfoSerializer(serializers.Serializer):
    """Room information serializer"""

    room_id = serializers.CharField()
    user_count = serializers.IntegerField()
    max_users = serializers.IntegerField()
    marker_title = serializers.CharField()
    users = serializers.ListField(child=serializers.CharField())

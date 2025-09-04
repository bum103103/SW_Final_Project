from django.contrib import admin
from .models import Marker, Message


@admin.register(Marker)
class MarkerAdmin(admin.ModelAdmin):
    """Admin for Marker model"""

    list_display = ('title', 'created_by', 'type', 'max_number', 'created_at')
    list_filter = ('type', 'created_at', 'max_number')
    search_fields = ('title', 'created_by__username', 'context')
    readonly_fields = ('id', 'created_at')
    ordering = ('-created_at',)

    fieldsets = (
        (None, {
            'fields': ('id', 'title', 'created_by')
        }),
        ('Location & Settings', {
            'fields': ('latitude', 'longitude', 'max_number', 'type', 'image')
        }),
        ('Content', {
            'fields': ('context',)
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Admin for Message model"""

    list_display = ('username', 'room_id', 'text', 'timestamp')
    list_filter = ('timestamp', 'room_id')
    search_fields = ('username__username', 'text', 'room_id')
    readonly_fields = ('id', 'timestamp')
    ordering = ('-timestamp',)

    fieldsets = (
        (None, {
            'fields': ('id', 'username', 'room_id')
        }),
        ('Content', {
            'fields': ('text',)
        }),
        ('Timestamps', {
            'fields': ('timestamp',),
            'classes': ('collapse',)
        }),
    )

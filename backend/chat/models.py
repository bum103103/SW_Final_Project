from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
import uuid


class Marker(models.Model):
    """Marker model for location-based meeting points"""

    MARKER_TYPES = [
        ('restaurant', 'Restaurant'),
        ('study', 'Study Room'),
        ('person', 'Person'),
        ('etc', 'Etc'),
        ('taxi', 'Taxi'),
        ('school', 'School'),
        ('library', 'Library'),
        ('meet', 'Meeting'),
    ]

    id = models.CharField(
        max_length=255,
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    title = models.CharField(max_length=255)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='markers'
    )
    context = models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    max_number = models.IntegerField()
    type = models.CharField(max_length=255, choices=MARKER_TYPES)
    image = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'markers'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} by {self.created_by.username}"


class Message(models.Model):
    """Chat message model"""

    id = models.CharField(
        max_length=40,
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    username = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    text = models.CharField(max_length=500)
    room_id = models.CharField(max_length=40)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messages'
        ordering = ['timestamp']

    def __str__(self):
        return f"Message by {self.username.username} in {self.room_id}"

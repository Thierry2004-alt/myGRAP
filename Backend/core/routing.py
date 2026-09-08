from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/rides/(?P<ride_id>\w+)/$', consumers.RideConsumer.as_asgi()),
    re_path(r'ws/notifications/$', consumers.NotificationConsumer.as_asgi()),
]
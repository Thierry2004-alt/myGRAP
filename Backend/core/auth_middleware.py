from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


@database_sync_to_async
def authenticate_token(token):
    try:
        authentication = JWTAuthentication()
        validated_token = authentication.get_validated_token(token)
        return authentication.get_user(validated_token)
    except (AuthenticationFailed, InvalidToken, TokenError):
        return AnonymousUser()


class JwtAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get('query_string', b'').decode('utf-8', errors='replace'))
        tokens = query.get('token', [])
        if tokens:
            scope = dict(scope)
            scope['user'] = await authenticate_token(tokens[0])
        return await self.inner(scope, receive, send)

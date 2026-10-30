import logging

from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.session import active_memberships, choose_tenant_after_login, session_payload, set_active_tenant

log = logging.getLogger("accounts")

WRONG_CREDENTIALS = "Usuario o contraseña incorrectos."


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, trim_whitespace=True)
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class ChooseTenantSerializer(serializers.Serializer):
    tenant_id = serializers.UUIDField()


@method_decorator(ensure_csrf_cookie, name="get")
class SessionView(APIView):
    """Who is signed in and in which shop. Also hands out the CSRF cookie (ADR-0006)."""

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        return Response(session_payload(request))


@method_decorator(csrf_protect, name="post")
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request: Request) -> Response:
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = authenticate(request, **data.validated_data)
        if user is None:
            # Same message whether the user or the password was wrong (HU-012).
            log.info("login failed", extra={"username": data.validated_data["username"]})
            return Response({"detail": WRONG_CREDENTIALS}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        choose_tenant_after_login(request)
        return Response(session_payload(request))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        logout(request)
        return Response(session_payload(request))


class ChooseTenantView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        data = ChooseTenantSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        tenant_id = str(data.validated_data["tenant_id"])
        membership = next(
            (m for m in active_memberships(request.user) if str(m.tenant_id) == tenant_id), None
        )
        if membership is None:
            # 404, not 403: we do not confirm that a shop the person cannot see exists (ADR-0003).
            return Response({"detail": "No encontramos ese local."}, status=status.HTTP_404_NOT_FOUND)
        set_active_tenant(request, membership)
        return Response(session_payload(request))

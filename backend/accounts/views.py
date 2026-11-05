import logging

from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts import lockout
from accounts.session import active_memberships, choose_tenant_after_login, session_payload, set_active_tenant

log = logging.getLogger("accounts")

WRONG_CREDENTIALS = "Usuario o contraseña incorrectos."


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, trim_whitespace=True)
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class ChangePasswordSerializer(serializers.Serializer):
    current = serializers.CharField(max_length=128, trim_whitespace=False)
    new = serializers.CharField(max_length=128, trim_whitespace=False)


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

    def post(self, request: Request) -> Response:
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        username = data.validated_data["username"]
        ip = lockout.client_ip(request)
        if lockout.is_locked(username, ip):
            log.info("login locked", extra={"username": username, "ip": ip})
            return Response({"detail": lockout.TOO_MANY}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        # A failure is counted by the user_login_failed signal (accounts.signals).
        user = authenticate(request, **data.validated_data)
        if user is None:
            # Same message whether the user or the password was wrong (HU-012).
            log.info("login failed", extra={"username": username, "ip": ip})
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


@method_decorator(csrf_protect, name="post")
class ChangePasswordView(APIView):
    """A person changes their own password. This device stays signed in; every other session ends."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        data = ChangePasswordSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = request.user
        # Same limit as the login: guessing the current password is just as bad (ADR-0011).
        ip = lockout.client_ip(request)
        if lockout.is_locked(user.get_username(), ip):
            return Response({"detail": lockout.TOO_MANY}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if not user.check_password(data.validated_data["current"]):
            lockout.record_failure(user.get_username(), ip)
            return Response(
                {"current": ["La contraseña actual no es correcta."]}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            validate_password(data.validated_data["new"], user)
        except DjangoValidationError as exc:
            return Response({"new": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(data.validated_data["new"])
        user.save(update_fields=["password"])
        # The session hash changes with the password: other devices are signed out on their next request.
        update_session_auth_hash(request, user)
        log.info("password changed", extra={"user_id": user.pk})
        return Response(status=status.HTTP_204_NO_CONTENT)

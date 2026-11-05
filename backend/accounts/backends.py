from django.contrib.auth.backends import ModelBackend
from django.core.exceptions import PermissionDenied

from accounts import lockout


class LockoutBackend(ModelBackend):
    """The normal user and password check, refused while that user or IP is locked (ADR-0011).

    Every sign in goes through here, the API and the Django admin alike.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if request is not None and username and lockout.is_locked(username, lockout.client_ip(request)):
            # PermissionDenied stops Django from trying other backends and counts as a failure.
            raise PermissionDenied
        return super().authenticate(request, username=username, password=password, **kwargs)

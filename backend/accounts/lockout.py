"""Limit on failed sign ins (ADR-0011).

Counted per user name and per IP, in the database: shared by every server copy, and the user name
part does not depend on headers the caller can make up. Used by the API login, the password change
and the Django admin (through the authentication backend).
"""

import ipaddress
import os
from datetime import timedelta

from django.http import HttpRequest
from django.utils import timezone

from accounts.models import FailedLogin

MAX_PER_USER = int(os.environ.get("LOGIN_MAX_FAILURES", "10"))
MAX_PER_IP = int(os.environ.get("LOGIN_MAX_FAILURES_PER_IP", "50"))
WINDOW = timedelta(minutes=int(os.environ.get("LOGIN_LOCK_MINUTES", "15")))
# How many proxies in front of the app add themselves to X-Forwarded-For. Cloud Run alone: 1.
# With a load balancer in front (custom domain): 2. Locally, with no proxy: 0.
TRUSTED_PROXY_HOPS = int(os.environ.get("TRUSTED_PROXY_HOPS", "0"))

TOO_MANY = "Demasiados intentos. Esperá unos minutos y probá de nuevo."


def client_ip(request: HttpRequest) -> str | None:
    """The caller's IP, or None if we cannot know it for sure.

    X-Forwarded-For is a list the caller can start with anything. Only the entries added by our own
    proxies are trusted, counted from the end. Without proxies, it is ignored.
    """
    if TRUSTED_PROXY_HOPS > 0:
        hops = [h.strip() for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
        candidate = hops[-TRUSTED_PROXY_HOPS] if len(hops) >= TRUSTED_PROXY_HOPS else None
    else:
        candidate = request.META.get("REMOTE_ADDR")
    try:
        return str(ipaddress.ip_address(candidate)) if candidate else None
    except ValueError:
        return None


def _key(username: str) -> str:
    return (username or "").strip().lower()[:150]


def is_locked(username: str, ip: str | None) -> bool:
    since = timezone.now() - WINDOW
    if FailedLogin.objects.filter(username=_key(username), at__gte=since).count() >= MAX_PER_USER:
        return True
    # The IP limit only makes sense when the IP is trustworthy: behind Cloud Run without the hops
    # setting, every caller would share the same address and one person could lock everyone out.
    if ip and TRUSTED_PROXY_HOPS > 0:
        return FailedLogin.objects.filter(ip=ip, at__gte=since).count() >= MAX_PER_IP
    return False


def record_failure(username: str, ip: str | None) -> None:
    FailedLogin.objects.create(username=_key(username), ip=ip)
    # Keep the table small: nothing older than a day is ever counted.
    FailedLogin.objects.filter(at__lt=timezone.now() - timedelta(days=1)).delete()


def clear(username: str) -> None:
    FailedLogin.objects.filter(username=_key(username)).delete()

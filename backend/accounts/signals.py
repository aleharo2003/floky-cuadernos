from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.dispatch import receiver

from accounts import lockout


@receiver(user_login_failed)
def count_failure(sender, credentials, request=None, **kwargs):
    """Every failed sign in counts, from the API or from the admin."""
    lockout.record_failure(credentials.get("username", ""), lockout.client_ip(request) if request else None)


@receiver(user_logged_in)
def forget_failures(sender, request, user, **kwargs):
    lockout.clear(user.get_username())

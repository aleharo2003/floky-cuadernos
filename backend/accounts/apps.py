from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = "accounts"
    verbose_name = "Personas y membresías"

    def ready(self):
        from accounts import signals  # noqa: F401 - connects the sign in counters

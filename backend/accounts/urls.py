from django.urls import path

from accounts.views import ChooseTenantView, LoginView, LogoutView, SessionView

urlpatterns = [
    path("session/", SessionView.as_view(), name="session"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("tenant/", ChooseTenantView.as_view(), name="choose-tenant"),
]

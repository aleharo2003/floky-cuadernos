from django.contrib import admin
from django.urls import path, re_path

from config.views import spa
from core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    # Everything that is not the API, the admin or a static file is the React portal (ADR-0006).
    re_path(r"^(?!api/|admin/|static/).*$", spa, name="spa"),
]

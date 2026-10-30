import os

from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request: Request) -> Response:
    """Used by the smoke test and the hosting health check. Says nothing about the data."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        database = "ok"
    except Exception:  # noqa: BLE001 - any database error means "not ok" here
        database = "error"
    status = 200 if database == "ok" else 503
    body = {
        "status": "ok" if status == 200 else "error",
        "database": database,
        "version": os.environ.get("APP_VERSION", "dev"),
    }
    return Response(body, status=status)

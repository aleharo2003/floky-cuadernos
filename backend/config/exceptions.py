"""How the API reports errors. Adds a short code so the portal can react without reading text."""

from rest_framework import exceptions
from rest_framework.views import exception_handler

SESSION_ENDED = "Tu sesión se cerró. Volvé a ingresar."


def handler(exc, context):
    # DRF's own text for this one is in "usted" and says nothing useful to the person. The same
    # object is kept: DRF already set its status (403 with session auth).
    if isinstance(exc, exceptions.NotAuthenticated):
        exc.detail = exceptions.ErrorDetail(SESSION_ENDED, code="not_authenticated")
    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict) and "detail" in response.data:
        codes = exc.get_codes() if isinstance(exc, exceptions.APIException) else None
        if isinstance(codes, str):
            response.data["code"] = codes
    return response

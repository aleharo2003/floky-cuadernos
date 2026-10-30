from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET


@require_GET
@ensure_csrf_cookie
def spa(request: HttpRequest) -> HttpResponse:
    """Return the React portal. React Router handles the path in the browser.

    The CSRF cookie is set here so the portal can send it back on every write (ADR-0006).
    """
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse(
            "The portal is not built. Run `npm run build` in frontend/.",
            status=503,
            content_type="text/plain; charset=utf-8",
        )
    return HttpResponse(index.read_text(encoding="utf-8"), content_type="text/html; charset=utf-8")

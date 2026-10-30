import pytest
from django.test import Client, override_settings


@pytest.fixture
def built_portal(tmp_path):
    (tmp_path / "index.html").write_text("<!doctype html><div id=root></div>", encoding="utf-8")
    with override_settings(FRONTEND_DIST=tmp_path):
        yield


@pytest.mark.parametrize("path", ["/", "/cuadernos", "/cuadernos/2026/10"])
def test_any_portal_path_returns_index_with_csrf_cookie(built_portal, path: str) -> None:
    response = Client().get(path)

    assert response.status_code == 200
    assert b"id=root" in response.content
    assert "csrftoken" in response.cookies


def test_api_paths_are_not_swallowed_by_the_portal(built_portal) -> None:
    response = Client().get("/api/does-not-exist/")

    assert response.status_code == 404


def test_missing_build_is_a_clear_error(tmp_path) -> None:
    with override_settings(FRONTEND_DIST=tmp_path):
        response = Client().get("/")

    assert response.status_code == 503

"""Dependencies go one way: notebooks -> accounts -> core (ADR-0001, ADR-0002).

core and accounts must not know that notebooks exist, so they can be reused in another product.
"""

import ast
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
FORBIDDEN = {"core": {"accounts", "notebooks"}, "accounts": {"notebooks"}}


def imported_top_modules(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names |= {alias.name.split(".")[0] for alias in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names.add(node.module.split(".")[0])
    return names


@pytest.mark.parametrize("app", sorted(FORBIDDEN))
def test_app_does_not_import_apps_that_depend_on_it(app: str) -> None:
    offenders = []
    for path in (BACKEND / app).rglob("*.py"):
        wrong = imported_top_modules(path) & FORBIDDEN[app]
        if wrong:
            offenders.append(f"{path.relative_to(BACKEND)} imports {sorted(wrong)}")

    assert offenders == []

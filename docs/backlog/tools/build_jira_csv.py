"""Build jira-import.csv from 01-epicas-y-stories.md.

The Markdown file is the source of truth. Run this script after editing it:

    python docs/backlog/tools/build_jira_csv.py

Epics get Issue Id 1000 + their number (E10 -> 1010). Stories use their HU
number (HU-233 -> 233) and point to their epic with Parent Id.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

BACKLOG_DIR = Path(__file__).resolve().parent.parent
SOURCE = BACKLOG_DIR / "01-epicas-y-stories.md"
TARGET = BACKLOG_DIR / "jira-import.csv"

PRIORITY = {"Must": "High", "Should": "Medium", "Could": "Low"}
MAX_LABELS = 9

EPIC_RE = re.compile(r"^## (E(\d+))\. (.+)$")
STORY_RE = re.compile(r"^### (HU-(\d+))\. (.+)$")
META_RE = re.compile(r"^\*\*Prioridad:\*\*")


def to_jira_markup(text: str) -> str:
    """Convert the small Markdown subset we use to Jira wiki markup."""
    text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
    text = re.sub(r"`([^`]+)`", r"{{\1}}", text)
    return text.strip()


def parse_meta(line: str) -> dict[str, str]:
    meta = {}
    for part in line.split(" · "):
        match = re.match(r"\*\*(.+?):\*\* (.+)", part.strip())
        if match:
            meta[match.group(1)] = match.group(2).strip()
    return meta


def version_label(meta: dict[str, str]) -> str:
    version = meta.get("Versión", "MVP").lower()
    if version.startswith("v2"):
        return "v2"
    if version.startswith("v1"):
        return "v1x"
    return "mvp"


def build_rows() -> list[list[str]]:
    rows: list[list[str]] = []
    epic_id = ""
    current: dict | None = None

    def flush() -> None:
        if current is None:
            return
        body = "\n".join(current["body"]).strip()
        body = body.split("\n---")[0].strip()
        if current["diagrams"]:
            body += f"\n\nDiagramas: {current['diagrams']} (docs/diagramas/)"
        labels = current["labels"][:MAX_LABELS]
        labels += [""] * (MAX_LABELS - len(labels))
        rows.append(
            [
                current["id"],
                current["parent"],
                current["type"],
                current["summary"],
                to_jira_markup(body),
                current["priority"],
                *labels,
            ]
        )

    for line in SOURCE.read_text(encoding="utf-8").splitlines():
        epic = EPIC_RE.match(line)
        story = STORY_RE.match(line)
        if epic:
            flush()
            epic_id = str(1000 + int(epic.group(2)))
            title = epic.group(3)
            version = "v2" if "(v2)" in title else "mvp"
            current = {
                "id": epic_id,
                "parent": "",
                "type": "Epic",
                "summary": f"{epic.group(1)}. {title}",
                "priority": "",
                "labels": [version],
                "diagrams": "",
                "body": [],
            }
        elif story:
            flush()
            current = {
                "id": str(int(story.group(2))),
                "parent": epic_id,
                "type": "Story",
                "summary": f"{story.group(1)}. {story.group(3)}",
                "priority": "",
                "labels": [],
                "diagrams": "",
                "body": [],
            }
        elif current is not None and current["type"] == "Story" and META_RE.match(line):
            meta = parse_meta(line)
            current["priority"] = PRIORITY.get(meta.get("Prioridad", ""), "")
            tags = re.findall(r"`([^`]+)`", meta.get("Etiquetas", ""))
            moscow = meta.get("Prioridad", "").lower()
            current["labels"] = [version_label(meta), moscow, *tags] if moscow else [version_label(meta), *tags]
            current["diagrams"] = meta.get("Diagramas", "")
        elif current is not None:
            current["body"].append(line)
    flush()
    return rows


def main() -> None:
    header = ["Issue Id", "Parent Id", "Issue Type", "Summary", "Description", "Priority"]
    header += ["Labels"] * MAX_LABELS
    rows = build_rows()
    with TARGET.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)
    epics = sum(1 for row in rows if row[2] == "Epic")
    print(f"Wrote {TARGET.name}: {epics} epics, {len(rows) - epics} stories")


if __name__ == "__main__":
    main()

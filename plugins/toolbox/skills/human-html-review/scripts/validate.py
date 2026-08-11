#!/usr/bin/env python3
"""Validate the structural and safety contract of a human HTML review."""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


MAX_BYTES = 16 * 1024 * 1024
REQUIRED_SECTIONS = {
    "review-contract",
    "causal-timeline",
    "target-model",
    "verification",
    "decision",
    "decision-outcome",
}
REQUIRED_MODELS = {"structure", "behavior", "data"}
FORBIDDEN_TAGS = {"script", "iframe", "form", "object", "embed"}
# TODO/PLACEHOLDER は大文字のマーカーのみ検出する。IGNORECASE にすると
# パス表記 (ideas/todo/ 等) の小文字 todo まで誤検出する (2026-08-11 実害)
PLACEHOLDER_RE = re.compile(r"\{\{[^}]+\}\}|\b(?:TODO|PLACEHOLDER)\b")


class ReviewParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tags: set[str] = set()
        self.sections: set[str] = set()
        self.models: set[str] = set()
        self.evidence_states: set[str] = set()
        self.options: set[str] = set()
        self.option_outcomes: set[str] = set()
        self.decision_actions: set[str] = set()
        self.mode_panels: set[str] = set()
        self.forbidden: list[str] = []
        self.external_assets: list[str] = []
        self.mode: str | None = None
        self.source_revision: str | None = None
        self.lang: str | None = None
        self.has_charset = False
        self.has_viewport = False
        self.has_title = False
        self.title_depth = 0
        self.svg_count = 0
        self.figcaption_count = 0

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs = {key.lower(): value or "" for key, value in attrs_list}
        self.tags.add(tag)

        if tag in FORBIDDEN_TAGS:
            self.forbidden.append(tag)
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag == "body":
            self.mode = attrs.get("data-decision-mode") or self.mode
        if tag == "main":
            self.source_revision = attrs.get("data-source-revision") or self.source_revision
        if tag == "meta":
            self.has_charset = self.has_charset or "charset" in attrs
            self.has_viewport = self.has_viewport or attrs.get("name", "").lower() == "viewport"
        if tag == "title":
            self.title_depth += 1
        if tag == "svg":
            self.svg_count += 1
        if tag == "figcaption":
            self.figcaption_count += 1

        section = attrs.get("data-review-section")
        if section:
            self.sections.add(section)
        model = attrs.get("data-model")
        if model:
            self.models.add(model)
        state = attrs.get("data-evidence-state")
        if state:
            self.evidence_states.add(state)
        option = attrs.get("data-option")
        if option:
            self.options.add(option)
        outcome = attrs.get("data-option-outcome")
        if outcome:
            self.option_outcomes.add(outcome)
        action = attrs.get("data-decision-action")
        if action:
            self.decision_actions.add(action)
        mode_panel = attrs.get("data-mode-panel")
        if mode_panel:
            self.mode_panels.add(mode_panel)

        src = attrs.get("src", "").strip()
        if src and not src.startswith("data:"):
            self.external_assets.append(f"<{tag} src=\"{src}\">")
        if tag == "link" and attrs.get("href"):
            self.external_assets.append(f"<link href=\"{attrs['href']}\">")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title" and self.title_depth:
            self.title_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.title_depth and data.strip():
            self.has_title = True


def validate(path: Path) -> list[str]:
    errors: list[str] = []
    if not path.is_file():
        return [f"file not found: {path}"]
    if path.suffix.lower() not in {".html", ".htm"}:
        errors.append("output must use .html or .htm")
    size = path.stat().st_size
    if size > MAX_BYTES:
        errors.append(f"file exceeds 16 MiB: {size} bytes")

    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return errors + ["file must be UTF-8"]

    if PLACEHOLDER_RE.search(text):
        errors.append("unresolved template placeholder or TODO remains")
    if re.search(r"@import\s|url\(\s*['\"]?https?://", text, re.IGNORECASE):
        errors.append("external CSS resource detected")

    parser = ReviewParser()
    try:
        parser.feed(text)
    except Exception as exc:  # HTMLParser is permissive; surface unexpected parser failures.
        errors.append(f"HTML parse failure: {exc}")
        return errors

    if parser.lang not in {"ja", "en"}:
        errors.append("<html lang> must be ja or en")
    if not parser.has_charset:
        errors.append("missing <meta charset>")
    if not parser.has_viewport:
        errors.append("missing viewport meta")
    if not parser.has_title:
        errors.append("missing non-empty <title>")
    if parser.forbidden:
        errors.append("forbidden tags: " + ", ".join(sorted(set(parser.forbidden))))
    if parser.external_assets:
        errors.append("non-self-contained assets: " + ", ".join(parser.external_assets))

    missing_sections = REQUIRED_SECTIONS - parser.sections
    if missing_sections:
        errors.append("missing review sections: " + ", ".join(sorted(missing_sections)))
    missing_models = REQUIRED_MODELS - parser.models
    if missing_models:
        errors.append("missing target models: " + ", ".join(sorted(missing_models)))
    if parser.svg_count < 3:
        errors.append("at least three inline SVG diagrams are required")
    if parser.figcaption_count < 3:
        errors.append("each target-model diagram needs a figcaption")
    if not parser.evidence_states:
        errors.append("at least one data-evidence-state is required")
    if parser.mode not in {"approval", "selection"}:
        errors.append("body data-decision-mode must be approval or selection")
    elif parser.mode_panels != {parser.mode}:
        errors.append(
            "keep only the declared decision panel; found: "
            + (", ".join(sorted(parser.mode_panels)) or "none")
        )
    if not parser.source_revision:
        errors.append("main data-source-revision is required; use unknown when unavailable")

    if parser.mode == "selection":
        if len(parser.options) < 2:
            errors.append("selection mode requires at least two data-option values")
        missing_outcomes = parser.options - parser.option_outcomes
        if missing_outcomes:
            errors.append("options without data-option-outcome: " + ", ".join(sorted(missing_outcomes)))
    elif parser.mode == "approval":
        required_actions = {"approve", "request-changes"}
        missing_actions = required_actions - parser.decision_actions
        if missing_actions:
            errors.append("approval mode missing actions: " + ", ".join(sorted(missing_actions)))

    return errors


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("html", type=Path, help="review HTML to validate")
    args = ap.parse_args()
    errors = validate(args.html.expanduser().resolve())
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("VALID")
    return 0


if __name__ == "__main__":
    sys.exit(main())

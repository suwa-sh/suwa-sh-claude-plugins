#!/usr/bin/env python3
"""human-html-review の出力を検査する。

ERROR: 自己完結性・必須 3 部品・図のアクセシビリティ。1 件でもあれば exit 1。
WARN : 読みやすさの原則 (内部 ID / 長い段落 / 図解不足 / 幅不足)。直すか、残す理由を報告する。
"""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

MAX_BYTES = 16 * 1024 * 1024
FORBIDDEN_TAGS = {"iframe", "form", "object", "embed"}
# 通信・外部読み込みを行う JS は禁止 (回答の組み立てとコピーだけを許す)
NETWORK_JS_RE = re.compile(
    r"\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\s*\(|navigator\.sendBeacon|import\s*\("
)
REQUIRED_ROLES = {"context", "ask", "reply"}
TEXT_BLOCKS = {"p", "li", "td", "th", "dd"}
# ID 検査で子要素をまたいで連結する単位 (見出し・ラベル類を含む)
ID_UNIT_TAGS = TEXT_BLOCKS | {"h1", "h2", "h3", "h4", "dt", "figcaption", "summary"}
# pre = コマンド・回答例。code (inline) は本文とみなして ID 検査の対象にする
SKIP_ID_TAGS = {"pre", "kbd", "samp", "style", "script"}
SVG_TEXT_TAGS = {"text", "tspan", "textpath"}
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}
# TODO/PLACEHOLDER は大文字のみ検出 (小文字はパス表記に混ざるため)
PLACEHOLDER_RE = re.compile(r"\{\{[^}]+\}\}|\b(?:TODO|PLACEHOLDER)\b")
# 内部 ID らしき文字列: UC-06 / PR-12 / S3 / fd678b04 (a-f を含む 7 桁以上の 16 進)
# 境界は ASCII の英数字・記号だけで判定する (日本語に直接つながる ID も拾う)
ID_RE = re.compile(
    r"(?<![A-Za-z0-9_/.:#-])(?:[A-Z]{1,5}-\d{1,5}|[A-Z]\d{1,2}|(?=[0-9]*[a-f])[0-9a-f]{7,40})(?![A-Za-z0-9_/.:-])"
)
ID_ALLOW = {"UTF-8", "H1", "H2", "H3", "S3", "EC2", "P0", "P1", "P2", "V1", "V2"}
SENTENCE_END_RE = re.compile(r"[。．.!?！？](?=\s|$)|[。！？]")
MAX_SENTENCES = 3
LONG_PARAGRAPH = 160
LONG_CELL = 220
MIN_CONTENT_MAX = 1400


class ReviewParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lang: str | None = None
        self.has_charset = False
        self.has_viewport = False
        self.title_text = ""
        self.forbidden: list[str] = []
        self.external: list[str] = []
        self.roles: dict[str, int] = {}
        self.h2_count = 0
        self.copy_buttons_in_reply = 0
        self.element_ids: dict[str, int] = {}
        self.bad_note_tags: list[str] = []
        self.copy_targets: list[str] = []
        self.copy_btn_bad_tags: list[str] = []
        self.scripts: list[dict] = []        # {"attrs": dict, "content": str}
        self.self_closing_scripts = 0
        self.builders: list[dict] = []       # {"out": int, "inputs": int}
        self.reply_out_total = 0
        self.reply_inputs_outside = 0
        self.radio_groups: dict[str, set[int]] = {}  # name -> fieldset の識別子の集合
        self._fieldset_seq = 0
        self.long_blocks: list[str] = []
        self.many_sentences: list[str] = []
        self.id_hits: dict[str, int] = {}
        # 図: svg ごと / figure ごとの記録
        self.svgs: list[dict] = []      # {role_img, title_text, figure_index}
        self.figures: list[dict] = []   # {caption_text, svg_count}
        # 要素スタック (void を除く)。各 "範囲" は (深さ, 付随情報) のスタックで管理する
        self._stack: list[str] = []
        self._appendix_depths: list[int] = []
        self._reply_depths: list[int] = []
        self._script_open: list[tuple[int, int]] = []   # (深さ, scripts の index)
        self._builder_open: list[tuple[int, int]] = []  # (深さ, builders の index)
        self._fieldset_open: list[tuple[int, int]] = []  # (深さ, fieldset の識別子)
        self._skip_depths: list[int] = []
        self._title_depths: list[int] = []
        self._caption_depths: list[int] = []
        self._svgtext_depths: list[int] = []
        self._svg_open: list[tuple[int, int]] = []     # (深さ, svgs の index)
        self._figure_open: list[tuple[int, int]] = []  # (深さ, figures の index)
        # 段落の長さ用 (タグ, 深さ, 全文字) と ID 検査用 (タグ, 深さ, 検査対象文字) を分ける
        self._blocks: list[tuple[str, int, list[str], list[str]]] = []

    # ---- 範囲判定 ----
    @property
    def in_appendix(self) -> bool:
        return bool(self._appendix_depths)

    @property
    def in_skip(self) -> bool:
        return bool(self._skip_depths)

    @property
    def in_svg(self) -> bool:
        return bool(self._svg_open)

    @property
    def in_title(self) -> bool:
        return bool(self._title_depths)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        # <br/> のような自己終了。深さは変えない
        self._on_start(tag, attrs, push=False)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._on_start(tag, attrs, push=tag.lower() not in VOID_TAGS)

    def _on_start(self, tag: str, attrs_list: list[tuple[str, str | None]], push: bool) -> None:
        tag = tag.lower()
        attrs = {k.lower(): (v or "") for k, v in attrs_list}
        if push:
            self._stack.append(tag)
        depth = len(self._stack)

        if tag in FORBIDDEN_TAGS:
            self.forbidden.append(tag)
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag == "meta":
            self.has_charset |= "charset" in attrs
            self.has_viewport |= attrs.get("name", "").lower() == "viewport"
        if tag == "h2":
            self.h2_count += 1
        if attrs.get("id"):
            self.element_ids[attrs["id"]] = self.element_ids.get(attrs["id"], 0) + 1
        if "copy-btn" in attrs.get("class", "").split():
            self.copy_targets.append(attrs.get("data-copy", ""))
            if tag != "button":
                self.copy_btn_bad_tags.append(tag)
            if self._reply_depths:
                self.copy_buttons_in_reply += 1
        if "data-reply-out" in attrs:
            self.reply_out_total += 1
            if self._builder_open:
                self.builders[self._builder_open[-1][1]]["out"] += 1
        if tag == "input" and "data-reply" in attrs:
            if self._builder_open:
                self.builders[self._builder_open[-1][1]]["inputs"] += 1
            else:
                self.reply_inputs_outside += 1
            if attrs.get("type", "").lower() == "radio" and attrs.get("name"):
                fs = self._fieldset_open[-1][1] if self._fieldset_open else -1
                self.radio_groups.setdefault(attrs["name"], set()).add(fs)
        src = attrs.get("src", "").strip()
        if src and not src.startswith("data:"):
            self.external.append(f'<{tag} src="{src}">')
        if tag == "link" and attrs.get("href"):
            self.external.append(f'<link href="{attrs["href"]}">')

        role = attrs.get("data-role")
        if role:
            self.roles[role] = self.roles.get(role, 0) + 1
            if role == "appendix" and push:
                self._appendix_depths.append(depth)
            if role == "reply" and push:
                self._reply_depths.append(depth)

        if "data-reply-note" in attrs:
            if tag != "textarea":
                self.bad_note_tags.append(tag)
            elif self._builder_open:
                self.builders[self._builder_open[-1][1]]["note"] += 1

        if not push:
            # <script/> のような自己終了形。HTML では閉じタグ扱いされないため中身の検査ができない
            if tag == "script":
                self.self_closing_scripts += 1
            return
        if tag == "script":
            self.scripts.append({"attrs": attrs, "content": ""})
            self._script_open.append((depth, len(self.scripts) - 1))
        if "data-builder" in attrs:
            self.builders.append({"out": 0, "inputs": 0, "note": 0})
            self._builder_open.append((depth, len(self.builders) - 1))
        if tag == "fieldset":
            self._fieldset_seq += 1
            self._fieldset_open.append((depth, self._fieldset_seq))
        if tag in SKIP_ID_TAGS:
            self._skip_depths.append(depth)
        if tag == "title":
            self._title_depths.append(depth)
            if self.in_svg:
                self.svgs[self._svg_open[-1][1]]["title_text"] = ""
        if tag == "figure":
            self.figures.append({"caption_text": "", "svg_count": 0})
            self._figure_open.append((depth, len(self.figures) - 1))
        if tag == "figcaption" and self._figure_open:
            self._caption_depths.append(depth)
        if tag == "svg":
            fig_idx = self._figure_open[-1][1] if self._figure_open else None
            self.svgs.append({"role_img": attrs.get("role") == "img", "title_text": None, "figure_index": fig_idx})
            self._svg_open.append((depth, len(self.svgs) - 1))
            if fig_idx is not None:
                self.figures[fig_idx]["svg_count"] += 1
        if self.in_svg and tag in SVG_TEXT_TAGS:
            self._svgtext_depths.append(depth)
        if (tag in ID_UNIT_TAGS and not self.in_svg) or (self.in_svg and tag == "text"):
            self._blocks.append((tag, depth, [], []))

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in VOID_TAGS or tag not in self._stack:
            return
        # 閉じ忘れを許容: 対応する開始タグまでスタックを巻き戻す
        while self._stack:
            depth = len(self._stack)
            popped = self._stack.pop()
            self._close_at_depth(depth)
            if popped == tag:
                break

    def _close_at_depth(self, depth: int) -> None:
        for lst in (
            self._appendix_depths, self._reply_depths, self._skip_depths, self._title_depths,
            self._caption_depths, self._svgtext_depths,
        ):
            if lst and lst[-1] == depth:
                lst.pop()
        for pairs in (self._svg_open, self._figure_open, self._script_open, self._builder_open, self._fieldset_open):
            if pairs and pairs[-1][0] == depth:
                pairs.pop()
        if self._blocks and self._blocks[-1][1] == depth:
            kind, _, all_parts, id_parts = self._blocks.pop()
            text = re.sub(r"\s+", " ", "".join(all_parts)).strip()
            limit = LONG_PARAGRAPH if kind in {"p", "dd"} else LONG_CELL
            if kind in TEXT_BLOCKS and len(text) > limit:
                self.long_blocks.append(f"<{kind}> {len(text)} 字 (上限 {limit}): {text[:40]}…")
            if kind in {"p", "dd", "li"}:
                n = len(SENTENCE_END_RE.findall(text))
                if n > MAX_SENTENCES:
                    self.many_sentences.append(f"<{kind}> {n} 文: {text[:40]}…")
            # ID 検査: 除外範囲外で受け取った文字だけを連結して調べる (UC-<b>06</b> も拾う)
            self._scan_ids("".join(id_parts))

    def _scan_ids(self, text: str) -> None:
        for m in ID_RE.finditer(text):
            token = m.group(0)
            if token not in ID_ALLOW:
                self.id_hits[token] = self.id_hits.get(token, 0) + 1

    def _id_checkable(self) -> bool:
        if self.in_appendix or self.in_skip or self.in_title:
            return False
        if self.in_svg:
            return bool(self._svgtext_depths)  # svg 内は表示文字 (text/tspan) だけ
        return True

    def handle_data(self, data: str) -> None:
        if self._script_open:
            self.scripts[self._script_open[-1][1]]["content"] += data
        if self.in_title:
            if self.in_svg:
                idx = self._svg_open[-1][1]
                self.svgs[idx]["title_text"] = (self.svgs[idx]["title_text"] or "") + data
            else:
                self.title_text += data
        if self._caption_depths and self._figure_open:
            self.figures[self._figure_open[-1][1]]["caption_text"] += data
        checkable = self._id_checkable()
        if self._blocks:
            self._blocks[-1][2].append(data)
            if checkable:
                self._blocks[-1][3].append(data)
            return
        if checkable and data.strip():
            self._scan_ids(data)


def canonical_script() -> str | None:
    """assets/base.html に同梱したスクリプト本文 (正規化済み) を返す。読めなければ None"""
    base = Path(__file__).resolve().parent.parent / "assets" / "base.html"
    try:
        m = re.search(r"<script\b[^>]*>(.*?)</script>", base.read_text(encoding="utf-8"), re.S | re.I)
    except OSError:
        return None
    return normalize_js(m.group(1)) if m else None


def normalize_js(code: str) -> str:
    """インデントと空行の違いだけを吸収する。改行の位置は保つ (改行は JS の意味を変える)"""
    lines = [ln.strip() for ln in code.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return "\n".join(ln for ln in lines if ln)


def check_scripts(p: "ReviewParser") -> list[str]:
    """JS は base.html 同梱のもの 1 つだけ。書き換え・追加・外部読み込みを弾く"""
    errors: list[str] = []
    if p.self_closing_scripts:
        errors.append("<script/> の自己終了形は禁止 (中身を検査できず、実行もされない)")
    if not p.scripts:
        if p.builders or p.copy_targets:
            errors.append("回答欄があるのに base.html 同梱のスクリプトが無い (組み立てもコピーも動かない)")
        return errors
    if len(p.scripts) > 1:
        errors.append(f"<script> は 1 つだけにする ({len(p.scripts)} 個ある)")
    want = canonical_script()
    if want is None:
        errors.append("assets/base.html の同梱スクリプトを読めないため、JS を照合できない (スキルの assets が揃っているか確認する)")
    for i, s in enumerate(p.scripts, 1):
        attrs = s["attrs"]
        if "src" in attrs:
            errors.append(f"script #{i}: 外部スクリプトの読み込みは禁止 (src を付けない)")
            continue
        if "nomodule" in attrs:
            errors.append(f"script #{i}: nomodule は付けない (実行されない)")
        stype = attrs.get("type", "").strip().lower()
        if stype not in {"", "text/javascript", "application/javascript", "module"}:
            errors.append(f'script #{i}: type="{stype}" では実行されない (type は付けない)')
        got = normalize_js(s["content"])
        if not got:
            errors.append(f"script #{i}: 中身が空")
        elif want is not None and got != want:
            errors.append(f"script #{i}: base.html 同梱のスクリプトと一致しない (書き換えず、そのまま貼る)")
        elif want is None and NETWORK_JS_RE.search(s["content"]):
            errors.append(f"script #{i}: JS が通信・外部読み込みを行っている")
    return errors


def content_max_px(text: str) -> int | None:
    m = re.search(r"--content-max\s*:\s*(\d{1,6})px", text)
    return int(m.group(1)) if m else None


def validate(path: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warns: list[str] = []
    if not path.is_file():
        return [f"file not found: {path}"], warns
    if path.suffix.lower() not in {".html", ".htm"}:
        errors.append("output must use .html or .htm")
    size = path.stat().st_size
    if size > MAX_BYTES:
        errors.append(f"file exceeds 16 MiB: {size} bytes")
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return errors + ["file must be UTF-8"], warns
    if "\x00" in text:
        errors.append("NUL byte in file (Write tool corruption)")

    if PLACEHOLDER_RE.search(text):
        errors.append("unresolved {{PLACEHOLDER}} or TODO remains")
    if re.search(r"@import\s|url\(\s*['\"]?https?://", text, re.IGNORECASE):
        errors.append("external CSS resource detected")

    p = ReviewParser()
    try:
        p.feed(text)
        p.close()
    except Exception as exc:  # noqa: BLE001
        return errors + [f"HTML parse failure: {exc}"], warns

    # ---- ERROR ----
    if p.lang not in {"ja", "en"}:
        errors.append("<html lang> must be ja or en")
    if not p.has_charset:
        errors.append("missing <meta charset>")
    if not p.has_viewport:
        errors.append("missing viewport meta")
    if not p.title_text.strip():
        errors.append("missing non-empty <title>")
    if p.forbidden:
        errors.append("forbidden tags: " + ", ".join(sorted(set(p.forbidden))))
    if p.external:
        errors.append("non-self-contained assets: " + ", ".join(p.external))
    missing = REQUIRED_ROLES - set(p.roles)
    if missing:
        errors.append("missing data-role: " + ", ".join(sorted(missing)))
    for role in ("context", "ask"):
        if p.roles.get(role, 0) > 1:
            errors.append(f'data-role="{role}" must appear exactly once (found {p.roles[role]})')
    errors.extend(check_scripts(p))
    for tag in sorted(set(p.copy_btn_bad_tags)):
        errors.append(f"copy-btn は <button> にする (<{tag}> になっている)")
    for i, b in enumerate(p.builders, 1):
        if not b["out"]:
            errors.append(f"回答ビルダー #{i} に出力先 (data-reply-out) が無い")
        if not b["inputs"] and not b["note"]:
            errors.append(f"回答ビルダー #{i} に入力元 (input の data-reply か textarea の data-reply-note) が無い")
    if p.reply_inputs_outside:
        errors.append("data-reply の選択肢が data-builder の外にある (文面に反映されない)")
    if p.reply_out_total and not p.builders:
        errors.append("data-reply-out があるのに data-builder の囲みが無い")
    for name, fieldsets in sorted(p.radio_groups.items()):
        if len(fieldsets) > 1:
            errors.append(f'radio の name="{name}" を複数の判断 (fieldset) で使い回している。判断ごとに変える')
    for tag in sorted(set(p.bad_note_tags)):
        errors.append(f"data-reply-note は <textarea> に付ける (<{tag}> に付いている)")
    seen_targets: set[str] = set()
    for tgt in p.copy_targets:
        if tgt and tgt in seen_targets:
            continue
        seen_targets.add(tgt)
        if not tgt:
            errors.append("copy-btn に data-copy (コピー元の id) が無い")
        elif tgt not in p.element_ids:
            errors.append(f'copy-btn の data-copy="{tgt}" に一致する id が無い')
        elif p.element_ids[tgt] > 1:
            errors.append(f'id="{tgt}" が {p.element_ids[tgt]} 個ある。コピー元を取り違える')
    dup_other = sorted(k for k, n in p.element_ids.items() if n > 1 and k not in set(p.copy_targets))
    if dup_other:
        warns.append("同じ id が複数ある: " + ", ".join(dup_other))
    if not p.copy_buttons_in_reply:
        errors.append('data-role="reply" 内に copy-btn (コピーボタン) が必要')
    if not p.svgs:
        errors.append("at least one inline <svg> diagram is required")
    for i, svg in enumerate(p.svgs, 1):
        if not svg["role_img"]:
            errors.append(f'svg #{i}: role="img" is required')
        if not (svg["title_text"] or "").strip():
            errors.append(f"svg #{i}: non-empty <title> inside the svg is required")
        if svg["figure_index"] is None:
            errors.append(f"svg #{i}: must be wrapped in <figure> with a <figcaption>")
    for i, fig in enumerate(p.figures, 1):
        if fig["svg_count"] and not fig["caption_text"].strip():
            errors.append(f"figure #{i}: diagram needs a non-empty <figcaption>")

    # ---- WARN ----
    n_svg = len(p.svgs)
    if p.h2_count and n_svg * 2 < p.h2_count:
        warns.append(f"図解が少ない: <h2> {p.h2_count} に対し <svg> {n_svg} (目安: h2 2 つに図 1 つ)")
    cm = content_max_px(text)
    if cm is None:
        warns.append("--content-max が未定義 (base.html の幅設定を使う)")
    elif cm < MIN_CONTENT_MAX:
        warns.append(f"--content-max が {cm}px。{MIN_CONTENT_MAX}px 以上にする")
    for item in p.many_sentences[:10]:
        warns.append(f"{MAX_SENTENCES} 文を超える段落 (リストか表に分解): {item}")
    if len(p.many_sentences) > 10:
        warns.append(f"{MAX_SENTENCES} 文を超える段落がほかに {len(p.many_sentences) - 10} 件")
    for item in p.long_blocks[:10]:
        warns.append(f"長い段落 (リストか表に分解): {item}")
    if len(p.long_blocks) > 10:
        warns.append(f"長い段落がほかに {len(p.long_blocks) - 10} 件")
    if p.id_hits:
        top = sorted(p.id_hits.items(), key=lambda kv: -kv[1])[:12]
        warns.append("内部 ID らしき文字列が本文か図にある (名前に置き換えるか付録へ): " + ", ".join(f"{k}×{v}" for k, v in top))

    return errors, warns


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("html", type=Path)
    ap.add_argument("--strict", action="store_true", help="WARN も失敗として扱う")
    args = ap.parse_args()
    errors, warns = validate(args.html.expanduser().resolve())
    for w in warns:
        print(f"WARN: {w}")
    for e in errors:
        print(f"ERROR: {e}")
    if errors or (args.strict and warns):
        return 1
    print("VALID" + (f" ({len(warns)} warnings)" if warns else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())

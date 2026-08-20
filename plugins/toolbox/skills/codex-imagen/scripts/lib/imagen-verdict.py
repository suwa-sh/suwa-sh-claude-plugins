#!/usr/bin/env python3
"""imagen-verdict.py — プロバイダ出力から失敗理由を分類して verdict JSON を 1 行出力する。

画像生成が失敗したとき、呼び出し元 (pipeline) に届くのは「PNG が無い」という事実だけで、
その理由 (usage limit / クォータ / 認証失効 / content policy / timeout) は provider の
出力に埋もれて消えていた。ここで 1 語に分類し、復帰見込み時刻まで読み取って構造化する。

usage:
  imagen-verdict.py <provider> <status> [<logfile>]

  <provider> : codex | agy | ...
  <status>   : ok | failed
  <logfile>  : provider の stdout+stderr を落としたファイル (status=ok なら省略可)

stdout: {"name":"codex","status":"failed","reason":"usage_limit","hint":"...","retry_epoch":123}
分類できない場合も必ず JSON を 1 行出す (reason=unknown)。失敗しても呼び出し側を止めない。
"""
import datetime
import json
import re
import sys

# 判定順に並べる (先に当たったものを採用)。上ほど具体的な原因。
RULES = [
    # codex: "You've hit your usage limit. ... try again at 2:53 PM."
    ("usage_limit", (r"hit your usage limit", r"usage_limit_exceeded", r"usage limit reached")),
    # agy: "使用モデルの生成制限（クォータ制限）に達しており、回復まで約4時間半" (対話文言) /
    #      "Individual quota reached. ... Resets in 164h41m41s." (CLI のエラー文言。2026-08-20 実測)
    ("quota_exhausted", (r"クォータ", r"生成制限",
                         r"quota\s+(?:limit|exceeded|exhausted|reached)",
                         r"RESOURCE_EXHAUSTED")),
    # 429 は境界必須。裸の r"429" は "1429 bytes" のようなログ中の数値に誤爆し、
    # クォータでない失敗に遅延リトライを付けてしまう (2026-08-20 レビューで実測)
    ("rate_limit", (r"rate limit", r"\b429\b", r"too many requests")),
    ("auth_expired", (r"not logged in", r"unauthorized", r"\b401\b", r"login required",
                      r"re-?authenticate", r"認証", r"ログインし")),
    ("content_policy", (r"content policy", r"safety (?:policy|system)", r"I can'?t help with",
                        r"policy violation", r"ポリシー")),
    # "timeout" 単独は --print-timeout 等の引数エコーに誤爆するので使わない
    ("timeout", (r"timeout waiting for response", r"timed out", r"deadline exceeded")),
]

# 復帰見込み時刻の読み取り。(パターン, 種別) — 種別は clock (時刻指定) / delta (相対)
CLOCK_RE = re.compile(r"try again at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?", re.I)
DELTA_JA_RE = re.compile(r"約\s*(\d+)\s*時間(半)?")
DELTA_EN_RE = re.compile(r"in\s+(\d+)\s*(hour|minute)s?", re.I)
# agy CLI: "Resets in 164h41m41s."
RESETS_IN_RE = re.compile(r"resets?\s+in\s+(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?", re.I)


def classify(text):
    """出力の内容から理由を 1 語に決める。

    「証拠が無い」(unknown) と「出力はあったが PNG が出なかった」(no_image) は別物として扱う。
    同じ語に潰すと、分類器へログが届いていない配線ミスをログから見分けられなくなる。
    """
    if not text.strip():
        return "unknown"
    for reason, patterns in RULES:
        for pat in patterns:
            if re.search(pat, text, re.I):
                return reason
    return "no_image"


def _resets_in_seconds(match):
    hours, minutes, seconds = (int(g) if g else 0 for g in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def find_hint(text):
    for regex in (CLOCK_RE, RESETS_IN_RE, DELTA_JA_RE, DELTA_EN_RE):
        m = regex.search(text)
        if m:
            return m.group(0).strip()
    return ""


def retry_epoch(text, now=None):
    """復帰見込みの epoch 秒。読み取れなければ None (呼び出し側が保守的な既定値を使う)。"""
    now = now or datetime.datetime.now().astimezone()

    m = CLOCK_RE.search(text)
    if m:
        hour, minute, ampm = int(m.group(1)), int(m.group(2)), (m.group(3) or "").upper()
        if ampm == "PM" and hour != 12:
            hour += 12
        elif ampm == "AM" and hour == 12:
            hour = 0
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if target <= now:  # 既に過ぎている表記は翌日の同時刻とみなす
                target += datetime.timedelta(days=1)
            return int(target.timestamp())

    m = RESETS_IN_RE.search(text)
    if m and any(m.groups()):
        return int((now + datetime.timedelta(seconds=_resets_in_seconds(m))).timestamp())

    m = DELTA_JA_RE.search(text)
    if m:
        hours = int(m.group(1)) + (0.5 if m.group(2) else 0)
        return int((now + datetime.timedelta(hours=hours)).timestamp())

    m = DELTA_EN_RE.search(text)
    if m:
        amount, unit = int(m.group(1)), m.group(2).lower()
        delta = datetime.timedelta(hours=amount) if unit == "hour" else datetime.timedelta(minutes=amount)
        return int((now + delta).timestamp())

    return None


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"name": "unknown", "status": "failed", "reason": "unknown"}))
        return
    provider, status = sys.argv[1], sys.argv[2]
    verdict = {"name": provider, "status": status}

    if status == "ok":
        verdict["reason"] = "ok"
        print(json.dumps(verdict, ensure_ascii=False, separators=(",", ":")))
        return

    text = ""
    if len(sys.argv) > 3 and sys.argv[3]:
        try:
            with open(sys.argv[3], encoding="utf-8", errors="replace") as fh:
                text = fh.read()[-8000:]  # 末尾だけで十分 (エラーは最後に出る)
        except OSError:
            text = ""

    verdict["reason"] = classify(text)
    hint = find_hint(text)
    if hint:
        verdict["hint"] = hint
    epoch = retry_epoch(text)
    if epoch:
        verdict["retry_epoch"] = epoch
        verdict["retry_at"] = datetime.datetime.fromtimestamp(epoch).astimezone().isoformat()
    print(json.dumps(verdict, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()

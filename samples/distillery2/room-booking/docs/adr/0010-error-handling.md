---
id: "0010"
title: "業務のエラーはコード付きの戻り値で返し、presentation で契約のエラー型と HTTP の status に変える"
status: superseded
date: "2026-11-04"
supersedes: []
superseded_by: "0023"
basis: "requirements@f4263122f7f53c061d36818286bf20f7d36c4fb2"
scope: [app]
confidence: medium
rules:
  - scope: tier:backend
    text: "業務のエラーは domain でコード付きの型として作り、domain と usecase は例外で投げずに戻り値 (成功か業務のエラーか) で返す"
  - scope: tier:backend
    text: "presentation が業務のエラーのコードを契約のエラー型 (Problem の type・title・detail・code) と HTTP の status に変える。業務のエラーで 500 を返さない"
  - scope: tier:backend
    text: "業務のエラーのコードと status の対応は、INVALID_TIME_RANGE・NOT_ON_30_MINUTES・PAST_TIME_SLOT を 422、SLOT_OVERLAPS・ALREADY_CANCELLED・CANCEL_DEADLINE_PASSED を 409、NOT_RESERVATION_OWNER を 403、RESERVATION_NOT_FOUND・ROOM_NOT_FOUND を 404 にする"
  - scope: tier:backend
    text: "要求の形の誤り (必須が無い・日時の形式が違う) は契約の検証で 400 にする。業務のエラーと混ぜない"
  - scope: tier:backend
    text: "システムのエラー (DB の失敗・想定外) は例外のまま presentation の共通の処理で受け、応答は汎用の文と相関 ID だけにする。スタックや SQL を応答に出さない"
  - scope: tier:backend
    text: "占有の表の一意制約の違反は repository で SLOT_OVERLAPS の業務のエラーに変え、システムのエラーとして扱わない"
  - scope: tier:frontend
    text: "業務のエラーは契約のエラー型の code で分岐し、利用者に理由を表示する"
---

# 背景

受入基準は、予約が成立しないときに理由 (時間帯が正しくない・30 分刻みでない・過去の時間帯・既存の予約と重なる) を示し、取り消しを受け付けないとき (本人でない・取消済み・開始を過ぎた) を区別する。同時の予約では DB の一意制約の違反が「重なる」として返る必要がある。

# 決定

- エラーを 4 種に分ける: 業務のエラー・入力のエラー・見つからない / 権限が無い・システムのエラー。
- 業務のエラーは domain でコード付きの型として作り、戻り値で返す (呼ぶ側が扱いを忘れないようにする)。システムのエラーは例外にする。
- コードと status の対応:

| コード | 意味 | status |
|---|---|---|
| INVALID_TIME_RANGE | 開始が終了より前でない | 422 |
| NOT_ON_30_MINUTES | 30 分刻みでない | 422 |
| PAST_TIME_SLOT | 開始が現在より前 | 422 |
| SLOT_OVERLAPS | 既存の予約と重なる (同時の予約の負けた側も) | 409 |
| ALREADY_CANCELLED | 既に取り消されている | 409 |
| CANCEL_DEADLINE_PASSED | 開始時刻を過ぎている | 409 |
| NOT_RESERVATION_OWNER | 予約者本人でない | 403 |
| RESERVATION_NOT_FOUND / ROOM_NOT_FOUND | 対象が無い | 404 |

- 応答の形は契約のエラー型 (Problem) にし、業務のエラーのコードを `code` に入れる。
- 再試行はしない (業務のエラーは再試行しても同じ。システムのエラーは利用者が操作をやり直す)。

# 却下した案

- 業務のエラーも例外で投げる: どこで受けるかが呼び出しの経路に依存し、扱い忘れが型で分からない。
- 本人でない取り消しを 404 にして予約の存在を隠す: 社内の利用者だけで、予約の存在は空き状況で見えている。理由を返すほうが分かりやすい。
- すべて 400 で返す: 画面が理由ごとに文を出し分けられない。

# 影響

- 契約の段でこのコードを Problem の code の列挙に載せる。
- 画面は code ごとの文を持つ。

---
id: "0023"
title: "占有の一意制約の違反は repository が値で返し、usecase が重なりのエラーに変える"
status: accepted
date: "2026-11-10"
supersedes: ["0010"]
superseded_by: null
basis: "requirements@64517f420b568ea1a4536b71b9dbbb357bd66460"
scope: [app]
confidence: high
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
    text: "占有の表の一意制約の違反は、repository が例外で投げずに「重なり」を表す値として戻り値で返し、usecase がそれを SLOT_OVERLAPS の業務のエラーに変える。システムのエラーとして扱わない"
  - scope: tier:backend
    text: "SLOT_OVERLAPS の業務のエラーを作る場所は usecase の 1 か所にする (事前の重なりの判定と、一意制約の違反の両方)。repository は業務のエラーの型を作らない"
  - scope: tier:frontend
    text: "業務のエラーは契約のエラー型の code で分岐し、利用者に理由を表示する"
---

# 背景

ADR 0010 を置き換える。要求の差分の段で出た課題 (`docs/feedback/20261110_030511_requirements_requirements-20261110T030109Z_slot-overlaps-layer.md`、`from_uc` は無し。元は会議室を予約する UC の as-built の課題 `docs/feedback/20261110T024931Z_asbuilt_reserve-room.md`) で、次の食い違いが見つかった。

- ADR 0010 の rules は「占有の表の一意制約の違反は repository で SLOT_OVERLAPS の業務のエラーに変える」としている。
- 実装は、repository が一意制約の違反を「重なり」を表す値で返し、usecase が SLOT_OVERLAPS の業務のエラーを作る。
- usecase は事前の重なりの判定でも SLOT_OVERLAPS を作る。業務のエラーを作る場所が usecase と repository の 2 か所に分かれるより、usecase の 1 か所に揃えるほうが筋がよい。
- 要求 (受入基準) はどちらの形でも満たされるので、要求では直せない。

ADR は本文を書き換えずに履歴を残す決まりのため、ADR 0010 を置き換え、その rules のうち一意制約の違反の 1 本だけを直し、残りは文面を変えずに引き継ぐ。

ADR 0003 の「一意制約の違反は『時間帯が既存の予約と重なる』業務のエラーに変える」は変える層を決めていないので、この ADR と両立する (置き換えない)。ティア構成・データストア・層の依存の方向は変えない。

# 決定

- エラーの 4 種の分け方、コードと status の対応、応答の形 (契約のエラー型 Problem の `code`)、再試行しないことは ADR 0010 のとおり。
- 占有の表の一意制約の違反は、次の 2 段で業務のエラーにする。
  1. repository は一意制約の違反を受けたら、例外を投げずに「重なり」を表す値を戻り値で返す (業務のエラーの型は作らない)。それ以外の DB の失敗はシステムのエラーとして例外のまま返す。
  2. usecase は「重なり」の値を受けたら、SLOT_OVERLAPS の業務のエラーを作って返す。
- SLOT_OVERLAPS を作るのは usecase だけにする。事前の重なりの判定で見つかった重なりも、同時の予約で一意制約に弾かれた重なりも、同じ場所で同じ業務のエラーになる。

# 却下した案

- ADR 0010 のとおり repository で SLOT_OVERLAPS の業務のエラーを作る: 業務のエラーを作る場所が usecase (事前の判定) と repository (一意制約) の 2 か所に分かれ、どちらで作るかが経路に依存する。実装も既にこの形ではない。
- repository が一意制約の違反を例外のまま投げ、usecase が例外を捕まえて変える: 業務の結果を例外で運ぶことになり、戻り値で返す決定 (ADR 0010) と合わない。どの例外が重なりかを usecase が DB の詳細で見分けることにもなる。
- ADR 0010 を有効のまま残し、この ADR で 1 本だけ補う: 「repository で SLOT_OVERLAPS に変える」の rule が有効なまま残り、開発ルールに 2 つの食い違う文が並ぶ。

# 影響

- ADR 0010 は置き換え済み (superseded) になり、その rules はこの ADR から開発ルールに入る。
- 実装は変えない (今の実装がこの決定の形)。
- 開発ルール (docs/rules/tier-backend.md・tier-frontend.md) はこの ADR の受理後に作り直す。アーキテストの規則は増えない (層の依存は変えない)。

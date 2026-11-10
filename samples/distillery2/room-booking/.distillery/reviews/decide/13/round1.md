## (1) 観点サマリ表

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | 要求との縦の整合 | CONCERN | 指摘 1 | 要求が明記する「過去の時間帯でも同一予約の再送を先に判定する」順序が、ADR の決定と rules に無い |
| P2 | ADR どうしの横の整合 | PASS | — | 有効な ADR と生成された rules を照合し、ティア・認証・データ・テスト方針に閾値以上の矛盾は確認しなかった |
| P3 | 決めずに残した点 | PASS | — | 稼働時間、移行、認証基盤、ブラウザ受入などの仮置きは architecture.md の確認事項に返されている |

## (2) 指摘

### 指摘 1
- **perspective**: P1
- **対象**: [docs/adr/0022-messaging-not-needed-resend-returns-existing.md](<repo>/docs/adr/0022-messaging-not-needed-resend-returns-existing.md:35)、[docs/adr/0017-time-range-within-business-date.md](<repo>/docs/adr/0017-time-range-within-business-date.md:21)
- **severity**: medium
- **claim**: 同一予約の再送判定を、過去の時間帯の判定より先に行う順序が決定されていない。予約開始後に応答を再取得するケースで、要求と異なる `PAST_TIME_SLOT` を返す実装が許される。
- **evidence**: [SPEC-002-03](<repo>/docs/requirements/requirements.md:15) は再送判定を過去判定より先に行い、開始後・終了後でも成立済み予約を返すと明記する。ADR 0022 の決定と backend の rule は同一予約を探して返すことを定めるが、判定順を定めていない。一方、ADR 0017 は `PAST_TIME_SLOT` の検査を予約集約の作成メソッドに置く。
- **why_raised**: 予約の応答が届かず、社員が開始時刻を過ぎてから送り直す場合、処理順によって成立済み予約を確認できず、要求された再送結果を得られない。
- **suggested_fix**: ADR 0022 とその backend rule に「入力の時間帯を検証した後、同一の有効予約を検索し、存在すれば過去判定と新規作成を行わず成立済み予約を返す」と明記する。

## (3) below-threshold

なし

Codex session ID: 01a1c331-11f9-72b2-9b59-77ee5cb3701f
Resume in Codex: codex resume 01a1c331-11f9-72b2-9b59-77ee5cb3701f

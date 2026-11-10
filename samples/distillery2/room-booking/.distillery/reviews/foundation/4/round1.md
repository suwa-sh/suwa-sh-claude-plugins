| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | ADR との縦の整合 | PASS | なし | ADR 0017 の画面表示ルールは frontend ルールに反映され、依存方向の検査と CI の実行設定も確認した |
| P2 | 契約の骨格と画面部品 | CONCERN | 指摘 1 | 時間帯エラーの画面文は ADR に沿うが、契約の説明が ADR 0017 の決定に追随していない |
| P3 | 基盤の中の横の整合 | PASS | なし | ティア設定、CI のコマンド、提供側の契約テスト設定を照合した |

### 指摘 1
- **perspective**: P2
- **対象**: `docs/adr/0017-time-range-within-business-date.md:61`
- **severity**: medium
- **claim**: ADR 0017 が求める契約の説明更新が反映されておらず、`INVALID_TIME_RANGE` の対象となる「業務の日付に収まらない時間帯」が契約から読み取れない。
- **evidence**: ADR 0017 は `ErrorCode` と `UnprocessableEntity` の説明にこの条件を足すと明記している。一方、`contracts/openapi/openapi.yaml:101-105` のコード説明には条件がなく、同ファイル `:185` の `UnprocessableEntity` の説明は「開始が終了より前でない・30 分刻みでない・過去」のまま。
- **why_raised**: 契約を入力として API の実装や契約テストを作る際、日をまたぐ時間帯を `INVALID_TIME_RANGE`（422）として扱う決定を見落とす可能性がある。
- **suggested_fix**: 契約の両説明に ADR 0017 の条件を反映し、生成物を更新する。

### below-threshold

- P2 low `RoomAvailability` の `NotOn30Minutes` Story は、エラーコードに対して表示中の時刻が 30 分刻みのまま。
- P3 low frontend に `test:contract` コマンドはあるが CI 計画では未使用。現時点の契約テスト生成先は提供側。

Codex session ID: 01a1a858-6956-7ed3-bf13-c0dfa9a88c8c
Resume in Codex: codex resume 01a1a858-6956-7ed3-bf13-c0dfa9a88c8c

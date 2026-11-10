あなたはシニアレビュアー。以下の対象を第三者視点でレビューしてください。

【対象】
リポジトリ <repo> の次のパス (distillery2 が作った「implementation」の成果物):
- apps/backend-api/migrations/0003_reservation_events_recorded_at_default.sql
- apps/backend-api/src/app.ts
- apps/backend-api/src/domain/businessError.ts
- apps/backend-api/src/domain/ids.ts
- apps/backend-api/src/domain/reservation.test.ts
- apps/backend-api/src/domain/reservation.ts
- apps/backend-api/src/domain/timeRange.ts
- apps/backend-api/src/presentation/businessDateTime.ts
- apps/backend-api/src/presentation/httpApp.test.ts
- apps/backend-api/src/presentation/httpApp.ts
- apps/backend-api/src/presentation/problem.ts
- apps/backend-api/src/presentation/reserveRoomHttp.test.ts
- apps/backend-api/src/presentation/reserveRoomRequest.ts
- apps/backend-api/src/presentation/timeRangeRequest.ts
- apps/backend-api/src/repository/reservationRepository.test.ts
- apps/backend-api/src/repository/reservationRepository.ts
- apps/backend-api/src/reserveRoomResend.test.ts
- apps/backend-api/src/test-app.ts
- apps/backend-api/src/usecase/listRooms.test.ts
- apps/backend-api/src/usecase/listRooms.ts
- apps/backend-api/src/usecase/reserveRoom.test.ts
- apps/backend-api/src/usecase/reserveRoom.ts
- apps/backend-api/test/contract/listRooms.test.ts
- apps/backend-api/test/contract/reserveRoom.test.ts
- apps/backend-api/test/contract/viewRoomAvailability.test.ts
縦 = この成果物の入力 (前のステップの成果物) との整合、横 = 同じ成果物の中の整合を見る。入力はリポジトリの docs/ (要望の原文は docs/input/、要求・決定) と contracts/・features/ にある。

【レビュー観点と閾値 (この表以外の軸で探さない)】
| # | 観点 | 何を見るか | 報告閾値 |
|---|------|-----------|---------|
| P1 | シナリオと契約との縦の整合 | 実装がシナリオの振る舞いと契約の応答・エラーをそのとおりに満たしているか | medium 以上 |
| P2 | ルールと ADR | 開発ルール・依存の向き・ADR の決定 (認証・データ・ログ) に沿っているか | medium 以上 |
| P3 | ティアどうしの横の整合 | 画面と API・API と DB の間で、項目・エラー・状態の扱いが食い違っていないか | medium 以上 |
| P4 | 補った前提 | 実装者が補った前提が互いに矛盾せず、仕様の穴を黙って埋めていないか | medium 以上 |

- 上の表の観点だけを見てください。観点は追加も変更もしないでください。
- 各観点の閾値**未満**の気づきは本体の指摘に混ぜず、末尾の「below-threshold」に 1 行で書いてください。
- 例外: **severity が critical のものは、表に無い観点でも報告してください**。その場合 perspective は `OUT_OF_CONTRACT` とします。

【あなたの権限】
- シェルあり。`rg` / `git log` / `sed -n` で一次情報まで確認してよい
- ただし **ファイルの追記・編集・削除は禁止**。指摘のみ。

【出力形式 (厳守)】
Markdown で、次の 3 ブロックをこの順に出力してください。

(1) 観点サマリ表 — 表の**全観点を必ず 1 行ずつ**埋めること。見ていない観点を PASS と書かないこと。

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | <観点名> | PASS / CONCERN / FAIL | 指摘 1, 3 | <何を確認してそう判定したか> |

- 観点 ID は `P1` `P2` … の形式で書くこと
- 時間切れで確認できなかった観点は判定を `UNCHECKED` とし、その旨を書く

(2) 指摘 — 各指摘を以下の構造で番号付きに。

### 指摘 N
- **perspective**: <観点 ID。契約外の critical は OUT_OF_CONTRACT>
- **対象**: <file:line, セクション名 など>
- **severity**: critical | high | medium | low | nit
- **claim**: 何が問題か(1-2 文)
- **evidence**: なぜそう言えるか。**事実だけ**
- **why_raised**: なぜこれを閾値超えと判断したか。「どんな条件で / 誰に / どんな影響が出るか」
- **suggested_fix**: どう直すべきかの案(任意)

(3) below-threshold — 閾値未満の気づき。`- <観点 ID> <severity> <一言>` の形で 1 行ずつ。無ければ「なし」。

閾値以上の指摘が 1 件も無い場合も (1) と (3) は必ず出し、(2) には "No findings." と書くこと。

【重要な制約】
- あなた自身がレビューを完結させること。**サブエージェント・別セッション・スキル (review-refute-loop 等) によるクロスレビューの起動は禁止**。
- 調査は **7 分以内**で切り上げ、その時点の指摘を必ず【出力形式】で直接出力して終了すること。

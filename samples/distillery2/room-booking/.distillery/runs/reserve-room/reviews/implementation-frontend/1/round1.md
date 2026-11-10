## (1) 観点サマリ表

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | シナリオと契約との縦の整合 | PASS | — | 予約の 200/201、契約のエラーコード、未入力時の送信停止、空き状況の応答変換をシナリオ・OpenAPI と照合した |
| P2 | ルールと ADR | PASS | — | 認証ヘッダの付与箇所、クエリによる画面間の値の引き継ぎ、時差付き日時への変換をルール・ADR と照合した |
| P3 | ティアどうしの横の整合 | CONCERN | 指摘 1 | API のエラーを、画面が入力変更後も以前の条件に対する結果として表示し続ける |
| P4 | 補った前提 | CONCERN | 指摘 2 | 完了画面の遷移先が未実装である前提を置いたまま、利用できる操作として表示している |

## (2) 指摘

### 指摘 1
- **perspective**: P3
- **対象**: `apps/frontend/src/screens/ReserveRoom/ReserveRoomScreen.tsx:195`、`apps/frontend/src/screens/RoomAvailability/RoomAvailabilityScreen.tsx:75`
- **severity**: medium
- **claim**: API エラーの後に入力を変更しても、変更前の入力に対するエラーが表示され続ける。
- **evidence**: 両画面の `onChange` は入力値だけを更新する。エラー表示に使う `state` は次の送信・照会まで更新されず、予約画面では `state.code`、空き状況画面でも `state.code` がそのまま渡される。
- **why_raised**: 重なりエラーや時間帯エラーを受けて社員が値を直した場合、現在の入力にも同じ問題があるように見える。画面の入力と API が判定した対象が食い違うため。
- **suggested_fix**: 入力変更時に前回のエラーを消すか、エラーを判定対象の入力値と結び付け、その値を表示している間だけ出す。

### 指摘 2
- **perspective**: P4
- **対象**: `apps/frontend/src/screens/ReserveRoom/ReserveRoomScreen.tsx:170`、`apps/frontend/src/routes.tsx:26`
- **severity**: medium
- **claim**: 予約完了後の「自分の予約一覧を見る」は、現時点では存在しない画面へ遷移する。
- **evidence**: ボタンは `/my-reservations` へ遷移するが、`routes` にそのパスは無い。実装の前提記録 A-005 も、遷移後に「画面が見つかりません」になると明記している。
- **why_raised**: 予約を終えた社員がボタンを押すと、予約一覧を確認できず行き止まりになる。記録された前提と、完了画面が提供する操作の意味が食い違うため。
- **suggested_fix**: 一覧画面の実装とルート登録が完了するまで、操作を利用可能として表示しない。

## (3) below-threshold

なし。

Codex session ID: 01a1c406-f412-7122-9ccc-d1c66b5cc4e5
Resume in Codex: codex resume 01a1c406-f412-7122-9ccc-d1c66b5cc4e5

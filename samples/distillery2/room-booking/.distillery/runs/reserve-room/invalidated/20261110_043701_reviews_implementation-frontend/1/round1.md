## (1) 観点サマリ表

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | シナリオと契約との縦の整合 | PASS | なし | 予約の 201・送り直しの 200、業務エラー、空き状況の応答をシナリオと OpenAPI に照合した |
| P2 | ルールと ADR | PASS | なし | 生成クライアントの利用、認証ヘッダの付与箇所、画面間のクエリ引き継ぎを確認した |
| P3 | ティアどうしの横の整合 | CONCERN | 指摘 1 | 予約完了画面の遷移先がルート表にない |
| P4 | 補った前提 | CONCERN | 指摘 2 | 会議室一覧の取得前・失敗時に、未確認のクエリ値を送信できる |

## (2) 指摘

### 指摘 1
- **perspective**: P3
- **対象**: `apps/frontend/src/screens/ReserveRoom/ReserveRoomScreen.tsx:104`、`apps/frontend/src/routes.tsx:26`
- **severity**: medium
- **claim**: 予約完了後の「自分の予約一覧を見る」は `/my-reservations` へ移動するが、そのルートが登録されていない。
- **evidence**: ボタンの遷移先は `/my-reservations`。ルート表には `/availability`、`/reservations/new`、`/auth/callback` だけがあり、未一致のパスでは `App.tsx:38-42` が「画面が見つかりません」を表示する。
- **why_raised**: 予約を完了した社員がこのボタンを押すと、案内された予約一覧を開けず、画面が見つからない状態になる。
- **suggested_fix**: 一覧画面のルートを登録し、ボタンから実際に開けることを確認する。

### 指摘 2
- **perspective**: P4
- **対象**: `apps/frontend/src/screens/ReserveRoom/ReserveRoomScreen.tsx:35,51-72`
- **severity**: medium
- **claim**: クエリの `roomId` は会議室一覧との照合が済むまで保持され、一覧取得に失敗すると照合されないまま予約要求に使われる。
- **evidence**: `keepKnownRoom` は `loadRooms` が成功した場合だけ呼ばれる。失敗時はエラーを設定するだけで、フォームの送信は止めない。`submitReservation.ts:33` は保持中の `value.roomId` を送る。
- **why_raised**: 会議室一覧の取得に失敗した状態で、クエリ付きの予約画面から送信すると、選択肢で確認できない会議室 ID が API に送られる。ADR 0021 の「選択肢にない会議室は空にして社員に入力させる」という前提を、この条件では満たせない。
- **suggested_fix**: 一覧取得が完了するまで送信を止め、取得失敗時は再取得できる状態にする。

## (3) below-threshold

なし

Codex session ID: 01a1c350-28ad-7340-b277-9dec1f15f559
Resume in Codex: codex resume 01a1c350-28ad-7340-b277-9dec1f15f559

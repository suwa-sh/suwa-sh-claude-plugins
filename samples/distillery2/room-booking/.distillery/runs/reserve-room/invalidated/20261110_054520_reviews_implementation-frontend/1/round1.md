## (1) 観点サマリ表

| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | シナリオと契約との縦の整合 | PASS | なし | 予約・照会の要求項目、成功応答、業務エラーの扱いを features と OpenAPI に照合した |
| P2 | ルールと ADR | CONCERN | 指摘 1 | クエリ変更時の初期値が ADR 0021 の画面間引き継ぎと食い違う |
| P3 | ティアどうしの横の整合 | CONCERN | 指摘 2 | 会議室一覧 API の失敗後、画面から再取得できない状態がある |
| P4 | 補った前提 | CONCERN | 指摘 3 | 予約完了後の移動先が利用可能である前提が、ルート表と一致しない |

## (2) 指摘

### 指摘 1
- **perspective**: P2
- **対象**: `apps/frontend/src/screens/ReserveRoom/ReserveRoomScreen.tsx:35`
- **severity**: medium
- **claim**: 同じ `/reservations/new` でクエリだけが変わっても、フォームの初期値が更新されない。
- **evidence**: `value` は `useState(() => initialReservationValue(query))` で初回だけ作られる。ADR 0021 は `pathname` と `search` の双方を追ってクエリを画面に渡すと定め、`App.tsx:28-37` もその形で再描画するが、画面側にクエリ変更を反映する処理はない。
- **why_raised**: ブラウザの戻る・進むなどで予約画面の別のクエリへ移った社員に、URL と異なる会議室・時間帯が残り、そのまま予約を送れてしまう。
- **suggested_fix**: クエリの変更時に画面の状態を初期化できるよう、ルート側でクエリに応じた `key` を付けるなど、ADR の「移った先で初期値として使う」動作を保つ。

### 指摘 2
- **perspective**: P3
- **対象**: `apps/frontend/src/screens/ReserveRoom/ReserveRoomScreen.tsx:54-65,75-87`、`packages/ui/components/domain/ReservationForm.tsx:74-81`
- **severity**: medium
- **claim**: クエリ無しで予約画面を開き、会議室一覧の取得に失敗すると、画面上で再取得できない。
- **evidence**: 取得失敗時は `rooms` が空のままになる。再取得は `confirmedValue()` にあり、フォームの `onSubmit` からだけ呼ばれる。一方、フォームは `roomId` が未入力なら `onSubmit` を呼ばず、空の選択肢から会議室も選べない。
- **why_raised**: 一時的な API 障害の後、社員は画面を再読み込みしない限り予約操作を続けられない。
- **suggested_fix**: 会議室一覧の取得エラーに独立した再試行操作を設ける。

### 指摘 3
- **perspective**: P4
- **対象**: `apps/frontend/src/screens/ReserveRoom/ReserveRoomScreen.tsx:128`、`apps/frontend/src/routes.tsx:26-49`
- **severity**: medium
- **claim**: 予約完了画面の「自分の予約一覧を見る」は、現在のルート表に無い `/my-reservations` へ移動する。
- **evidence**: ボタンは `MY_RESERVATIONS_PATH` に遷移するが、`routes` には `/availability`、`/reservations/new`、`/auth/callback` しか登録されていない。`App.tsx:38-43` は一致するルートが無ければ「画面が見つかりません」を表示する。
- **why_raised**: 予約直後にこのボタンを押した社員が予約一覧へ進めず、設計上の完了画面からの導線が行き止まりになる。
- **suggested_fix**: 一覧画面が利用可能になるまで導線の扱いを決め、公開する場合は対応ルートを登録する。

## (3) below-threshold

なし

Codex session ID: 01a1c3d7-9584-7872-a922-4d8cf2daa8b4
Resume in Codex: codex resume 01a1c3d7-9584-7872-a922-4d8cf2daa8b4

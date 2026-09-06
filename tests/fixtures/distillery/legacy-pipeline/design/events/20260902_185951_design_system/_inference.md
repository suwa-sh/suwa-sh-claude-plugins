# 推論根拠（feedback 差分実行）

対象は packet の `allowed_work_unit_ids` 2 件のみ。デザインシステム全体の再推論は行っていない。

## 1. CR-d0f57ea2-006#1 — loading-state-components

### 現状の確認

| 観点 | 実測 |
|------|------|
| 既存の loading 資産 | `Skeleton`（variants: line / table）、`SkeletonTable`、`Button` の loading 状態（`ds-spin` + refresh-cw アイコン） |
| Spinner コンポーネント | 無し。`ds-spin` クラスは `Button.tsx` からのみ使用 |
| 利用条件の記述 | `AsyncSection` の「一覧は table、詳細・カードは line」というコメントのみ |
| NFR | B.2.1.1（レスポンス 5 秒以内）→「全一覧・詳細に Skeleton」、F.3.1.2（JIS X 8341-3 AA 目標）→ 色以外の手掛かり |

「操作起点の短い待ち」「画面全体をブロックする待ち」「カード一覧・詳細の読み込み」に対応する
共通コンポーネントと選択基準が無く、画面ごとに独自 UI が生まれる状態だった。

### 導出

- 待ちの形が事前に決まっている（行・列・定義リスト）→ Skeleton。レイアウトシフトを防げる
  → `list` / `card` / `detail` / `line` の 4 kind
- 待ちの形が変わらない・操作起点 → Spinner。`action`（inline）と `page`（overlay）の 2 kind
- 選択を画面に委ねると再発するため、`LoadingState` を唯一の入口にし、`AsyncSection` も委譲させる
- サイズは既存の spacing/フォントスケールと整合する 1rem / 1.5rem / 2.5rem
- 色は `--spinner-track`（gray-200、dark は gray-700）と `--spinner-indicator`（`--primary` = ポータル色に追随）
- overlay の背面は modal backdrop（`rgba(15,23,42,0.45)`）より薄い `rgba(255,255,255,0.72)`。
  モーダルではなく「待ち」であることを見た目で区別する
- 回転は 900ms（既存 `ds-spin` の実測値を踏襲）。`prefers-reduced-motion` の既存ルールで停止する
- 遅延表示 `delayMs` の既定は 0。既存 41 画面の `Loading` Story と E2E が t=0 で状態を観測できることを優先し、
  ちらつきが問題になる領域だけ画面側で 300ms を指定する

## 2. CR-d0f57ea2-010#1 — app-shell-routing-ownership

### 現状の確認

| 観点 | 実測 |
|------|------|
| route の定義 | `design-event.yaml` の `screens[].route`（41 件）に存在 |
| ルート表 | 無し。route id・パラメータ名・ナビ対応を持つ生成物が無い |
| エントリポイント | `src/app/layout.tsx` は create-next-app 既定のまま（メタデータも "Create Next App"）。ポータル・ルート解決を持たない |
| 画面骨格 | `PortalPageLayout` / `PortalShell` は存在するが、`activeNavId` を画面側が指定する |
| 遷移 API | 無し。`PortalShell.onNavigate` は id を返すだけで遷移先が未定義 |

### 導出

- ルート表は `screens[].route` と 1:1（41 件）で機械生成する。RDRA に無いルートは作らない
- route id は `{portal}-{対象}-{操作}` の kebab で一意化する
  （`/reservations/holds` と `/reservations/holds/:reservationId` のようにパスだけでは衝突するため）
- `nav`（サイドバーのアクティブ項目）は RDRA `BUC.tsv` の `業務` から決める。
  `PortalShell` の nav 項目は `business` を持つため機械的に対応づく。
  利用者ポータルの `利用照会業務` は `loans` / `history` の 2 ナビに割れるため、
  貸出履歴・返却完了のみ `history` へ明示割り当てする
- `matchPath` は静的セグメントの多い定義を優先する（`/loans/history` と `/loans/:loanId` が同セグメント数で競合するため）
- 所有権は「URL とシェルはデザインシステム、router アダプタとページ本体は実装リポ」に固定する。
  実装リポが差し込む口を `AppShell.onNavigate` の 1 つに絞り、URL 文字列の直書きを構造的に不可能にする
- ポータル外アクセスと 404 は `AppShellByPath` で判定する。
  arch SP-004（本人限定参照の UI 制約）・NFR E.5.3.1（司書機能は館内限定）を画面ごとに再実装させない

## 3. RDRA 整合性

- 画面（screens）の追加・削除は無い。ルート表は既存 41 件と完全一致する
- `docs/todo.md` への追加登録は不要（RDRA に無い要素を必要としていない）

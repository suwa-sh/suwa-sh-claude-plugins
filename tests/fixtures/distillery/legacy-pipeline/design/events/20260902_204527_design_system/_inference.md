# 推論根拠

## 対象 work unit

- `CR-d0f57ea2-006#1`（constraint_key: `loading-state-components`、direct_stage: `design_system`）
- 要求: loading 状態を表現する共通 component と利用条件を design 成果物に追加する
- 完了条件: 画面実装が独自 UI を追加せず、指定 component だけで loading 状態を再現できる

## 現状分析（stage 直前の正本）

`docs/design/latest/design-event.yaml`（前回イベント 20260902_185951_design_system 適用済み）を確認した。

| 要素 | 状態 | 実体 |
|------|------|------|
| `Skeleton`（line/table/card/detail） | 生成済み | `src/components/ui/Feedback.tsx` |
| `Spinner`（inline/button/overlay、sm/md/lg） | 生成済み | `src/components/ui/Feedback.tsx` |
| `LoadingState`（loading 表現の唯一の入口） | 生成済み | `src/components/common/LoadingState.tsx` |
| 利用条件（kind 出し分け・併用禁止・aria-busy・delayMs） | 定義済み | `components.common[].description` / `Common/LoadingState` docs |
| spinner / overlay トークン（dark 上書き含む） | 定義済み | `tokens.component.spinner` / `tokens.component.overlay` |

したがって「共通 component と利用条件が存在しない」という一次的な欠落は**無い**。

## 観測事実とのギャップ特定

CR の観測事実は「取り込み済み Storybook components から Skeleton と Spinner を**参照できなかった**」である。
実体の欠落ではなく解決性（名前 → ファイル → export の対応）の欠落と判断した。根拠は次の 3 点。

1. `Skeleton` / `Spinner` / `Alert` / `EmptyState` は単独ファイルではなく
   `src/components/ui/Feedback.tsx` に同居する。ファイル名で探すと見つからない
   （実測: `find src -name "Skeleton*" -o -name "Spinner*"` は 0 件）
2. `design-event.yaml` の `components.ui[]` は `name` / `variants` / `sizes` だけを持ち、
   `path` を持つのは `components.common[]` の一部だけだった
3. 取り込み側は `storybook-app/src/` の実ファイル列挙でコピーする方式のため、
   ファイル自体は取り込まれているが、成果物側に名前 → ファイルの対応表が無い

## 設計判断

- `components.ui[]` の全件に `path` / `exports` を付与し、成果物定義だけで import 先を解決可能にする
- `Skeleton` / `Spinner` には `usage` を付与し、「LoadingState 経由で使う」利用条件をコンポーネント定義に埋め込む
- `LoadingState` の description に import 規約を追記し、完了条件「指定 component だけで再現できる」を明文化する
- Storybook 側にも import 解決表を載せ、実装者が Storybook から辿れるようにする
- 実装ファイルの分割は行わない（取り込み済み `packages/ui` の import パスを壊すため。design-decision-008）

## NFR / Arch との整合

- 既存 nfr_decision「B.2.1.1 / F.3.1.2: loading 表現を LoadingState に集約する」を変更していない。
  本イベントは同決定の**参照可能性**を補強するものであり、新たな NFR 決定は追加しない
- `docs/arch/latest/_digest`（`system_architecture.yaml` / `technology_context.yaml`）の
  frontend tier 構成・技術選定に変更は無く、レイアウト・トークンへの影響も無い

## RDRA 整合性

- 画面（`screens[]` 41 件）・ルート表・状態モデルに追加・削除は無い
- RDRA（`docs/rdra/latest/`）に存在しない画面・要素を追加していない
- `docs/todo.md` への追記は発生していない（RDRA 追加提案なし）

## Step8（画面確認）の代替検証

`docs/design/latest/storybook-app/node_modules` が未配置で、controller 指示により
`npm install` / Storybook build / dev server 起動を行わないため、実機の画面確認は実施していない。
代替として次の静的検証を実施した。

| 検証 | 方法 | 結果 |
|------|------|------|
| `Skeleton` / `Spinner` の実在と export 名 | `src/components/ui/Feedback.tsx` の export 宣言列挙 | Alert / EmptyState / Skeleton / SkeletonTable / SkeletonCard / SkeletonDetail / Spinner の 7 件を確認 |
| `path` の実在 | `components.ui[].path` 14 件をファイルシステムで突合 | 全件存在 |
| `LoadingState` の kind → component 結線 | `LoadingState.tsx` の分岐と `usage` の記述を突合 | list/card/detail/line=Skeleton 系、action/page=Spinner で一致 |
| 編集した Story の構文 | 文字列リテラル閉じの機械チェック | 不整合 0 件 |
| `design-event.yaml` の妥当性 | `validateDesignEvent.js` | PASS（Portals 2 / Components 53 / Screens 41 / State Models 6） |
| 派生物の再生成 | `generateDesignEventMd.js` / `buildDigest.js docs --domain design` | 成功（8 sections） |

視覚品質（はみ出し・文字切れ・コントラスト・色解決）は本変更が視覚表現を変更していない
（YAML メタデータと docs 文字列のみの変更）ため、リグレッションは発生しない。

# 公開サンプルの再生成記録

## 入力の復元

| 項目 | 内容 |
|---|---|
| 元データ | リポジトリの `e9dab09a0c25af48fe7a670c82803452e53c4401` にある `samples/distillery/pipeline-fable-low/` |
| 再開位置 | dist-pipeline Step6（dist-spec） |
| 初期design | `20260903_041812_design_system` |
| 復元した領域 | input、USDM、RDRA、NFR、architecture、infrastructure、MCL、design |
| 前段の仮採用記録 | todo.mdのDIST-001からDIST-028 |
| 後段の入力 | 旧specと旧ページStoriesを除外 |
| 実行モデル | 現セッションの設定を継承。元サンプルのモデル指定は引き継がない |
| 判断の方針 | 通常pipelineのauto_adopt |

初期designイベントはStorybook実装を保存していません。
初期の宣言一覧に基づいて最新実装から後段のPagesとcommon部品を除き、Step5完了状態を再構成しました。
Git履歴と `/private/tmp` の既存コピーを調べましたが、Fableの初期実装の完全なスナップショットは見つかりませんでした。
初期入力の各ファイルとSHA-256は[checkpoint.json](checkpoint.json)を参照してください。

## 前段の補正

| 所有工程 | 採用した内容 | 新規イベント |
|---|---|---|
| architecture | 認証・監査・通知の保存責任と原子的な更新 | [storage ownership](../arch/events/20260906_132303_spec_storage_ownership/) |
| design | 予約できる書籍状態と既存画面へのナビゲーション | [design system](../design/events/20260906_132217_design_system/) |
| USDM / RDRA | 利用者削除の制約、検索条件、ランキング同順位の扱い | [business conditions](../rdra/events/20260906_141633_spec_business_conditions/) |

生成中に見つかった不足は、[変更要求](../specs/latest/feedback-requests/20260906_132000_spec_feedback_renew001.md)へ具体案を記録し、auto_adoptで所有工程へ反映しました。
仕様は採用後の振る舞いを表し、参照する正本はlatestです。
[採用後の照合記録](../specs/events/20260906_131731_spec_generation/_review/proposal-baseline.md)で5件の変更要求と実際の反映先を確認できます。
これは通常pipeline内の補正です。独立したfeedback request modeのcontroller実行履歴はありません。

## 仕様の生成結果

| 対象 | 結果 |
|---|---|
| UC | 27件 / 6業務 / 10 BUC |
| HTTP | 29操作。OpenAPIをpaths/componentsで分割 |
| 非同期処理 | 8操作。AsyncAPIをoperations/channels/messages等で分割 |
| RDB | 17テーブル。5サブドメインに分割 |
| UCの機械検査 | API要約・モデル要約・本文の81検査PASS |
| DB操作 | 188操作の列・値・対象条件を照合 |
| 独立レビュー | 15指摘を修正・再確認。27 UC ready |
| RDRAとの対応 | 27/27 UC、条件15、属性58、状態遷移16、バリエーション値23、外部システム1に対応箇所あり |

参照の存在と意味の充足は別に確認しています。
[網羅の照合結果](coverage-check.json)と[実装着手の判定](../specs/events/20260906_131731_spec_generation/_review/implementation-readiness.md)を参照してください。

生成時に検出したスクリプトの不整合も修正しました。
分割RDBのMarkdownは、全17テーブルと正本への参照索引を生成します。
仕様の検査は責務の見出しとRDRA参照の表・リストを受け入れ、最新検査は警告0です。
イベント内の初回ログにある旧書式の79警告は、この修正前の記録です。

## Storybookの検証

| 対象 | 結果 |
|---|---|
| 画面 | 24画面 / 169 Story variants。既存38部品を利用 |
| 操作テスト | 169/169 PASS。再送・再読込・動的ID・2ページ目を含む |
| ビルド / TypeScript | PASS |
| 宣言と実体 | 全画面・全exportを照合。未解決のレビュー指摘0 |
| ブラウザ | 全24画面を幅1366px、利用者6画面を幅390pxで表示確認 |

[生成イベント](../design/events/20260906_152256_spec_stories/)に、3回の独立レビューと全テスト名・結果・ソース一覧を保存しています。
[最終検証結果](validation.json)を参照してください。
日本語ファイル名のテスト登録を妨げていたStorybookの変換処理は、サンプルのVitest設定で補正しました。

```sh
cd samples/distillery/pipeline/design/latest/storybook-app
npx playwright install chromium
npx vitest run src/stories/Pages
npm run build-storybook
```

## サンプルを開く

- [仕様の一覧](../specs/latest/README.md)
- [OpenAPI入口](../specs/latest/_cross-cutting/api/openapi/openapi.yaml) / [結合済みOpenAPI](../specs/latest/_cross-cutting/api/generated/openapi.bundle.yaml)
- [AsyncAPI入口](../specs/latest/_cross-cutting/api/asyncapi/asyncapi.yaml) / [結合済みAsyncAPI](../specs/latest/_cross-cutting/api/generated/asyncapi.bundle.yaml)
- [RDB索引](../specs/latest/_cross-cutting/datastore/datastore-schema.md)

Storybookはリポジトリルートから次のコマンドで起動できます。

```sh
cd samples/distillery/pipeline/design/latest/storybook-app
npm ci
npm run storybook
```

ビルド成果物とnode_modulesは公開サンプルに含めていません。

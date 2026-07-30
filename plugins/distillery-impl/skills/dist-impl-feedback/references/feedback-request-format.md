# feedback-request Markdown契約（producer向け）

dist-implからdist-pipelineへ渡す外部入力は、公開済みMarkdown **1ファイルのパスだけ**である。
本文をJSONへ複製しない。stageの判定・分割・依存閉包はdist-pipelineが行う。

機械的な解析規則の正本はdistillery側の `dist-pipeline/references/feedback-request-format.md` と
`dist-pipeline/scripts/feedbackRequest.js` である。本書はproducerが書く内容を説明し、独自parserや
schemaを定義しない。

## 配置とライフサイクル

- レビュー前draft: `docs/impl/latest/{uc_id}/feedback/draft.md`
- 公開入力: `docs/impl/latest/{uc_id}/feedback-requests/{feedback_id}.md`
- publishは検証済みdraftを同じbytesのままatomic renameする
- 公開済みファイルは編集・上書きしない
- 訂正版は新しい `feedback_id` とファイルを使い、任意の `supersedes` で旧IDを示す
- 有効要求が0件なら公開ファイルを作らない

## 例

````markdown
---
schema_version: distillery.feedback-request/v1
feedback_id: 20260730_120000_impl_feedback_3f9a2b1c
created_at: 2026-07-30T12:00:00+09:00
source: distillery-impl
uc_id: 3f9a2b1c
---

# 実装からの変更要求

## CR-3f9a2b1c-001: 認証ヘッダー契約が未定義

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-backend-api.md]

### 観測した事実

統合テストでは利用者識別子が必要だったが、API契約に送信方法が定義されていなかった。

### 現在の仕様と問題

認証方式はNFRに記載されている一方、対象APIのヘッダーと401応答が仕様に存在しない。

### 変更してほしいこと

利用者識別情報の送信方法と、欠落・不正時のエラー契約を仕様として定義する。

### 完了条件

クライアントとサーバーが推測なしに同じ認証ヘッダーと401応答を実装できる。
````

## 書式要件

- bytesはUTF-8 BOMなし、改行LF、Unicode NFC
- front matterはbyte 0から始め、許可キーだけを使う:
  `schema_version`, `feedback_id`, `created_at`, `source`, `uc_id`, 任意の `supersedes`
- version 1は単一UC。`uc_id`は通常8文字、uc-map全体の衝突延長時は12文字の小文字英数字
- `feedback_id` / `supersedes` は `^[a-z0-9][a-z0-9._-]{0,127}$`
- CR見出しは `## {CR-ID}: {一行タイトル}`。IDはファイル内で一意
- 各CRのmetadataは `severity`, `related_ids`, 任意の `related_files` をそれぞれ1つのinline bulletで書く
- CR見出しから最初のH3までは、空行と上記metadata bullet以外を書かない
- severityは `blocker | spec-gap | improvement`
- related IDsは空にせず安全な識別子を列挙する
- related fileはworkspace相対のportable path。絶対path、`..`、backslashは禁止
- H3は `観測した事実` → `現在の仕様と問題` → `変更してほしいこと` → `完了条件` の順で各1回、本文必須
- fenced code block内の見出しは本文データであり、CRや節として解釈しない
- fenced code blockはファイル内で必ず閉じる
- 未知・重複metadata、未知の構造H2/H3、空要求は公開しない

## 内容要件

- **観測した事実**: 実装・テスト・検証で再現した事実と証拠。推測を書かない
- **現在の仕様と問題**: 仕様の記述または欠落と、実装で生じる矛盾
- **変更してほしいこと**: 業務・仕様上の期待を記述する。stageや内部成果物の割当てを指定しない
- **完了条件**: dist-pipelineの処理後に外部から確認できる状態

`related_files` はルーティングのヒントであり、ファイルアクセス許可でも外部依存でもない。
本文は関連ファイルを読まなくても要求を理解できるようにする。

次を含めてはならない。

- 所有stageを指定するfieldやstage enum
- stage別instruction、個別処理指示、実行順
- reviewer、承認時刻、approval event、route hash
- 元Markdown本文の別コピーや手入力hash

## dist-pipelineへの入力

```text
/distillery:dist-pipeline docs/impl/latest/{uc_id}/feedback-requests/{feedback_id}.md
/distillery:dist-pipeline docs/impl/latest/{uc_id}/feedback-requests/{feedback_id}.md --recommended-auto
```

interactive modeで所有先が曖昧な場合、dist-pipelineは業務上の意味を尋ね、推奨案・代替案・影響・
根拠を提示する。`--recommended-auto`は、全案の意味・制約が同一でdirect ownerだけが異なる、
confidence medium以上の安全かつ一意なpipeline内部routeだけを自動採用する。それ以外の
recommendableは同じpolicyのまま人の回答を待つ。dist-implはどちらのmodeでもstageを知る必要がない。

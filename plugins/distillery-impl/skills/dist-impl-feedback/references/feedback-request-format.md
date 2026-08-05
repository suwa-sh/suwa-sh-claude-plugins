# Feedback request形式（producer向け参照）

dist-implからdist-pipelineへ渡す入力は、公開済みMarkdown **1ファイルのパスだけ**です。

機械検証の正本は`dist-pipeline/references/feedback-request-format.md`と`dist-pipeline/scripts/feedbackRequest.js`です。
この文書はproducerが書く内容だけを説明します。書式・必須項目は正本と整合させます。

## ファイル構造

```markdown
---
schema_version: distillery.feedback-request/v1
feedback_id: 20260730_120000_impl_feedback_3f9a2b1c
created_at: 2026-07-30T12:00:00+09:00
source: distillery-impl
uc_id: 3f9a2b1c
---

## CR-3f9a2b1c-001: 認証ヘッダー契約が未定義

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/example/tier-backend-api.md]

### 観測した事実

実装やテストで確認した事実と証拠を書く。

### 現在の仕様と問題

現在の記述または欠落と、実装への影響を書く。

### 変更してほしいこと

業務または仕様上の期待を書く。

### 完了条件

変更後に確認できる状態を書く。
```

## ファイルの状態

| 状態 | path | 更新方法 |
|---|---|---|
| review前 | `docs/impl/latest/{uc_id}/feedback/draft.md` | S8 initialまたはrefreshで更新 |
| 公開後 | `docs/impl/latest/{uc_id}/feedback-requests/{feedback_id}.md` | 承認済みdraftをatomic rename |

## producer側の確認項目

- bytesはUTF-8、BOMなし、LF、Unicode NFCにする。
- front matterはbyte 0から始める。
- CR IDはファイル内で一意にする。
- `severity`と`related_ids`を必ず書く。
- `related_files`にはworkspace相対pathだけを書く。
- 4つのH3を決められた順序で各1回書く。
- fenced code blockを同じCR内で閉じる。

次の情報は公開Markdownへ含めません。

- 所有stageとstage enum
- stage別の指示と実行順
- reviewer、承認時刻、approval event
- route hashと手入力のcontent hash

## dist-pipelineの実行

```text
/distillery:dist-pipeline docs/impl/latest/{uc_id}/feedback-requests/{feedback_id}.md
/distillery:dist-pipeline docs/impl/latest/{uc_id}/feedback-requests/{feedback_id}.md --recommended-auto
```

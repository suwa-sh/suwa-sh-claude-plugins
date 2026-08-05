# Feedback requestの書き方（producer向けガイド）

dist-implからdist-pipelineへ渡す入力は、公開済みMarkdown **1ファイルのパスだけ**です。
本文をJSONへ複製しません。
stageの判定と実行計画はdist-pipelineが作ります。

機械検証の正本は、distillery側の`dist-pipeline/references/feedback-request-format.md`と`dist-pipeline/scripts/feedbackRequest.js`です。
この文書はproducerが書く内容だけを説明する別役割の文書です。同一内容へ揃える対象ではありませんが、
**記載する書式・必須項目は機械検証の正本と整合させます**（正本のスキーマ変更時はこの文書も追随させます）。

## ファイルの状態

| 状態 | path | 更新方法 |
|---|---|---|
| review前 | `docs/impl/latest/{uc_id}/feedback/draft.md` | S8 initialまたはrefreshで更新 |
| 公開後 | `docs/impl/latest/{uc_id}/feedback-requests/{feedback_id}.md` | 承認済みdraftをatomic rename |

公開済みファイルは編集しません。
訂正時は新しい`feedback_id`を使い、必要なら`supersedes`で旧IDを示します。
有効な要求が0件なら公開ファイルを作りません。

## 記述例

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
- related_files: [docs/specs/latest/example/tier-backend-api.md]

### 観測した事実

統合テストでは利用者識別子が必要だったが、API契約に送信方法が定義されていなかった。

### 現在の仕様と問題

認証方式はNFRにあるが、対象APIのヘッダーと401応答が仕様にない。

### 変更してほしいこと

利用者識別情報の送信方法と、不正時のエラー契約を定義する。

### 完了条件

クライアントとサーバーが、同じヘッダーと401応答を推測なしに実装できる。
````

## 各節に書く内容

| 節 | 内容 |
|---|---|
| `観測した事実` | 実装やテストで確認した事実と証拠 |
| `現在の仕様と問題` | 現在の記述または欠落と、実装への影響 |
| `変更してほしいこと` | 業務または仕様上の期待 |
| `完了条件` | pipeline処理後に確認できる状態 |

推測は`観測した事実`へ書きません。
stage名と内部成果物の割当ては`変更してほしいこと`へ書きません。

## producer側の確認項目

- bytesはUTF-8、BOMなし、LF、Unicode NFCにする。
- front matterはbyte 0から始める。
- CR IDはファイル内で一意にする。
- `severity`と`related_ids`を必ず書く。
- `related_files`にはworkspace相対pathだけを書く。
- 4つのH3を決められた順序で各1回書く。
- fenced code blockを同じCR内で閉じる。

`related_files`はroutingのヒントです。
本文は関連ファイルを読まなくても理解できる内容にします。

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

対話モードでは、dist-pipelineが推奨案、代替案、影響、根拠を提示します。
`--recommended-auto`は、要求の意味を変えない安全なroutingだけを自動採用します。
dist-implがstageを知る必要はありません。

実行は**新しいセッション（または`/clear`後）**で行います。
入力は公開Markdown 1ファイルで完結するため、実装セッションの会話コンテキストは不要です。
実行コマンドと判断材料は`docs/impl/latest/{uc_id}/NEXT.md`に永続化されています。

# Feedback request Markdown契約

dist-pipelineが外部から受け取る入力は、`distillery.feedback-request/v1` Markdownのパス1つです。
Markdown本文を変更要求の外部正本とします。
routing JSON、stage別ファイル、レビュー情報は受け取りません。

```text
/distillery:dist-pipeline path/to/feedback-requests/{feedback_id}.md
/distillery:dist-pipeline path/to/feedback-requests/{feedback_id}.md --recommended-auto
```

## ファイル構造

```markdown
---
schema_version: distillery.feedback-request/v1
feedback_id: 20260730_120000_impl_feedback_19ec0182
created_at: 2026-07-30T12:00:00+09:00
source: distillery-impl
uc_id: 19ec0182
---

## CR-19ec0182-001: 認証契約が未定義

- severity: spec-gap
- related_ids: [REQ-002, SPEC-002-01]
- related_files: [docs/specs/latest/example/openapi.yaml]

### 観測した事実

観測した事実を書く。

### 現在の仕様と問題

現在の仕様と不足を書く。

### 変更してほしいこと

必要な仕様変更を書く。

### 完了条件

変更後に確認できる状態を書く。
```

## 検証規則

| 対象 | 規則 |
|---|---|
| bytes | UTF-8、BOMなし、LF、Unicode NFC |
| front matter | byte 0から開始し、許可keyだけを使う |
| `feedback_id` | `^[a-z0-9][a-z0-9._-]{0,127}$` |
| `uc_id` | 通常は小文字英数字8文字、衝突延長時は12文字 |
| `source` | 実装からは `distillery-impl`、dist-spec で検出した上流不足からは `distillery-spec` |
| CR | `## CR-...: title`形式で1件以上、IDは一意 |
| metadata | `severity`と非空の`related_ids`は必須、`related_files`は任意 |
| 本文 | 4つのH3を表の順序で各1回置き、本文を空にしない |

front matterで使えるkeyは次の6種類です。

- `schema_version`
- `feedback_id`
- `created_at`
- `source`
- `uc_id`
- `supersedes`（任意）

CR本文では次のH3だけを使います。

1. `観測した事実`
2. `現在の仕様と問題`
3. `変更してほしいこと`
4. `完了条件`

未知のkey、重複metadata、未知の構造見出し、空の要求は拒否します。
`target_stage`などのrouting指示も拒否します。
fenced code block内の見出しは本文データとして扱います。
fenceは同じCR内で閉じる必要があります。

`related_files`はroutingのヒントであり、ファイルの読取り許可ではありません。
関連ファイルを開かなくても要求を理解できる本文にします。

`source`は検出元を示し、変更先stageを指定しません。dist-specがRDRAやdesignの不足を
検出した場合も、同じ4節で観測事実と正本への変更要求を記述します。
発行しただけの要求には、実行済みを表すowner dispositionやdomain eventのledgerを付けません。

## candidateの判定

次のいずれかに該当する入力をfeedback candidateとして扱います。

- `--feedback`または`--recommended-auto`を指定した。
- pathに`feedback-requests`要素がある。
- 先頭front matterにfeedback用の予約keyまたは値がある。

candidateのparseに失敗した場合、normal modeへ切り替えません。

次のコマンドは事前診断です。
run identity、lease、不変snapshotは確定しません。

```text
node scripts/feedbackRequest.js verify path/to/input.md [--feedback] [--recommended-auto]
```

authoritative beginは外部pathを1回だけ読みます。
同じBufferで検証、SHA-256、lease取得、`input.md`作成を行います。

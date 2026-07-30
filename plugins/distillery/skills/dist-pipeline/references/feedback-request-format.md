# Feedback request Markdown contract

`dist-pipeline` の外部入力は `distillery.feedback-request/v1` Markdown 1ファイルだけである。
Markdownが唯一の外部正本であり、stage名、stage別directive、review情報、入力hashは含めない。
実装レビューの方法・承認記録・レビューレポートは`dist-impl`側の履歴であり、pipeline入力契約ではない。

呼出し側はこのMarkdownのfile pathだけを渡す。
dist-pipelineが本文、`related_ids`、`related_files`をdataとして分類し、direct ownerを内部判定する。
dist-pipelineがwork unitへ分解し、direct ownerからcatalog末尾までの保守的suffixをstage packetへ振り分ける。
外部のrouting JSONやstage別入力fileは受け取らない。

```text
/distillery:dist-pipeline path/to/feedback-requests/{feedback_id}.md
/distillery:dist-pipeline path/to/feedback-requests/{feedback_id}.md --recommended-auto
```

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
観測事実。

### 現在の仕様と問題
現在の仕様と不足。

### 変更してほしいこと
必要な仕様変更。

### 完了条件
変更後に満たす状態。
```

## 厳密性

- UTF-8 BOMなし、LF、Unicode NFC。
- front matterの許可keyは `schema_version`, `feedback_id`, `created_at`, `source`, `uc_id`, optional `supersedes` だけ。
- `feedback_id` / `supersedes` は `^[a-z0-9][a-z0-9._-]{0,127}$`、`uc_id` は通常8文字、uc-map衝突延長時は12文字（`^[a-z0-9]{8}(?:[a-z0-9]{4})?$`）。
- 1件以上の `## CR-...: title` を持ち、IDは一意。公開fileにwithdrawn requestは含めない。
- metadataは各requestの最初のH3より前に置く。空行と、`- severity: ...`、
  `- related_ids: [...]`、`- related_files: [...]`の許可bullet以外は置けない。
  `severity` と非空 `related_ids` は必須、`related_files` はoptional。未知key、bulletでない本文、
  `target_stage` / `target-stage`等のrouting指示は拒否する。
- H3は上記4見出しを各1回、順序通りに置き、本文を非空にする。
- fenced code block内の見出しはdataでありrequest構造にしない。すべてのfenceは同じrequest内で閉じる。
  EOFまたは次requestまで閉じないfence、未知の構造H2/H3は拒否する。
- `related_files` はrouting hintであり、読取り許可ではない。Markdown単体でrequestを理解できること。

`--feedback` / `--recommended-auto`、pathの `feedback-requests` component、leading front matterの
reserved feedback key/valueのどれかがあればcandidateとする。candidateのparse失敗はnormal modeへfallbackしない。
次の`verify`は事前診断にすぎず、leaseや実行identityを確定しない。authoritativeな検証・hash・snapshotは
begin transactionが外部pathを1回だけBufferへ読み、同じbytesで行う。

```text
node scripts/feedbackRequest.js verify path/to/input.md [--feedback] [--recommended-auto]
```

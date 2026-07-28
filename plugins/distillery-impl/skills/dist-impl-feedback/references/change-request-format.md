# 変更要求ファイル フォーマット正本(distillery-impl → distillery)

`distillery:dist-requirements` は「変更要望テキスト(任意ファイル名)のパス」を入力に取る。
そのため変更要求ファイルは、**front matter を除いた本文がそのまま変更要望テキストとして通用する**形にする。

## 配置

`docs/impl/latest/{uc_id}/change-requests/{YYYYMMDD_HHMMSS}_{slug}.md`(1 問題 = 1 ファイル。
日時は `date +%Y%m%d_%H%M%S`)

## フォーマット

```markdown
---
source: distillery-impl
uc_id: "3f9a2b1c"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
discovered_at_stage: "S4 tier-impl (tier-backend-api)"
related_ids: [REQ-002, SPEC-002-01]        # 不明なら []
related_files:
  - "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-backend-api.md"
severity: blocker | spec-gap | improvement
---

# 変更要望: {一行タイトル}

## 現状の仕様

{仕様のどこに何と書かれているか。引用と出典パス}

## 実装で判明した問題

{実装・検証で確認した事実。実行結果・矛盾の内容}

## 提案する変更

{仕様をどう直すべきか。選択肢があれば列挙}

## 影響範囲

{影響する UC / tier / 契約。わかる範囲で}
```

## severity の意味

- **blocker**: この仕様のままでは実装を完了できない(UC を blocked_on_spec にする候補)
- **spec-gap**: 実装は回避策で進められるが、仕様に欠落・曖昧がある
- **improvement**: 仕様は成立しているが改善余地(payload title 欠落による無名スキーマ等)

## dist-requirements への受け渡し

ユーザー(またはパイプライン)が distillery ワークスペースで実行する:

```
/dist-requirements 引数: "docs/impl/latest/{uc_id}/change-requests/{ファイル名}.md"
```

複数の変更要求は 1 件ずつ渡す(USDM 差分の traceability を保つ)。

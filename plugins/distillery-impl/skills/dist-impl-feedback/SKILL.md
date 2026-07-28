---
name: distillery-impl:dist-impl-feedback
description: >
  distillery-impl の還流スキル。実装セッションで見つかった仕様の問題を distillery
  (dist-requirements の差分パイプライン)へ渡せる変更要求ファイルにまとめ、ハマりどころを learnings として
  保存し、skill・プロジェクト CLAUDE.md へ反映すべき学びを「提案」として整理する(自動編集はしない)。
  dist-impl-run(S8)から呼ばれるほか、「実装の学びを整理して」で単体起動もできる。
---

# dist-impl-feedback

引数: `uc_id={id} config={impl-config.yaml へのパス}`

## 入力

- `docs/impl/latest/{uc_id}/issues/`(Implementer / integration writer が書き捨てた仕様疑義)
- `attempt-*/S5_verify.*.findings.yaml`(Verifier の findings。特に仕様起因のもの)
- bootstrap / S1 の報告に含まれた矛盾検査・欠落(asyncapi 無名スキーマ、criteria 欠落 SPEC 等)

## 手順

### 1. 変更要求の生成(仕様起因のものだけ)

1. issues / findings を分類する: **仕様起因**(仕様が誤り・欠落・矛盾)/ **実装起因**(実装で解決済み or
   次 attempt で解決すべき)/ **環境起因**。変更要求にするのは仕様起因のみ
2. `references/change-request-format.md` のフォーマットで
   `docs/impl/latest/{uc_id}/change-requests/{ts}_{slug}.md` を書く(1 問題 = 1 ファイル)
3. severity が blocker の変更要求を出した場合は、その旨を結果として返す
   (UC を `blocked_on_spec` にするかはオーケストレータが判断)

### 2. learnings の保存(ハマりどころ)

実装セッションで手戻り・想定外・回避策が発生した事実を
`docs/impl/latest/{uc_id}/learnings/{ts}_{slug}.md` に 1 件 1 ファイルで書く。
様式: **何が起きたか / なぜ(根本原因)/ どう回避したか / 次回どうすべきか** の 4 節。
一般論・感想は書かない(再現可能な事実だけ)。

### 3. skill / コンテキストへの学び提案(自動編集禁止)

learnings のうち一般化できるものを 2 種に分けて**提案ファイル**にまとめ、結果として返す:

- **skill への提案**: distillery-impl 自身(または distillery)の SKILL.md / references を
  どう直すべきか。`learnings/{ts}_proposal-skill.md` に「対象ファイル / 現状の記述 / 提案する変更 /
  根拠となった出来事」を書く
- **プロジェクトコンテキストへの提案**: 実装先リポの CLAUDE.md / dev-rules に足すべき規約。
  `learnings/{ts}_proposal-context.md` に同様式で書く

**既存の SKILL.md・CLAUDE.md・dev-rules を直接編集しない**。採否はユーザー(またはオーケストレータ経由の
ユーザー対話)に委ねる。個人環境の固有機能(特定ベンダーのメモリ機構等)に依存する表現は使わない。

### 4. done の記録

最後に `docs/impl/latest/{uc_id}/stages/S8_feedback.done.yaml` を書く(共通スキーマ +
固有フィールド: `change_requests: {total: N, blocker: M}` / `learnings: K` / `proposals: {skill: bool, context: bool}`)。

## 完了報告

変更要求 N 件(うち blocker M 件)/ learnings K 件 / 提案 2 種の有無とパス。
変更要求があれば「`distillery:dist-requirements` に change-requests/ のファイルパスを渡して
差分パイプラインを実行してください」の案内文を含める。

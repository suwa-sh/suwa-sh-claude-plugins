---
name: distillery-impl:dist-impl-feedback
description: >
  distillery-impl の還流スキル。実装セッションで見つかった仕様の問題を distillery
  (dist-requirements の差分パイプライン)へ渡せる変更要求ファイルにまとめ、ハマりどころを learnings として
  保存し、skill・プロジェクト CLAUDE.md へ反映すべき学びを「提案」として整理する(自動編集はしない)。
  dist-impl-run(S8)から呼ばれるほか、「実装の学びを整理して」で単体起動もできる。
---

# dist-impl-feedback

引数: `uc_id={id} config={impl-config.yaml へのパス} [mode=initial|refresh]`(既定 initial)

- `mode=initial` — S8 として実行。issues / findings から変更要求・learnings をドラフトする(下記手順)。
  **`review/review-notes.md` が存在する場合(S9 差し戻し後の再実行)は必ず入力に含め、
  差し戻し理由・指摘をドラフトに反映する**
- `mode=refresh` — **S9 ヒトレビュー後の最終化**。`review/review-notes.md`(承認対話で出た指摘・
  条件・追加疑義)を読み、既存の変更要求を更新する: ①各項目を 仕様起因 / 実装起因 / 運用条件 に分類
  ②既存変更要求の内容・severity を修正、新規は追加、不要になったものは front matter を
  `status: withdrawn` に変更する(ファイル削除はしない。件数集計・blocker 判定・
  dist-requirements への受け渡しから withdrawn は除外)③`_as-built-summary.md` に「ヒトレビューでの確定事項」節を追記
  ④`S8_feedback.done.yaml` に `refreshed_at` と更新後件数を追記。
  **dist-requirements へ渡す確定版は「review_approved 時点の change-requests(status: active)」**
  (対話で指摘が出た場合は refresh を経てから承認される。特記なしなら initial のまま確定)

## 入力

- `docs/impl/latest/{uc_id}/issues/`(Implementer / integration writer が書き捨てた仕様疑義)
- `attempt-*/S5_verify.*.findings.yaml`(Verifier の findings。特に仕様起因のもの)
- bootstrap / S1 の報告に含まれた矛盾検査・欠落(asyncapi 無名スキーマ、criteria 欠落 SPEC 等)

## 手順

### 1. 変更要求の生成(仕様起因のものだけ)

1. issues / findings を分類する: **仕様起因**(仕様が誤り・欠落・矛盾)/ **実装起因**(実装で解決済み or
   次 attempt で解決すべき)/ **環境起因**。変更要求にするのは仕様起因のみ
2. **as-built ワークフロー**: 変更要求を書く前に `change-requests/_as-built-summary.md`
   (実装が実際に満たす仕様: エンドポイント・状態遷移・ヘッダ契約・エラー応答を、
   仕様どおり / 仕様に無い追加 / 仕様と矛盾 の差分マーカー付きで整理)を生成する。
   **変更要求は as-built との差分として書く**(テスト通過後に as-built を根拠に変更要求を
   ブラッシュアップ → distillery 再実行、という還流サイクルの起点)。
   _as-built-summary.md は変更要求ではない — done の件数集計に含めない(state-schema.md)
3. `references/change-request-format.md` のフォーマットで
   `docs/impl/latest/{uc_id}/change-requests/{ts}_{slug}.md` を書く(1 問題 = 1 ファイル)
4. severity が blocker の変更要求を出した場合は、その旨を結果として返す
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
`mode=refresh` では更新・追加・撤回の内訳も報告する。
変更要求があれば「`distillery:dist-requirements` に change-requests/ のファイルパスを渡して
差分パイプラインを実行してください」の案内文を含める(通常は S9 承認後の refresh を経た
確定版を渡す — ドラフト段階で渡さない)。

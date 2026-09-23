---
name: distillery2:d2-run
description: >-
  distillery2 のオーケストレータ。要求→決定→基盤→UC 縦切りの段階を振り分け、サブエージェントを派遣し、
  ゲートを安い順に実行し、人の判断が要る場面だけ確認ページ (toolbox:human-html-review) を出す。
  UC 単位で 1 commit に squash して PR を作る。通常はこのスキルだけ呼べばよい。
---

# d2-run

> 実装状況: P0 (骨格)。段階の振り分けと実行状態は `scripts/lib/runState.js` を使う。各段階の手順は P1〜P7 で追加する。

## 引数

```
/distillery2:d2-run                 # 次に必要な段階を自動で選ぶ (要求 → 決定 → 基盤 → 未着手 UC)
/distillery2:d2-run stage=requirements input=docs/input/初期要望.txt
/distillery2:d2-run uc=<uc_slug>    # 指定 UC の縦切り (中断からの再開も同じ)
```

## 段階と担当スキル

| 段階 | 担当 | 人の判断 |
|---|---|---|
| ① 要求 | `distillery2:d2-requirements` | UC 一覧・業務ルール・受入基準の承認 |
| ② 決定 | `distillery2:d2-decide` | NFR グレード表と ADR の承認 |
| ③ 基盤 | `distillery2:d2-foundation` → `d2-contract mode=skeleton` → `d2-design` → `d2-foundation phase=F6` | なし (静的ゲート通過で完了) |
| ④ 縦切り | `d2-implement` (scenario / scaffold / tier / integrate) → `d2-verify` → `d2-asbuilt` | シナリオ承認、最終レビュー (前提の承認・却下) |

## 実行状態

`.distillery/runs/<uc_slug>/` に `events.jsonl` (追記のみ) と `stages/<stage>.done.yaml` (完了の正) を置く。
再開は done が無い段階から。詳細は [references/run-state.md](references/run-state.md) (P6 で追加)。

## 段階の手順書

- [references/stage-instructions/](references/stage-instructions/) (P6 で追加)
- サブエージェントにはファイルパスだけを渡し、本文を貼らない ([references/subagent-template.md](references/subagent-template.md)、P6 で追加)

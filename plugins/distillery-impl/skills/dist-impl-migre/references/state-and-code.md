# 実行状態・証跡・既存コード

現物の入力と移行先の[状態スキーマ](../../dist-impl-run/references/state-schema.md)を照合する。
履歴を消して新規runとして作り直すことや、全stageのdoneを一括で書き換えることを移行手順にしない。

## 再開可能性の確認（全版共通）

| 対象 | 判断・修正 |
|---|---|
| impl-config / uc-map | UC ID、tier、言語、契約所有・利用関係、テスト命令、UCタグ、ユーザーの確認済み対応を保持する |
| bootstrap.done | 入力hash・存在フラグとPhase依存を照合し、影響するPhaseだけinvalidateする |
| manifest / stage done | 現行のprojection規約で鮮度を判定する。入力が変わったtierとglobal stageを依存に基づき特定する |
| events / invalidated | 過去イベントを保持し、必要なstage_invalidated等を既存schemaに従って追記・退避する |
| review / approval / feedback | 元の証拠との対応を保持する。変更後にも有効かを再評価し、承認を捏造しない |
| コード・生成物 | 手編集・追加テスト・wrapperを保持し、契約や接続の変更に必要な範囲を修正する |

P2/P4の導出内容が同じなら、確認済みconfigやlockの時刻・hashを不要に変えない。
位置だけを根拠に「S3以降を全部無効」にせず、state-schemaのtier-scoped stalenessとglobal stageの条件を使う。
無効になったdoneを新しいhashに合わせて書き換え、未実行の検証を通過済みにしない。
活動中runのファイルを同時に変更しない。状態を確認して作業を調整し、leaseの解除は既存規約に従う。

## ASSUMPTION-EVIDENCE — 0.13.0

0.12系で開始されたrunには、S4のassumptionsやS9のassumption_evidence_sha256が無い場合がある。
当時の判断・検証・承認を、現在の証拠ファイルへ後付けで転記して実施済みにしない。

- current attemptのS4 doneにassumptionsがないtierは、既存の`assumptions_missing_legacy`規則に従いS4/S5を退避して再実行対象にする。
- 新しい前提一覧と判定は[AssumptionRecord規約](../../dist-impl-implement/references/assumption-record.md)に従い、現在のコードと仕様から検証する。
- 証拠hashのないS9 approvalをcurrentな承認として使わない。必要な再レビューを記録する。
- 実装者とVerifierの責務分離や承認条件を、移行スキルが代行して省略しない。

## 移行後の判定

| 状態 | 報告 |
|---|---|
| 修正・接続検査が完了し、既存doneも現物と整合 | 移行完了。実装状態は確認できた範囲を示す |
| 修正・接続検査が完了し、古いdoneを正しく退避。次の実行条件も確認できた | 移行完了、実装検証は再実行待ち。対象stage/tierと再開方法を明示する |
| 入力不足・業務矛盾・codegen失敗・必要な移行検証が未実施 | 移行未完了。原因と残作業を示す |

移行完了はS0〜S9全体の完了を意味しない。再実行待ちのstageをdoneにしない。
移行に必要な設定・生成物・接続の検査はこのスキルで行う。通常の実装runや人レビューの再開は、依頼範囲に含まれる場合に実施する。

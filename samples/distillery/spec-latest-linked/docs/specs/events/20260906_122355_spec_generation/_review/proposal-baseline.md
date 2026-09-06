# 提案と本文の対応

このイベントは7件の具体案を採用した場合の目標仕様である。現在のlatestは変更していない。
全提案の採用状況はproposedであり、readinessはneeds-spec-change。specs/latestへ昇格しない。

具体案の全文は[還流要求](../feedback-requests/20260906_122355_spec_feedback_60d99956.md)を参照する。
本文のlatestリンクは現在の正本を指す。以下の差分は未採用である。

| 要求 | 現在のlatestとの差分 | 対応する本文 | 採用状況 |
|---|---|---|---|
| CR-60d99956-001 | RDRAは日数と適用対応なし。14/7/30日、一般の長期禁止、標準初期値、暦日計算を提案 | specの通常貸出と長期拒否BDD、Backend T1、Frontend入力 | proposed |
| CR-60d99956-002 | 予約待ち拒否と取置き対象許可の優先順位なし。対象取置き例外を優先 | spec B2と取置きBDD、モデル予約更新 | proposed |
| CR-60d99956-003 | 利用可能と状態の対応なし。登録済みと取引進行中を許可し維持遷移追加 | spec B1と取置きBDD、モデル利用者更新 | proposed |
| CR-60d99956-004 | 部品説明がHTTP担当と誤記。callbackのみと明記 | Frontend部品接続 | proposed |
| CR-60d99956-005 | today任意、fallbackは期限。today必須に変更 | Frontend部品接続と基準日更新 | proposed |
| CR-60d99956-006 | DB/KVS二重書込回復なし。UUIDv7期限24hと原子的RDBreceiptを追加 | Backend T1/T3/T4、OpenAPI、モデル、Frontend回復 | proposed |
| CR-60d99956-007 | email/registeredAt必須。任意化して欠落欄を省略 | Frontend部品接続と最小情報BDD | proposed |

## 照合方法

1. 上流の最新ファイルを読み、各具体案の値と意味を確認する。
2. 同じ案が採用された場合は本文を保持し、照合結果を新しいイベントへ記録する。
3. 別案の場合は本文、契約、BDDの影響箇所を修正する。
4. 未採用または一部採用の場合は未解決要求を残す。

旧イベントと実際の上流latestは変更していない。7件の採用や上流実行の成功を記録したledgerではない。

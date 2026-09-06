# 共通技術規則と前段参照

本文のdocs/...はプロジェクトルート相対。前段にある規則は複写せず参照する。

| ID | 複数UCへの適用範囲 | 正本・入力と結果 | UCパラメータ |
|---|---|---|---|
| AUTH-1 | 認証を要する全HTTP操作 | [arch latest](../../../../arch/latest/arch-design.md) の認証認可設計、[OpenAPI](api/openapi.yaml) security。無効なら401、ロール不足なら403、業務更新なし | operationの許可ロール |
| ERROR-1 | 全HTTP操作 | [分割OpenAPI](api/openapi.yaml) の共通エラー応答。成功形式に失敗を詰め込まない | operationのエラー定義 |
| PRIVACY-1 | 利用者・貸出情報を扱う全UC | [NFR latest](../../../../nfr/latest/nfr-grade.yaml) E.1.2.1 / E.6.1.1 / E.6.1.2。参照範囲・保管時/通信時保護の正本 | 対象データ集合はモデル操作一覧 |
| LOCK-1 | 同じ書籍/利用者を更新する貸出・返却・予約操作 | 一取引内の利用者→書籍→予約ID昇順のNOWAIT排他。取得不成立なら全rollbackして409 CONFLICT。更新前の状態でなくロック後の現在値で判定 | 対象の利用者番号/書籍ID/予約ID |

LOCK-1はSpecで具体化した共通技術規則。今回生成した貸出UC以外への適用確認は未実施。全UCの更新が済んだことを意味しない。
冪等性はarch SR-013 / SR-025 / CTP-006を参照し、CR006解決前に別の保存方式を正本として作らない。

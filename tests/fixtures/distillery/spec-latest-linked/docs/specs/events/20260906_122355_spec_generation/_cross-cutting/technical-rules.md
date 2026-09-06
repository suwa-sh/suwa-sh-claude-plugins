# 共通技術規則

| ID | 適用範囲 | 処理と参照 | UCから渡す値 |
|---|---|---|---|
| AUTH-1 | 認証が必要なHTTP操作 | [architecture](../../../../arch/latest/arch-design.md)の認証認可設計。無効な認証は401、権限不足は403 | 許可ロール |
| ERROR-1 | HTTP操作 | [OpenAPI](api/openapi.yaml)の共通エラー応答 | エラーコードと理由 |
| PRIVACY-1 | 利用者情報を扱う操作 | [NFR](../../../../nfr/latest/nfr-grade.yaml)のE.1.2.1、E.6.1.1、E.6.1.2。監査ログにトークンと氏名と連絡先を含めない | 対象データ |
| LOCK-1 | 同じ書籍を更新する貸出、返却、予約 | 利用者→書籍→予約ID昇順にNOWAITロック。取得失敗は全rollbackと409 CONFLICT。新規予約と取消も対象書籍をロック | 利用者番号、書籍ID、予約ID |

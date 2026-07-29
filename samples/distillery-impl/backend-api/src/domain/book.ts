// 出典: docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/_cross-cutting/datastore/rdb-schema.yaml books テーブル
// 予約情報は books テーブルに存在せず、独立した reservations テーブル(domain/reservation.ts)が正。
// attempt-1 で自作していた reservedByUserId フィールドは廃止した
// (docs/impl/latest/19ec0182/stages/attempt-1/S5_verify.tier-backend-api.findings.yaml F-001)。

export type BookStatus = "available" | "on_loan" | "overdue";

// author 〜 updatedAt は GET /api/v1/books/:id(attempt-3 最小実装)のために追加した任意項目。
// この UC(書籍を貸出する)の貸出可否判定(canLend)・貸出登録は status のみ使用し、既存の
// seed({ id, title, status }) 呼び出しは変更不要(任意項目は省略可)。
// 出典: _cross-cutting/datastore/rdb-schema.yaml books テーブル(NOT NULL 項目だが、
// 本UCは書籍登録・編集の書き込み経路を持たないため未シード時は空文字で応答する暫定実装。
// 詳細は docs/impl/latest/19ec0182/issues/ の _api-summary 未宣言エンドポイント起票を参照)。
export interface Book {
  id: string;
  title: string;
  status: BookStatus;
  author?: string;
  isbn?: string;
  publisher?: string;
  genre?: string;
  materialType?: string;
  location?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

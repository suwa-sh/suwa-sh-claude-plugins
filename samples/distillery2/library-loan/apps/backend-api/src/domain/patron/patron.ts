/** 利用者 (patron モジュール)。貸出登録で必要な識別情報だけを持つ。 */
export interface Patron {
  patronId: string;
  patronNumber: string;
}

/** 利用者の参照ポート。実装は repository 層。 */
export interface PatronRepository {
  /** 退会 (論理削除) 済みの利用者は返さない */
  findActiveByPatronNumber(patronNumber: string): Promise<Patron | null>;
}

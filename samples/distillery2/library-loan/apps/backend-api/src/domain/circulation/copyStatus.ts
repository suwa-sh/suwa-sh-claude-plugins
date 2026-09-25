/**
 * 書籍の状態・貸出の状態。値は契約 (packages/contracts) の生成型をそのまま使い、手書きで複製しない (ADR 0002)。
 */
export type { CopyStatus, LoanStatus } from '../../../../../packages/contracts/api/types';

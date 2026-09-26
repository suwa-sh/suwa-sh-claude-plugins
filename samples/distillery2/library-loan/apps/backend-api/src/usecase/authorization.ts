/**
 * 認可の判定 (ADR 0006: 認可は usecase 層で判定する。司書専用の操作はロールで判定する)。
 */
import type { Principal } from './ports';

/** 司書専用の操作を呼べる主体か */
export function isLibrarian(principal: Principal): boolean {
  return principal.role === 'librarian';
}

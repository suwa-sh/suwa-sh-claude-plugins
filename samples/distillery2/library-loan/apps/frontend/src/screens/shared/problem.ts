import type { Problem } from '../../../../../packages/contracts/library-api/types';

/** 応答本文が契約の Problem (RFC 9457) の形 (code と title を持つ) かを確かめる */
export const isProblem = (data: unknown): data is Problem =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as { code?: unknown }).code === 'string' &&
  typeof (data as { title?: unknown }).title === 'string';

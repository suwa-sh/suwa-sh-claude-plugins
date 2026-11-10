import {
  type ViewRoomAvailabilityResult,
  viewRoomAvailability,
} from '../../../../packages/contracts/api/client';
import type { TimeRange } from '../../../../packages/contracts/api/types';
import { authorizedFetch } from './authorizedFetch';
import type { TokenProvider } from './tokenProvider';

/** API 呼び出しに渡すもの。fetch は生成クライアントの options.fetch の元 (テストで差し替える) */
export interface ApiDeps {
  tokens: TokenProvider;
  fetch?: typeof fetch;
}

/** 全会議室の空き状況を照会する (operationId viewRoomAvailability)。baseUrl は指定しない (ADR 0021: 同一オリジンの /api) */
export function fetchRoomAvailability(
  range: TimeRange,
  deps: ApiDeps,
): Promise<ViewRoomAvailabilityResult> {
  return viewRoomAvailability(
    { body: range },
    { fetch: authorizedFetch(deps.tokens, deps.fetch ?? fetch) },
  );
}

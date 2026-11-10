// 画面の移動と、path から画面を選ぶ照合 (ADR 0021)。
// App.tsx が navigate を再輸出する。routes.tsx と画面は循環を避けるためここから import する。

/** 画面を切り替える (ブラウザの履歴に積む)。リンクやボタンから呼ぶ */
export function navigate(path: string): void {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** 照合の結果。params は :name の区切りに合った値 */
export interface RouteMatch<R> {
  route: R;
  params: Record<string, string>;
}

const segmentsOf = (path: string) => path.split('/').filter((s) => s !== '');

/** 区切りの値を復号する。復号できない値 (壊れた符号化。例 %E0) は描画を止めないよう、そのままの値にする */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * path を / で区切って 1 区切りずつ照合し、最初に合った画面を返す。
 * :name の区切りは / を含まない空でない値 1 つに合う。/ は表の先頭の画面。合う画面が無ければ undefined
 */
export function matchRoute<R extends { path: string }>(
  routes: readonly R[],
  pathname: string,
): RouteMatch<R> | undefined {
  const actual = segmentsOf(pathname);
  for (const route of routes) {
    const expected = segmentsOf(route.path);
    if (expected.length !== actual.length) continue;
    const params: Record<string, string> = {};
    const matched = expected.every((seg, i) => {
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeSegment(actual[i]);
        return true;
      }
      return seg === actual[i];
    });
    if (matched) return { route, params };
  }
  if (actual.length === 0 && routes.length > 0) return { route: routes[0], params: {} };
  return undefined;
}

/**
 * URL のクエリ (window.location.search の形) を名前ごとの値にする (ADR 0021)。
 * 同じ名前が複数あれば最初の値を取る。クエリが無ければ空のオブジェクト
 */
export function parseQuery(search: string): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [name, value] of new URLSearchParams(search)) {
    if (!Object.hasOwn(query, name)) query[name] = value;
  }
  return query;
}

/**
 * サインイン後の戻り先を決める。state が同じオリジンの path (/ で始まり、// や /\ で始まらない) ならそれを使い、
 * 無いか同じオリジンの path でなければ fallback (routes の先頭の画面) へ戻す
 */
export function resolveReturnPath(state: string | undefined, fallback: string): string {
  if (!state || !state.startsWith('/') || state.startsWith('//') || state.startsWith('/\\')) {
    return fallback;
  }
  return state;
}

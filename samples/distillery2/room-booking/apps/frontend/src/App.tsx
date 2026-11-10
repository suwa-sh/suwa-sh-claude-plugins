// distillery2 genSkeleton.js が置いた画面の切り替え。手で変えてよい (再実行で上書きしない)
// view-room-availability: path のパラメータの照合 (ADR 0021) と、最初の表示でのサインイン (ADR 0014 / 0021) を足した
// view-room-availability: URL のクエリを読み、Route の element の 2 つ目の引数で渡す (ADR 0021)
import { useEffect, useMemo, useState } from 'react';
import { sessionTokenProvider } from './api/oidcTokenProvider';
import { currentPath, ensureSignedIn } from './api/tokenProvider';
import { matchRoute, parseQuery } from './navigation';
import { routes } from './routes';

export { navigate } from './navigation';

const readLocation = () => ({ pathname: window.location.pathname, search: window.location.search });

/** routes.tsx の表から、今の URL の画面を選ぶ。/ は表の先頭の画面。照合は pathname だけで行う */
export function App() {
  const [{ pathname, search }, setLocation] = useState(readLocation);
  useEffect(() => {
    // navigate() も popstate を送るので、両方で pathname と search を追う。
    // 同じ値なら前の state を返し、描き直さない
    const onPop = () =>
      setLocation((prev) => {
        const next = readLocation();
        return prev.pathname === next.pathname && prev.search === next.search ? prev : next;
      });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const query = useMemo(() => parseQuery(search), [search]);
  const matched = matchRoute(routes, pathname);
  const needsSignIn = matched?.route.public !== true;
  useEffect(() => {
    if (!needsSignIn) return;
    // 最初の表示でサインインしていなければ、今の画面の path を戻り先にしてサインインへ送る。
    // StrictMode で effect が 2 回走っても、供給元 (1 つだけ作る) が送り出しを 1 回にまとめる
    void ensureSignedIn(sessionTokenProvider(), currentPath());
  }, [needsSignIn]);
  if (matched) return <>{matched.route.element(matched.params, query)}</>;
  return (
    <main>
      <h1>画面が見つかりません</h1>
      <p>{pathname}</p>
    </main>
  );
}

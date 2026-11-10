// distillery2 genSkeleton.js が置いた画面の表。手で変えてよい (再実行で上書きしない)
import type { ReactNode } from 'react';
import { sessionTokenProvider } from './api/oidcTokenProvider';
import { navigate } from './navigation';
import { AuthCallbackScreen } from './screens/AuthCallback/AuthCallbackScreen';
import { ReserveRoomScreen } from './screens/ReserveRoom/ReserveRoomScreen';
import { RoomAvailabilityScreen } from './screens/RoomAvailability/RoomAvailabilityScreen';

export interface Route {
  /** docs/design/screens.yaml の route と同じ書式 (:name のパラメータを含む) */
  path: string;
  /**
   * App.tsx が path から取り出したパラメータ (名前は :name の name) を params に、
   * URL のクエリ (同じ名前は最初の値) を query に渡す (ADR 0021)。
   * 使わない画面は引数の少ない関数 (() => ... や (params) => ...) のまま書いてよい
   */
  element: (params: Record<string, string>, query: Record<string, string>) => ReactNode;
  /** true ならサインインしていなくても表示する (サインインのコールバック) */
  public?: boolean;
}

/** サインイン後の戻り先が無いときに戻る画面 (表の先頭の画面) */
const HOME_PATH = '/availability';

/** 画面の機能は、自分の画面をここに 1 行足す */
export const routes: Route[] = [
  {
    path: HOME_PATH,
    element: () => <RoomAvailabilityScreen tokens={sessionTokenProvider()} navigate={navigate} />,
  },
  {
    path: '/reservations/new',
    element: (_params, query) => (
      <ReserveRoomScreen tokens={sessionTokenProvider()} query={query} navigate={navigate} />
    ),
  },
  // ADR 0021: サインインのコールバック。UC の画面ではないため screens.yaml に載せない
  {
    path: '/auth/callback',
    element: () => (
      <AuthCallbackScreen
        tokens={sessionTokenProvider()}
        fallbackPath={HOME_PATH}
        navigate={navigate}
      />
    ),
    public: true,
  },
];

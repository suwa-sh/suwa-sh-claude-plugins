import { BusinessErrorAlert } from '@repo/ui';
import { useEffect, useRef, useState } from 'react';
import type { SessionTokenProvider } from '../../api/tokenProvider';
import { resolveReturnPath } from '../../navigation';

export interface AuthCallbackScreenProps {
  tokens: Pick<SessionTokenProvider, 'completeSignIn'>;
  /** 戻り先が無いか同じオリジンの path でないときに戻る画面 (routes の先頭の画面) */
  fallbackPath: string;
  /** App.tsx の navigate() */
  navigate: (path: string) => void;
}

/**
 * サインインのコールバックの画面 (path /auth/callback。ADR 0021)。
 * サインインの完了を待つ間は何も描かず、完了したら戻り先の画面へ移る。
 * 認可コードは 1 回しか使えないので、完了の呼び出しは 1 回だけにする (StrictMode の再実行でも呼び直さない)
 */
export function AuthCallbackScreen({ tokens, fallbackPath, navigate }: AuthCallbackScreenProps) {
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    tokens
      .completeSignIn()
      .then((state) => navigate(resolveReturnPath(state, fallbackPath)))
      .catch(() => setFailed(true));
  }, [tokens, fallbackPath, navigate]);
  if (!failed) return null;
  return <BusinessErrorAlert code="UNAUTHENTICATED" />;
}

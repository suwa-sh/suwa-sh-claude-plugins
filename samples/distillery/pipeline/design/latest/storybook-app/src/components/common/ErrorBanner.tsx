import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

/** RFC 7807 Problem Details の表示に必要なフィールド。 */
export interface ProblemDetails {
  type?: string;
  title: string;
  status?: number;
  detail?: string;
  instance?: string;
}

export interface ErrorBannerProps {
  error: ProblemDetails | null;
  onDismiss?: () => void;
}

/** APIエラーを、技術情報ではなく解決に必要なメッセージとして表示する。 */
export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <section
      aria-live="assertive"
      role="alert"
      style={{ alignItems: "flex-start", background: "var(--destructive-light)", border: "1px solid var(--destructive)", borderRadius: "var(--radius-lg)", color: "var(--destructive)", display: "flex", gap: "var(--spacing-3)", padding: "var(--spacing-4)" }}
    >
      <Icon name="alert-triangle" size={20} aria-hidden />
      <div style={{ color: "var(--foreground)", flex: 1, minWidth: 0 }}>
        <strong style={{ color: "var(--destructive)", display: "block" }}>{error.title}</strong>
        {error.detail && <p style={{ margin: "var(--spacing-1) 0 0", overflowWrap: "anywhere" }}>{error.detail}</p>}
        {error.status && <small style={{ color: "var(--muted-foreground)", display: "block", marginTop: "var(--spacing-2)" }}>エラーコード: {error.status}</small>}
      </div>
      {onDismiss && <Button aria-label="エラーを閉じる" onClick={onDismiss} size="sm" variant="ghost"><Icon name="x" size={16} aria-hidden /></Button>}
    </section>
  );
}

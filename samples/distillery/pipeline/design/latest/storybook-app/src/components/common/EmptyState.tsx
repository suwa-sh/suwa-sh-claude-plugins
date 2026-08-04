import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

export interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

/** データが0件のときに、理由と次の行動を伝える。 */
export function EmptyState({ message, actionLabel, onAction, icon = "book" }: EmptyStateProps) {
  return (
    <section
      aria-label="空の状態"
      style={{
        alignItems: "center",
        background: "var(--card-bg)",
        border: "1px dashed var(--border)",
        borderRadius: "var(--card-radius)",
        color: "var(--foreground)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-4)",
        padding: "var(--spacing-10) var(--card-padding)",
        textAlign: "center",
      }}
    >
      <span style={{ alignItems: "center", background: "var(--muted)", borderRadius: "var(--radius-full)", color: "var(--muted-foreground)", display: "inline-flex", height: "var(--spacing-12)", justifyContent: "center", width: "var(--spacing-12)" }}>
        <Icon name={icon} size={24} aria-hidden />
      </span>
      <p style={{ color: "var(--muted-foreground)", margin: 0, maxWidth: "32rem" }}>{message}</p>
      {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
    </section>
  );
}

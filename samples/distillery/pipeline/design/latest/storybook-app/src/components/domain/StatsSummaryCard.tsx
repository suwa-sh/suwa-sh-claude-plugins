import { Icon } from "../ui/Icon";

export interface StatsSummaryCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: string;
  variant?: "default" | "highlight";
}

/** 在庫・統計画面で指標と前期比を表示するサマリーカード。 */
export function StatsSummaryCard({ title, value, change, icon, variant = "default" }: StatsSummaryCardProps) {
  const positive = change >= 0;
  return (
    <article style={{ background: variant === "highlight" ? "var(--info-light)" : "var(--card-bg)", border: `1px solid ${variant === "highlight" ? "var(--info)" : "var(--card-border)"}`, borderRadius: "var(--card-radius)", color: "var(--foreground)", display: "grid", gap: "var(--spacing-3)", padding: "var(--card-padding)" }}>
      <div style={{ alignItems: "center", color: "var(--muted-foreground)", display: "flex", gap: "var(--spacing-2)" }}>
        <Icon name={icon} size={20} aria-hidden />
        <span>{title}</span>
      </div>
      <strong style={{ fontSize: "var(--font-size-3xl)", lineHeight: 1.2, overflowWrap: "anywhere" }}>{value}</strong>
      <span style={{ color: positive ? "var(--success)" : "var(--destructive)", fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>
        前期比 {positive ? "+" : ""}{change}%
      </span>
    </article>
  );
}

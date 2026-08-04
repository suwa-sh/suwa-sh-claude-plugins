export type LoadingSkeletonVariant = "table-row" | "card" | "form";

export interface LoadingSkeletonProps {
  variant?: LoadingSkeletonVariant;
  count?: number;
}

const heights: Record<LoadingSkeletonVariant, string> = {
  "table-row": "var(--table-row-height)",
  card: "8rem",
  form: "var(--input-height)",
};

/** 読み込み中のレイアウトシフトを抑えるスケルトン。 */
export function LoadingSkeleton({ variant = "card", count = 3 }: LoadingSkeletonProps) {
  return (
    <div aria-busy="true" aria-label="読み込み中" role="status" style={{ display: "grid", gap: "var(--spacing-3)" }}>
      {Array.from({ length: count }, (_, index) => (
        <span
          className="ds-skeleton"
          key={index}
          style={{
            background: "linear-gradient(90deg, var(--muted) 25%, var(--hover-muted) 50%, var(--muted) 75%)",
            backgroundSize: "200% 100%",
            border: "1px solid var(--border)",
            borderRadius: variant === "table-row" ? "var(--radius-sm)" : "var(--radius-lg)",
            display: "block",
            height: heights[variant],
          }}
        />
      ))}
      <span style={{ height: 1, overflow: "hidden", position: "absolute", width: 1 }}>読み込み中です</span>
    </div>
  );
}

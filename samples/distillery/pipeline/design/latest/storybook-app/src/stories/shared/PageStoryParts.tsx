import type { CSSProperties, ReactNode } from "react";

export const pageContentStyle: CSSProperties = {
  display: "grid",
  gap: "var(--spacing-6)",
  minWidth: 0,
};

export const responsiveGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))",
  gap: "var(--spacing-4)",
};

export const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--spacing-3)",
  alignItems: "center",
};

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "var(--spacing-4)",
      }}
    >
      <div style={{ display: "grid", gap: "var(--spacing-2)", minWidth: 0 }}>
        <span
          style={{
            color: "var(--muted-foreground)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          LibraShelf
        </span>
        <h1
          style={{
            color: "var(--foreground)",
            fontSize: "var(--font-size-3xl)",
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            color: "var(--muted-foreground)",
            fontSize: "var(--font-size-base)",
            lineHeight: 1.7,
            margin: 0,
            maxWidth: "48rem",
          }}
        >
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}

export function Panel({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--card-radius)",
        boxShadow: "var(--card-shadow)",
        display: "grid",
        gap: "var(--spacing-4)",
        minWidth: 0,
        padding: "var(--card-padding)",
      }}
    >
      {(title || description) && (
        <header style={{ display: "grid", gap: "var(--spacing-1)" }}>
          {title && (
            <h2
              style={{
                color: "var(--foreground)",
                fontSize: "var(--font-size-xl)",
                margin: 0,
              }}
            >
              {title}
            </h2>
          )}
          {description && (
            <p
              style={{
                color: "var(--muted-foreground)",
                fontSize: "var(--font-size-sm)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {description}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

export function Notice({
  tone,
  title,
  children,
}: {
  tone: "success" | "info" | "warning";
  title: string;
  children: ReactNode;
}) {
  const foreground = tone === "warning" ? "var(--warning)" : `var(--${tone})`;
  return (
    <div
      role="status"
      style={{
        background: `var(--${tone}-light)`,
        border: `1px solid ${foreground}`,
        borderRadius: "var(--radius-lg)",
        color: "var(--foreground)",
        display: "grid",
        gap: "var(--spacing-1)",
        padding: "var(--spacing-4)",
      }}
    >
      <strong style={{ color: foreground }}>{title}</strong>
      <span style={{ lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

export function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: "var(--spacing-2)", minWidth: 0 }}>
      <span style={{ color: "var(--foreground)", fontWeight: "var(--font-weight-medium)" }}>
        {label}
        {required ? "（必須）" : ""}
      </span>
      {children}
      {error && (
        <span role="alert" style={{ color: "var(--destructive)", fontSize: "var(--font-size-sm)" }}>
          {error}
        </span>
      )}
    </label>
  );
}

export function ChoiceGroup({
  label,
  options,
  selected,
}: {
  label: string;
  options: string[];
  selected: string;
}) {
  return (
    <fieldset style={{ border: 0, display: "grid", gap: "var(--spacing-2)", margin: 0, padding: 0 }}>
      <legend style={{ color: "var(--foreground)", fontWeight: "var(--font-weight-medium)" }}>
        {label}
      </legend>
      <div style={actionsStyle}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={selected === option}
            style={{
              background: selected === option ? "var(--primary)" : "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-full)",
              color: selected === option ? "var(--primary-foreground)" : "var(--foreground)",
              cursor: "pointer",
              minHeight: "2.75rem",
              padding: "var(--spacing-2) var(--spacing-4)",
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SimpleTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div style={{ maxWidth: "100%", overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: "46rem", width: "100%" }}>
        <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>{caption}</caption>
        <thead style={{ background: "var(--table-header-bg)" }}>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                style={{
                  borderBottom: "1px solid var(--border)",
                  color: "var(--foreground)",
                  padding: "var(--table-cell-padding)",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    color: "var(--foreground)",
                    minHeight: "var(--table-row-height)",
                    padding: "var(--table-cell-padding)",
                    verticalAlign: "middle",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BarChart({
  ariaLabel,
  values,
}: {
  ariaLabel: string;
  values: Array<{ label: string; value: number; max: number }>;
}) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ display: "grid", gap: "var(--spacing-3)" }}>
      {values.map(({ label, value, max }) => (
        <div key={label} style={{ display: "grid", gap: "var(--spacing-1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--spacing-3)" }}>
            <span style={{ color: "var(--foreground)" }}>{label}</span>
            <strong style={{ color: "var(--foreground)" }}>{value.toLocaleString("ja-JP")}</strong>
          </div>
          <div style={{ background: "var(--muted)", borderRadius: "var(--radius-full)", height: "0.75rem" }}>
            <div
              style={{
                background: "var(--primary)",
                borderRadius: "var(--radius-full)",
                height: "100%",
                width: `${Math.max(3, (value / max) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export const sampleBooks = {
  cat: {
    title: "吾輩は猫である",
    author: "夏目漱石",
    isbn: "978-4-10-101001-2",
    publisher: "新潮社",
    genre: "文学",
    materialType: "紙書籍",
    location: "一般書架 A-12",
    status: "available" as const,
  },
  kokoro: {
    title: "こころ",
    author: "夏目漱石",
    isbn: "978-4-10-101013-5",
    publisher: "新潮社",
    genre: "文学",
    materialType: "紙書籍",
    location: "一般書架 A-12",
    status: "on_loan" as const,
  },
  science: {
    title: "科学の発見",
    author: "スティーヴン・ワインバーグ",
    isbn: "978-4-16-390457-9",
    publisher: "文藝春秋",
    genre: "自然科学",
    materialType: "電子書籍",
    location: "電子図書館",
    status: "overdue" as const,
  },
};

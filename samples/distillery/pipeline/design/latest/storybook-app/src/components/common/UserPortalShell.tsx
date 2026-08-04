import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { Logo } from "../ui/Logo";

export interface UserPortalShellProps {
  activePage: string;
  userName: string;
  children?: ReactNode;
}

const navItems = [
  ["books", "蔵書検索", "/books/search", "search"],
  ["loans", "貸出・返却", "/loans", "book"],
  ["reservations", "予約", "/reservations", "calendar"],
  ["history", "貸出履歴", "/loans/history", "history"],
] as const;

/** 利用者向けのヘッダー、ナビゲーション、フッターを提供する。 */
export function UserPortalShell({ activePage, userName, children }: UserPortalShellProps) {
  return (
    <div data-portal="user" style={{ background: "var(--background)", color: "var(--foreground)", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ background: "var(--card-bg)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "var(--spacing-4)", justifyContent: "space-between", margin: "0 auto", maxWidth: "var(--content-max-width)", padding: "var(--spacing-4) var(--page-padding)" }}>
          <div style={{ background: "var(--color-white)", borderRadius: "var(--radius-md)", padding: "var(--spacing-1) var(--spacing-2)" }}>
            <Logo variant="full" />
          </div>
          <nav aria-label="利用者メニュー" style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-1)" }}>
            {navItems.map(([id, label, href, icon]) => {
              const selected = activePage === id;
              return <a aria-current={selected ? "page" : undefined} href={href} key={id} style={{ alignItems: "center", background: selected ? "var(--info-light)" : "transparent", borderRadius: "var(--radius-md)", color: selected ? "var(--primary)" : "var(--foreground)", display: "inline-flex", gap: "var(--spacing-2)", padding: "var(--spacing-2) var(--spacing-3)", textDecoration: "none" }}><Icon name={icon} size={16} aria-hidden />{label}</a>;
            })}
          </nav>
          <span style={{ alignItems: "center", color: "var(--muted-foreground)", display: "inline-flex", gap: "var(--spacing-2)" }}><Icon name="user" size={18} aria-hidden />{userName}</span>
        </div>
      </header>
      <main style={{ flex: 1, margin: "0 auto", maxWidth: "var(--content-max-width)", padding: "var(--page-padding)", width: "100%" }}>{children}</main>
      <footer style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)", fontSize: "var(--font-size-sm)", padding: "var(--spacing-5) var(--page-padding)", textAlign: "center" }}>LibraShelf 図書館サービス</footer>
    </div>
  );
}

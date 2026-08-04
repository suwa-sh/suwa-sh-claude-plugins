import type { ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { Logo } from "../ui/Logo";

export interface AdminPortalShellProps {
  activePage: string;
  userName: string;
  sidebarCollapsed?: boolean;
  children?: ReactNode;
}

const navItems = [
  ["books", "蔵書管理", "/admin/books", "book"],
  ["loans", "貸出状況", "/admin/loans", "clipboard"],
  ["overdue", "延滞管理", "/admin/loans/overdue", "alert-triangle"],
  ["users", "利用者管理", "/admin/users", "users"],
  ["inventory", "在庫状況", "/admin/inventory", "archive"],
  ["stats", "統計レポート", "/admin/stats", "chart"],
] as const;

/** 司書向けのサイドバー、パンくず、メイン領域を提供する。 */
export function AdminPortalShell({ activePage, userName, sidebarCollapsed = false, children }: AdminPortalShellProps) {
  const activeLabel = navItems.find(([id]) => id === activePage)?.[1] ?? "司書ポータル";
  return (
    <div data-portal="admin" style={{ background: "var(--background)", color: "var(--foreground)", display: "grid", gridTemplateColumns: `${sidebarCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)"} minmax(0, 1fr)`, minHeight: "100vh" }}>
      <aside style={{ background: "var(--color-gray-900)", color: "var(--color-white)", display: "flex", flexDirection: "column", gap: "var(--spacing-6)", overflow: "hidden", padding: "var(--spacing-4)" }}>
        <div style={{ alignSelf: "flex-start", background: "var(--color-white)", borderRadius: "var(--radius-md)", padding: "var(--spacing-2)" }}>
          <Logo variant={sidebarCollapsed ? "icon" : "full"} />
        </div>
        <nav aria-label="司書メニュー" style={{ display: "grid", gap: "var(--spacing-1)" }}>
          {navItems.map(([id, label, href, icon]) => {
            const selected = activePage === id;
            return <a aria-current={selected ? "page" : undefined} href={href} key={id} title={sidebarCollapsed ? label : undefined} style={{ alignItems: "center", background: selected ? "var(--primary)" : "transparent", borderRadius: "var(--radius-md)", color: "var(--color-white)", display: "flex", gap: "var(--spacing-3)", minHeight: "var(--sidebar-item-height)", padding: "var(--spacing-2) var(--spacing-3)", textDecoration: "none", whiteSpace: "nowrap" }}><Icon name={icon} size={18} aria-hidden />{!sidebarCollapsed && label}</a>;
          })}
        </nav>
      </aside>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ alignItems: "center", background: "var(--card-bg)", borderBottom: "1px solid var(--border)", display: "flex", gap: "var(--spacing-4)", justifyContent: "space-between", minHeight: "4rem", padding: "var(--spacing-3) var(--page-padding)" }}>
          <span style={{ color: "var(--muted-foreground)", fontSize: "var(--font-size-sm)" }}>司書ポータル / <strong style={{ color: "var(--foreground)" }}>{activeLabel}</strong></span>
          <span style={{ alignItems: "center", color: "var(--muted-foreground)", display: "inline-flex", gap: "var(--spacing-2)" }}><Icon name="user" size={18} aria-hidden />{userName}</span>
        </header>
        <main style={{ flex: 1, minWidth: 0, padding: "var(--page-padding)" }}>{children}</main>
      </div>
    </div>
  );
}

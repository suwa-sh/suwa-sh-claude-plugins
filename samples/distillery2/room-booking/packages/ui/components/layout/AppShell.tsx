import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Icon, type IconName } from '../ui/Icon';

export type NavKey = 'availability' | 'my-reservations';

interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { key: 'availability', label: '空き状況', href: '/availability', icon: 'search' },
  { key: 'my-reservations', label: '自分の予約', href: '/my-reservations', icon: 'calendar' },
];

export interface AppShellProps {
  /** 今いる画面に対応するナビ。無ければどれも選択しない */
  current?: NavKey;
  /** ログイン中の社員の表示名 */
  userName?: string;
  /** 画面の見出し */
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** 全画面に共通の枠 (上部のヘッダーとナビ + 本文)。PC のみを想定 */
export function AppShell({ current, userName, title, description, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-header-border bg-header-bg">
        <div className="mx-auto flex h-(--header-height) max-w-(--content-max-width) items-center gap-6 px-(--page-padding)">
          <a
            href="/availability"
            className="flex shrink-0 items-center gap-2 font-heading font-bold text-primary"
          >
            <Icon name="door" size={24} />
            <span>会議室予約</span>
          </a>
          <nav aria-label="メインメニュー" className="flex min-w-0 flex-1 items-center gap-1">
            {navItems.map((item) => {
              const active = item.key === current;
              return (
                <a
                  key={item.key}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-(--radius-md) px-3 py-1.5 text-sm font-medium',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    active
                      ? 'bg-nav-active-bg text-nav-active-fg'
                      : 'text-muted-foreground hover:bg-hover-muted',
                  )}
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </a>
              );
            })}
          </nav>
          {userName && (
            <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              <Icon name="user" size={16} />
              {userName}
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-(--content-max-width) flex-col gap-(--section-gap) p-(--page-padding)">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold leading-(--line-height-heading)">
            {title}
          </h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}

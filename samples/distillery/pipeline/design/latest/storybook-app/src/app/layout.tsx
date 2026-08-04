import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LibraShelf Design System",
  description: "図書館蔵書管理システムのデザインシステム",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja" data-portal="user">
      <body>{children}</body>
    </html>
  );
}

/**
 * このプロジェクトはデザインシステムのカタログ（Storybook）配信を目的とする。
 * アプリケーション本体の画面は実装リポジトリ側で作るため、ここは案内のみ。
 */
export default function Home() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--component-gap)',
        padding: 'var(--page-padding)',
        maxWidth: 'var(--content-max-width)',
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Libro Design System</h1>
      <p style={{ color: 'var(--foreground-secondary)' }}>
        図書館蔵書管理システムのデザインシステムです。カタログは Storybook で参照してください。
      </p>
      <code
        style={{
          fontFamily: 'var(--font-family-mono)',
          background: 'var(--background-muted)',
          padding: 'var(--spacing-3)',
          borderRadius: 'var(--radius-lg)',
          width: 'fit-content',
        }}
      >
        npm run storybook
      </code>
    </main>
  )
}

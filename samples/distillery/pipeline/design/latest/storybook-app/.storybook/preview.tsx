import type { Preview } from '@storybook/nextjs-vite'
import '../src/app/globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: 'todo' },
    options: {
      storySort: {
        order: ['Introduction', 'Design Tokens', 'Screen Mapping', 'State Mapping', 'Brand', 'UI', 'Domain'],
      },
    },
  },
  globalTypes: {
    portal: {
      description: 'ポータル (利用者 / 司書)',
      defaultValue: 'patron',
      toolbar: {
        title: 'Portal',
        icon: 'user',
        items: [
          { value: 'patron', title: '利用者ポータル' },
          { value: 'staff', title: '司書ポータル' },
        ],
        dynamicTitle: true,
      },
    },
    theme: {
      description: 'カラーテーマ',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const portal = (context.globals.portal as string) || 'patron'
      const theme = (context.globals.theme as string) || 'light'
      const root = document.documentElement
      root.setAttribute('data-portal', portal)
      root.classList.toggle('dark', theme === 'dark')
      // ツールバー選択を正とし、OS の prefers-color-scheme を打ち消す
      root.classList.toggle('light', theme === 'light')
      root.style.colorScheme = theme
      document.body.style.background = 'var(--background)'
      document.body.style.color = 'var(--foreground)'
      document.body.style.fontFamily = 'var(--font-family-sans)'
      return Story()
    },
  ],
}

export default preview

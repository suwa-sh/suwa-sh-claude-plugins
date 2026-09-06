import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ToggleGroup } from './ToggleGroup'

const meta: Meta<typeof ToggleGroup> = {
  title: 'UI/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'RDRA バリエーション（検索条件種別・ジャンル・資料種別・貸出期間区分・レポート種別 等）の選択に使う。Badge や 3 択以下の `<select>` は使わない。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ToggleGroup>

const Wrapper: React.FC<{
  label: string
  options: string[]
  mode?: 'single' | 'multi'
  initial?: string[]
}> = ({ label, options, mode = 'single', initial = [] }) => {
  const [value, setValue] = React.useState<string[]>(initial)
  return (
    <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
      <ToggleGroup
        label={label}
        mode={mode}
        options={options.map((o) => ({ value: o, label: o }))}
        value={value}
        onChange={setValue}
      />
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
        選択中: {value.length ? value.join(' / ') : '（なし）'}
      </span>
    </div>
  )
}

export const SingleSelect: Story = {
  render: () => (
    <Wrapper
      label="検索条件種別"
      options={['キーワード', 'タイトル', '著者', 'ISBN', 'ジャンル']}
      initial={['キーワード']}
    />
  ),
}

export const MultiSelect: Story = {
  render: () => (
    <Wrapper
      label="ジャンル"
      mode="multi"
      options={['文学', '人文', '社会科学', '自然科学', '技術', '芸術', '児童', 'その他']}
      initial={['文学', '児童']}
    />
  ),
}

export const LoanPeriod: Story = {
  render: () => <Wrapper label="貸出期間区分" options={['標準', '短期', '長期']} initial={['標準']} />,
}

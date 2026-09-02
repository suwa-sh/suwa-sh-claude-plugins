import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { FilterPanel, type FilterFieldSpec } from '@/components/common/FilterPanel'

const meta: Meta<typeof FilterPanel> = {
  title: 'Common/FilterPanel',
  component: FilterPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '「単一選択トグル + 複数選択トグル + 検索語 + 実行ボタン + 結果件数」の並びと詳細条件の折りたたみを統一する（ToggleGroup + Input + Button の合成）。セレクトボックスは使わない。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof FilterPanel>

const initialFields: FilterFieldSpec[] = [
  { key: 'q', label: '検索語', kind: 'text', value: '' },
  {
    key: 'conditionType',
    label: '検索条件種別',
    kind: 'single',
    options: [
      { value: 'keyword', label: 'キーワード' },
      { value: 'title', label: 'タイトル' },
      { value: 'author', label: '著者' },
      { value: 'isbn', label: 'ISBN' },
    ],
    value: ['keyword'],
  },
  {
    key: 'genre',
    label: 'ジャンル',
    kind: 'multi',
    options: [
      { value: 'literature', label: '文学' },
      { value: 'science', label: '自然科学' },
      { value: 'art', label: '芸術' },
    ],
    value: [],
  },
]

export const Default: Story = {
  render: () => {
    const [fields, setFields] = React.useState(initialFields)
    return (
      <FilterPanel
        fields={fields}
        onChange={(key, value) =>
          setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)))
        }
        onSubmit={() => {}}
        onReset={() => setFields(initialFields)}
        resultCount={12}
      />
    )
  },
}

export const Expanded: Story = {
  render: () => {
    const [fields, setFields] = React.useState(initialFields)
    return (
      <FilterPanel
        fields={fields}
        onChange={(key, value) =>
          setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)))
        }
        onSubmit={() => {}}
        collapsedByDefault={false}
        resultCount={0}
      />
    )
  },
}

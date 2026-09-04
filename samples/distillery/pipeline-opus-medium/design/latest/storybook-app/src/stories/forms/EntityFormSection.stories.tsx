import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'

const meta: Meta<typeof EntityFormSection> = {
  title: 'Common/EntityFormSection',
  component: EntityFormSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'フォームのレイアウト（lg 2列 / md 以下 1列）、ラベル・必須表記・エラー表示位置、送信中の無効化を統一する（Card + Input + ToggleGroup + Alert + Button の合成）。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof EntityFormSection>

const fields: FormFieldSpec[] = [
  { key: 'title', label: '書名', kind: 'text', required: true },
  { key: 'author', label: '著者', kind: 'text', required: true },
  { key: 'isbn', label: 'ISBN', kind: 'text', required: true, hint: '13 桁または 10 桁' },
  {
    key: 'genre',
    label: 'ジャンル',
    kind: 'single',
    options: [
      { value: 'literature', label: '文学' },
      { value: 'science', label: '自然科学' },
      { value: 'art', label: '芸術' },
    ],
  },
  {
    key: 'materialType',
    label: '資料種別',
    kind: 'single',
    options: [
      { value: 'paper', label: '紙書籍' },
      { value: 'ebook', label: '電子書籍' },
    ],
  },
]

export const Create: Story = {
  render: () => {
    const [value, setValue] = React.useState<Record<string, string | string[]>>({})
    return (
      <EntityFormSection
        title="書籍受入登録"
        description="必須項目を入力してください"
        mode="create"
        fields={fields}
        value={value}
        onChange={(key, v) => setValue((prev) => ({ ...prev, [key]: v }))}
        errors={{}}
        footer={<SubmitActionButton onSubmit={() => {}}>登録する</SubmitActionButton>}
      />
    )
  },
}

export const EditWithDiff: Story = {
  render: () => {
    const current = { title: '吾輩は猫である', author: '夏目漱石', genre: 'literature' }
    const [value, setValue] = React.useState<Record<string, string | string[]>>({
      ...current,
      genre: 'art',
    })
    return (
      <EntityFormSection
        title="書誌情報訂正"
        mode="edit"
        fields={fields.filter((f) => f.key !== 'isbn' && f.key !== 'materialType')}
        value={value}
        current={current}
        onChange={(key, v) => setValue((prev) => ({ ...prev, [key]: v }))}
        errors={{}}
        footer={<SubmitActionButton onSubmit={() => {}}>保存する</SubmitActionButton>}
      />
    )
  },
}

export const WithErrors: Story = {
  render: () => (
    <EntityFormSection
      title="利用申込受付"
      mode="create"
      fields={fields.slice(0, 3)}
      value={{ title: '', author: '', isbn: '123' }}
      onChange={() => {}}
      errors={{ title: '書名は必須です', isbn: 'ISBN は 13 桁または 10 桁で入力してください' }}
      formError="入力内容に誤りがあります"
      footer={<SubmitActionButton onSubmit={() => {}}>登録する</SubmitActionButton>}
    />
  ),
}

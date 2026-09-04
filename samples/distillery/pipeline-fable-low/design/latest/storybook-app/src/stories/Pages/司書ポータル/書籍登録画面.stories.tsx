import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { EntityFormPage } from '@/components/common/EntityFormPage'
import { BookForm } from '@/components/domain/Forms'
import type { NormalizedApiError } from '@/components/common/types'

export interface BookCreatePageProps {
  submitting?: boolean
  submitError?: NormalizedApiError | null
}

/** 書籍登録画面。BookForm（create）を EntityFormPage の共通シェルに載せる。 */
const BookCreatePage: React.FC<BookCreatePageProps> = ({ submitting = false, submitError = null }) => (
  <StaffLayout activeGroup="books" activeItem="bookNew">
    <EntityFormPage mode="create" title="書籍を登録" submitting={submitting} submitError={submitError} onCancel={() => {}}>
      {({ fieldErrors }) => (
        <BookForm
          mode="create"
          errors={fieldErrors}
          submitting={submitting}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      )}
    </EntityFormPage>
  </StaffLayout>
)

const meta: Meta<typeof BookCreatePage> = {
  title: 'Pages/司書ポータル/書籍登録画面',
  component: BookCreatePage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof BookCreatePage>

export const Default: Story = {
  render: () => <BookCreatePage />,
}

export const ValidationError: Story = {
  render: () => (
    <BookCreatePage
      submitError={{
        kind: 'validation',
        message: '入力内容を確認してください',
        fieldErrors: { genre: 'ジャンルが見つかりません' },
      }}
    />
  ),
}

export const Submitting: Story = {
  render: () => <BookCreatePage submitting />,
}

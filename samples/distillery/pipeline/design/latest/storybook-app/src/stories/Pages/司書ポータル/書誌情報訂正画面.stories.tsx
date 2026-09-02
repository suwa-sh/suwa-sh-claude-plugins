import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { BookStatusBadge } from '@/components/domain/StatusBadges'
import { genres } from '@/components/domain/stateMaps'

/**
 * 書誌情報訂正画面（/staff/books/:bookId/edit）。
 * UC 固有コンポーネント BookEditForm / BookDiffSummary を、
 * 共通コンポーネント AsyncSection（現行値取得）+ EntityFormSection（mode="edit"）+
 * SubmitActionButton の薄いアダプタとして実装する。
 */

interface BookEditFormValue {
  [key: string]: string
  title: string
  author: string
  isbn: string
  publisher: string
  genre: string
}

const currentBook: BookEditFormValue = {
  title: '吾輩は猫である',
  author: '夏目 漱右',
  isbn: '978-4-10-101035-9',
  publisher: '新潮社',
  genre: '文学',
}

const fields: FormFieldSpec[] = [
  { key: 'title', label: 'タイトル', kind: 'text', required: true },
  { key: 'author', label: '著者', kind: 'text', required: true },
  { key: 'isbn', label: 'ISBN', kind: 'text', hint: '13桁または10桁（ハイフン可・任意）' },
  { key: 'publisher', label: '出版社', kind: 'text', required: true },
  { key: 'genre', label: 'ジャンル', kind: 'single', options: genres.map((g) => ({ value: g, label: g })), required: true },
]

function BookEditFormScreen({
  loading = false,
  error = null,
  initialValue = currentBook,
  conflict = false,
}: {
  loading?: boolean
  error?: string | null
  initialValue?: BookEditFormValue
  conflict?: boolean
}) {
  const [value, setValue] = React.useState<BookEditFormValue>(initialValue)
  const [submitting, setSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(
    conflict ? '他の担当者が更新しました。最新の内容を読み込んで操作し直してください' : null,
  )

  const dirty = Object.keys(currentBook).some(
    (k) => value[k as keyof BookEditFormValue] !== currentBook[k as keyof BookEditFormValue],
  )

  const onChange = (key: string, next: string | string[]) => {
    setValue((v) => ({ ...v, [key]: Array.isArray(next) ? next[0] ?? '' : next }))
  }

  const onSubmit = () => {
    setFormError(null)
    setSubmitting(true)
    setTimeout(() => setSubmitting(false), 800)
  }

  return (
    <PortalPageLayout
      portal="staff"
      title="書誌情報訂正"
      breadcrumb={[{ label: '蔵書管理台帳', href: '#' }, { label: '書誌情報訂正' }]}
      activeNavId="collection"
      width="contained"
      actions={
        <Button variant="outline" iconLeft="arrow-left">
          台帳へ戻る
        </Button>
      }
    >
      <AsyncSection
        loading={loading}
        error={error}
        isEmpty={false}
        skeleton="line"
        emptyMessage="対象の書籍が見つかりません"
        announce
      >
        <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
          <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
              現在の書籍状態
            </span>
            <BookStatusBadge state="在庫あり" dot />
          </div>
          {formError && <Alert tone="destructive" title={formError} actions={<Button variant="outline" size="sm" iconLeft="refresh-cw">最新を読み込む</Button>} />}
          <EntityFormSection
            title="書誌情報"
            description="訂正した項目は保存前に変更前・変更後で確認できます。"
            mode="edit"
            fields={fields}
            value={value}
            onChange={onChange}
            current={currentBook}
            formError={null}
            footer={
              <>
                <Button variant="outline">取消</Button>
                <SubmitActionButton
                  idempotencyKey="22222222-2222-4222-8222-222222222222"
                  variant="default"
                  onSubmit={onSubmit}
                  submitting={submitting}
                  disabled={!dirty || submitting}
                >
                  保存する
                </SubmitActionButton>
              </>
            }
          />
        </div>
      </AsyncSection>
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/書誌情報訂正画面',
  component: BookEditFormScreen,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BookEditFormScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <BookEditFormScreen initialValue={{ ...currentBook, author: '夏目漱石' }} />,
}

export const Loading: Story = {
  render: () => <BookEditFormScreen loading />,
}

export const ConflictError: Story = {
  render: () => <BookEditFormScreen initialValue={{ ...currentBook, author: '夏目漱石' }} conflict />,
}

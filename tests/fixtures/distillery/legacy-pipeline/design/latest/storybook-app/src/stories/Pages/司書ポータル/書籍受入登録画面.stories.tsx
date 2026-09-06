import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { genres, materialTypes } from '@/components/domain/stateMaps'

/**
 * 書籍受入登録画面（/staff/books/new）。
 * UC 固有コンポーネント BookIntakeForm / MaterialTypeNotice を、
 * 共通コンポーネント EntityFormSection（mode="create"）+ SubmitActionButton の
 * 薄いアダプタとして実装する。
 */

interface BookIntakeFormValue {
  [key: string]: string
  title: string
  author: string
  isbn: string
  publisher: string
  genre: string
  materialType: string
}

const emptyValue: BookIntakeFormValue = {
  title: '',
  author: '',
  isbn: '',
  publisher: '',
  genre: '',
  materialType: '紙書籍',
}

const fields: FormFieldSpec[] = [
  { key: 'title', label: 'タイトル', kind: 'text', required: true },
  { key: 'author', label: '著者', kind: 'text', required: true },
  { key: 'isbn', label: 'ISBN', kind: 'text', hint: '13桁または10桁（ハイフン可・任意）' },
  { key: 'publisher', label: '出版社', kind: 'text', required: true },
  { key: 'genre', label: 'ジャンル', kind: 'single', options: genres.map((g) => ({ value: g, label: g })), required: true },
  {
    key: 'materialType',
    label: '資料種別',
    kind: 'single',
    options: materialTypes.map((m) => ({ value: m, label: m })),
    required: true,
  },
]

function BookIntakeFormScreen({
  initialValue = emptyValue,
  initialErrors = {},
  submitting: initialSubmitting = false,
}: {
  initialValue?: BookIntakeFormValue
  initialErrors?: Record<string, string>
  submitting?: boolean
}) {
  const [value, setValue] = React.useState<BookIntakeFormValue>(initialValue)
  const [errors, setErrors] = React.useState<Record<string, string>>(initialErrors)
  const [submitting, setSubmitting] = React.useState(initialSubmitting)
  const [done, setDone] = React.useState(false)

  const isElectronic = value.materialType === '電子書籍'
  const hasRequiredMissing = !value.title || !value.author || !value.publisher || !value.genre
  const disabled = isElectronic || hasRequiredMissing || submitting

  const onChange = (key: string, next: string | string[]) => {
    setValue((v) => ({ ...v, [key]: Array.isArray(next) ? next[0] ?? '' : next }))
    setErrors((e) => {
      const { [key]: _removed, ...rest } = e
      return rest
    })
  }

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!value.title) nextErrors.title = 'タイトルを入力してください'
    if (!value.author) nextErrors.author = '著者を入力してください'
    if (!value.publisher) nextErrors.publisher = '出版社を入力してください'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setDone(true)
    }, 800)
  }

  return (
    <PortalPageLayout
      portal="staff"
      title="書籍受入登録"
      breadcrumb={[{ label: '蔵書管理台帳', href: '#' }, { label: '書籍受入登録' }]}
      activeNavId="collection"
      width="contained"
      actions={
        <Button variant="outline" iconLeft="arrow-left">
          台帳へ戻る
        </Button>
      }
    >
      {done && (
        <Alert tone="success" title="登録しました" actions={<Button variant="outline" size="sm">台帳へ戻る</Button>}>
          「{value.title}」を蔵書として登録しました。
        </Alert>
      )}
      <EntityFormSection
        title="書誌情報"
        description="必須項目を入力し、資料種別を選択してください。"
        mode="create"
        fields={fields}
        value={value}
        onChange={onChange}
        errors={errors}
        formError={null}
        footer={
          <>
            <Button variant="outline">取消</Button>
            <SubmitActionButton
              idempotencyKey="11111111-1111-4111-8111-111111111111"
              variant="default"
              onSubmit={onSubmit}
              submitting={submitting}
              disabled={disabled}
            >
              登録する
            </SubmitActionButton>
          </>
        }
      />
      {isElectronic && (
        <Alert tone="warning" title="電子書籍は現在未対応です">
          電子書籍は現在未対応です。紙書籍のみ登録できます。
        </Alert>
      )}
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/書籍受入登録画面',
  component: BookIntakeFormScreen,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BookIntakeFormScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <BookIntakeFormScreen
      initialValue={{
        title: '吾輩は猫である',
        author: '夏目漱石',
        isbn: '978-4-10-101035-9',
        publisher: '新潮社',
        genre: '文学',
        materialType: '紙書籍',
      }}
    />
  ),
}

export const ElectronicBookWarning: Story = {
  render: () => (
    <BookIntakeFormScreen
      initialValue={{
        title: '銀河鉄道の夜',
        author: '宮沢賢治',
        isbn: '',
        publisher: '岩波書店',
        genre: '文学',
        materialType: '電子書籍',
      }}
    />
  ),
}

export const ValidationErrors: Story = {
  render: () => (
    <BookIntakeFormScreen
      initialValue={emptyValue}
      initialErrors={{ title: 'タイトルを入力してください' }}
    />
  ),
}

export const Submitting: Story = {
  render: () => (
    <BookIntakeFormScreen
      initialValue={{
        title: '坊っちゃん',
        author: '夏目漱石',
        isbn: '978-4-10-101034-2',
        publisher: '新潮社',
        genre: '文学',
        materialType: '紙書籍',
      }}
      submitting
    />
  ),
}

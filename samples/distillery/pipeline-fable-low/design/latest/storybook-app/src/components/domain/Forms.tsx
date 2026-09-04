import React, { useState } from 'react'
import { Alert } from '../ui/Feedback'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { Input, Select, Textarea } from '../ui/Input'
import { ToggleGroup } from '../ui/ToggleGroup'
import { genres, type Book, type Genre, type MediaType, type User } from './types'

/* ---------- BookForm ---------- */
export type BookFormValue = Pick<Book, 'title' | 'author' | 'isbn' | 'publisher' | 'genre' | 'media'>
export type BookFormErrors = Partial<Record<keyof BookFormValue, string>>

export interface BookFormProps {
  mode: 'create' | 'edit'
  initial?: Partial<BookFormValue>
  errors?: BookFormErrors
  submitting?: boolean
  onSubmit?: (v: BookFormValue) => void
  onCancel?: () => void
}

/** 書籍登録・編集。中央寄せ 8col。媒体種別は初期リリース紙のみ運用のため「電子」は無効化 */
export const BookForm: React.FC<BookFormProps> = ({ mode, initial, errors = {}, submitting, onSubmit, onCancel }) => {
  const [v, setV] = useState<BookFormValue>({
    title: initial?.title ?? '',
    author: initial?.author ?? '',
    isbn: initial?.isbn ?? '',
    publisher: initial?.publisher ?? '',
    genre: initial?.genre ?? '文学',
    media: initial?.media ?? '紙',
  })
  const set = <K extends keyof BookFormValue>(k: K, val: BookFormValue[K]) => setV({ ...v, [k]: val })
  const hasError = Object.keys(errors).length > 0
  return (
    <form
      className="flex flex-col"
      style={{ gap: 'var(--section-gap)' }}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(v)
      }}
      aria-busy={submitting}
    >
      {hasError ? <Alert tone="destructive" title="入力内容を確認してください">赤字の項目を修正して、もう一度保存してください</Alert> : null}
      <Card>
        <CardHeader title="書籍情報" description={mode === 'create' ? '蔵書として登録する書籍の情報を入力します' : '登録済みの書籍情報を修正します'} />
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--component-gap) var(--spacing-4)' }}>
          <Input className="md:col-span-2" label="タイトル" required value={v.title} onChange={(e) => set('title', e.target.value)} error={errors.title} placeholder="吾輩は猫である" />
          <Input label="著者" required value={v.author} onChange={(e) => set('author', e.target.value)} error={errors.author} placeholder="夏目漱石" />
          <Input label="出版社" value={v.publisher} onChange={(e) => set('publisher', e.target.value)} error={errors.publisher} placeholder="新潮社" />
          <Input label="ISBN" mono value={v.isbn} onChange={(e) => set('isbn', e.target.value)} error={errors.isbn} hint="ハイフンなし 13 桁" placeholder="9784101010014" inputMode="numeric" />
          <Select label="ジャンル" required value={v.genre} onChange={(e) => set('genre', e.target.value as Genre)} options={genres.map((g) => ({ value: g, label: g }))} error={errors.genre} />
          <div className="md:col-span-2 flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>媒体種別</span>
            <ToggleGroup<MediaType> label="媒体種別" options={[{ value: '紙', label: '紙' }, { value: '電子', label: '電子（今後対応）' }]} value={v.media} onChange={(m) => set('media', m)} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>初期リリースでは紙のみ運用します</span>
          </div>
        </div>
      </Card>
      <div className="flex justify-end" style={{ gap: 'var(--spacing-2)' }}>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          キャンセル
        </Button>
        <Button type="submit" icon={mode === 'create' ? 'plus' : 'check'} loading={submitting}>
          {mode === 'create' ? '登録する' : '保存する'}
        </Button>
      </div>
    </form>
  )
}

/* ---------- UserForm ---------- */
export type UserFormValue = Pick<User, 'name' | 'email' | 'phone' | 'address'>
export type UserFormErrors = Partial<Record<keyof UserFormValue, string>>

export interface UserFormProps {
  mode: 'create' | 'edit'
  userNumber?: string
  initial?: Partial<UserFormValue>
  errors?: UserFormErrors
  submitting?: boolean
  onSubmit?: (v: UserFormValue) => void
  onCancel?: () => void
}

/** 利用者登録・編集。個人情報のためオートコンプリートを抑止する（NFR E.1.2.1） */
export const UserForm: React.FC<UserFormProps> = ({ mode, userNumber, initial, errors = {}, submitting, onSubmit, onCancel }) => {
  const [v, setV] = useState<UserFormValue>({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? '',
  })
  const set = <K extends keyof UserFormValue>(k: K, val: UserFormValue[K]) => setV({ ...v, [k]: val })
  return (
    <form
      className="flex flex-col"
      style={{ gap: 'var(--section-gap)' }}
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(v)
      }}
      aria-busy={submitting}
    >
      <Card>
        <CardHeader
          title="利用者情報"
          description={mode === 'create' ? '登録すると利用者番号が自動で採番されます' : `利用者番号 ${userNumber ?? ''}`}
        />
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--component-gap) var(--spacing-4)' }}>
          <Input label="氏名" required value={v.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="山田 花子" autoComplete="off" />
          <Input label="メールアドレス" required type="email" value={v.email} onChange={(e) => set('email', e.target.value)} error={errors.email} hint="返却通知・リマインド・督促の送信先" placeholder="hanako@example.com" autoComplete="off" />
          <Input label="電話番号" type="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} placeholder="090-1234-5678" autoComplete="off" />
          <Textarea className="md:col-span-2" label="住所" value={v.address} onChange={(e) => set('address', e.target.value)} error={errors.address} autoComplete="off" />
        </div>
      </Card>
      <div className="flex justify-end" style={{ gap: 'var(--spacing-2)' }}>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          キャンセル
        </Button>
        <Button type="submit" icon={mode === 'create' ? 'user-plus' : 'check'} loading={submitting}>
          {mode === 'create' ? '登録する' : '保存する'}
        </Button>
      </div>
    </form>
  )
}

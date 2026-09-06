import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { PortalShell } from '../../../components/ui/PortalShell'
import { Button } from '../../../components/ui/Button'
import { Alert, EmptyState, LoadingBlock } from '../../../components/ui/Feedback'
import { LoanTable, ReservationTable } from '../../../components/domain/LoanTables'
import { PiiMaskedText } from '../../../components/domain/PiiMaskedText'
import { Input } from '../../../components/ui/Input'
import { Card } from '../../../components/ui/Card'
import { today, userResponse, loanResponse, reservationResponse, toLoan, toReservation, type ViewState } from '../_serviceAnalysis'

function Page({ state: initialState = 'ready', notFound = false }: { state?: ViewState; notFound?: boolean }) {
  const routeNumber = notFound ? 'U-999' : (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('userId')) ?? 'U-001'
  const [state, setState] = useState(initialState), [number, setNumber] = useState(routeNumber), [target, setTarget] = useState(routeNumber)
  return <PortalShell portal="staff" currentPath="/staff/users/U-001/status" title="窓口利用状況照会" userName="佐藤 司書" height="100vh"><div className="flex flex-col gap-6">
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setTarget(number.trim()); setState('ready'); const url = new URL(window.location.href); url.searchParams.set('userId', number.trim()); window.history.replaceState(null, '', url) }}><Input label="利用者番号" value={number} onChange={e => setNumber(e.target.value)} required /><Button type="submit" disabled={state === 'loading'}>照会する</Button></form>
    {state === 'error' ? <Alert tone="destructive" title="データを取得できませんでした" action={<Button onClick={() => setState('ready')}>再取得</Button>}>通信状況を確認して、もう一度お試しください。</Alert> : state === 'loading' ? <LoadingBlock message="利用状況を取得しています…" /> : target !== userResponse.user_number ? <EmptyState title="利用者が見つかりません" description="利用者番号を確認してください。" /> : <>
      <Card className="p-5"><h2 className="mb-3 font-semibold"><PiiMaskedText value={userResponse.name} kind="address" />（{userResponse.user_number}）</h2><div className="flex flex-wrap gap-4"><PiiMaskedText value={userResponse.email} kind="email" /><PiiMaskedText value={userResponse.phone} kind="phone" /><PiiMaskedText value={userResponse.address} kind="address" /></div></Card>
      <section><h2 className="mb-3 font-semibold">貸出履歴</h2><LoanTable loans={state === 'empty' ? [] : [...loanResponse.items].reverse().map(toLoan)} today={today} variant="history" /></section>
      <section><h2 className="mb-3 font-semibold">予約状況</h2><ReservationTable reservations={state === 'empty' ? [] : reservationResponse.items.map(toReservation)} /></section>
    </>}
  </div></PortalShell>
}

const meta = { id: 'pages-staff-user-activity', title: 'Pages/司書ポータル/窓口利用状況照会画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', docs: { description: { component: '利用者の利用状況を参照するのページ合成。API fixtureを表示モデルへ変換する。' } }, distillery: { operation: 'getUserActivity', contractSha256: 'e65c30826b0e68bba15861d4939b78b2a31ea37aab461f84ea00c996a1e8327d', uc: '利用者サービス業務/自分の利用状況を確認するフロー/利用者の利用状況を参照する' } }, globals: { portal: 'staff' } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { state: 'ready' } }
export const NotFound: Story = { args: { notFound: true } }
export const RecoverNotFound: Story = { args: { notFound: true }, play: async ({ canvasElement }) => { const c = within(canvasElement); await userEvent.clear(c.getByLabelText(/利用者番号/)); await userEvent.type(c.getByLabelText(/利用者番号/), 'U-001'); await userEvent.click(c.getByRole('button', { name: '照会する' })); await expect(c.getByText('銀河鉄道の夜')).toBeInTheDocument() } }
export const Loading: Story = { args: { state: 'loading' } }
export const Empty: Story = { args: { state: 'empty' } }
export const Error: Story = { args: { state: 'error' } }

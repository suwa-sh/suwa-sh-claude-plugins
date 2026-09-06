import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { PortalShell } from '../../../components/ui/PortalShell'
import { Button } from '../../../components/ui/Button'
import { Alert, EmptyState, LoadingBlock } from '../../../components/ui/Feedback'
import { ReservationTable } from '../../../components/domain/LoanTables'
import { ReservationQueueTracker } from '../../../components/domain/ReservationQueueTracker'
import { Pagination } from '../../../components/ui/Pagination'
import { reservationResponse, pagedReservations, toReservation, type ViewState } from '../_serviceAnalysis'

function Page({ state: initialState = 'ready', notified = false, paged = false }: { state?: ViewState; notified?: boolean; paged?: boolean }) {
  const [state, setState] = useState(initialState), [page, setPage] = useState(() => Math.max(1, Math.floor(Number(new URLSearchParams(window.location.search).get('page')) || 1))), [pageSize] = useState(() => Math.min(100, Math.max(1, Math.floor(Number(new URLSearchParams(window.location.search).get('page_size')) || 20))))
  const rows = state === 'empty' ? [] : (paged ? pagedReservations : reservationResponse.items).map(r => toReservation(notified ? { ...r, current_status: '通知済み', queue_position: 1 } : r))
  const displayed = rows.slice((page - 1) * pageSize, page * pageSize)
  return <PortalShell portal="patron" currentPath="/me/reservations" title="マイ予約状況" userName="山田 花子" height="100vh"><div className="flex flex-col gap-6">
    {state === 'error' ? <Alert tone="destructive" title="データを取得できませんでした" action={<Button onClick={() => setState('ready')}>再取得</Button>}>通信状況を確認して、もう一度お試しください。</Alert> : <>
      {state !== 'loading' && displayed.length > 0 && <section aria-label="予約の進行状況"><h2 className="mb-3 font-semibold">{displayed[0].book.title}</h2><ReservationQueueTracker state={displayed[0].state} position={displayed[0].position} />{notified && <p className="mt-3">返却通知をお送りしました。窓口でお受け取りください。</p>}</section>}
      <ReservationTable reservations={displayed} loading={state === 'loading'} onCancel={r => window.location.assign(`/iframe.html?id=pages-patron-cancel--default&viewMode=story&reservationId=${encodeURIComponent(r.id)}`)} />
      {state !== 'loading' && <Pagination page={page} pageSize={pageSize} total={rows.length} onChange={p => { setPage(p); const url = new URL(window.location.href); url.searchParams.set('page', String(p)); url.searchParams.set('page_size', String(pageSize)); window.history.replaceState(null, '', url) }} />}
    </>}
  </div></PortalShell>
}

const meta = { id: 'pages-patron-my-reservations', title: 'Pages/利用者ポータル/マイ予約状況画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', docs: { description: { component: '予約状況を参照するのページ合成。API fixtureを表示モデルへ変換する。' } }, distillery: { operation: 'listMyReservations', contractSha256: 'd070d346b7d54132cbb8b5b18310ee70a46ae7cfddbeb75e10fbbc885947d220', uc: '利用者サービス業務/自分の利用状況を確認するフロー/予約状況を参照する' } }, globals: { portal: 'patron' } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { state: 'ready' } }
export const Notified: Story = { args: { notified: true }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByText('返却通知をお送りしました。窓口でお受け取りください。')).toBeInTheDocument() } }
export const Empty: Story = { args: { state: 'empty' } }
export const Loading: Story = { args: { state: 'loading' } }
export const Error: Story = { args: { state: 'error' } }

export const Paged: Story = { args: { paged: true }, beforeEach: () => { const url = new URL(window.location.href); ['page', 'page_size', 'states'].forEach(key => url.searchParams.delete(key)); window.history.replaceState(null, '', url) }, play: async ({ canvasElement }) => { const c = within(canvasElement); await expect(c.getByText('22 件中 1–20 件')).toBeInTheDocument(); await userEvent.click(c.getByRole('button', { name: '次のページ' })); await expect(c.getByText('22 件中 21–22 件')).toBeInTheDocument(); await expect(c.getAllByText('蔵書サンプル 21').length).toBeGreaterThan(0); await expect(c.queryByText('蔵書サンプル 1')).not.toBeInTheDocument(); await expect(new URL(window.location.href).searchParams.get('page')).toBe('2'); await expect(new URL(window.location.href).searchParams.get('page_size')).toBe('20') } }

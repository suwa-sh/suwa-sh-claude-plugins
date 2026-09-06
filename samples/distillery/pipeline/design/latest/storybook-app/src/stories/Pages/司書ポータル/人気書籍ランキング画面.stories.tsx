import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { PortalShell } from '../../../components/ui/PortalShell'
import { Button } from '../../../components/ui/Button'
import { Alert, EmptyState, LoadingBlock } from '../../../components/ui/Feedback'
import { PeriodSelector, RankingList, PeriodStatChart, StatCard, type PeriodValue } from '../../../components/domain/Reports'
import { Pagination } from '../../../components/ui/Pagination'
import { pagedRanking, initialPeriod, allPeriod, rankingResponse, statisticsResponse, type ViewState } from '../_serviceAnalysis'

function Page({ state: initialState = 'ready', wholePeriod = false, paged = false }: { state?: ViewState; wholePeriod?: boolean; paged?: boolean }) {
  const [state, setState] = useState(initialState), [period, setPeriod] = useState<PeriodValue>(() => { const query = new URLSearchParams(window.location.search), fallback = wholePeriod ? allPeriod : initialPeriod; return { granularity: query.get('period_type') === '月' ? '月' : query.get('period_type') === '日' ? '日' : fallback.granularity, from: query.get('period_start') || fallback.from, to: query.get('period_end') || fallback.to } }), [applied, setApplied] = useState(period), [invalid, setInvalid] = useState(false), [page, setPage] = useState(() => Math.max(1, Math.floor(Number(new URLSearchParams(window.location.search).get('page')) || 1))), [pageSize] = useState(() => Math.min(100, Math.max(1, Math.floor(Number(new URLSearchParams(window.location.search).get('page_size')) || 20))))
  const response = state === 'empty' ? [] : (paged ? pagedRanking : rankingResponse)(applied.from, applied.to), rows = response.map(r => ({ rank: r.ranking, count: r.loan_count, book: { id: r.book_id, title: r.book_title, author: r.book_author, genre: r.genre_name } }))
  const displayed = rows.slice((page - 1) * pageSize, page * pageSize)
  return <PortalShell portal="staff" currentPath="/staff/reports/ranking" title="人気書籍ランキング" userName="佐藤 司書" height="100vh"><div className="flex flex-col gap-6">
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const bad = !period.from || !period.to || period.from > period.to; setInvalid(bad); if (!bad) { setApplied(period); setPage(1); setState('ready'); const url = new URL(window.location.href); url.searchParams.set('page', '1'); url.searchParams.set('page_size', String(pageSize)); url.searchParams.set('period_type', period.granularity); url.searchParams.set('period_start', period.from); url.searchParams.set('period_end', period.to); window.history.replaceState(null, '', url) } }}><PeriodSelector value={period} onChange={setPeriod} disabled={state === 'loading'} /><Button type="submit" disabled={state === 'loading'}>集計する</Button></form>
    {invalid && <Alert tone="destructive" title="期間を確認してください">開始日は終了日以前の日付を指定してください。</Alert>}
    {state === 'error' ? <Alert tone="destructive" title="データを取得できませんでした" action={<Button onClick={() => setState('ready')}>再取得</Button>}>通信状況を確認して、もう一度お試しください。</Alert> : <><StatCard label="貸出実績のある書籍数" value={rows.length} unit="冊" loading={state === 'loading'} icon="trophy" /><RankingList items={displayed} loading={state === 'loading'} limit={pageSize} />{state !== 'loading' && <Pagination page={page} pageSize={pageSize} total={rows.length} onChange={p => { setPage(p); const url = new URL(window.location.href); url.searchParams.set('page', String(p)); url.searchParams.set('page_size', String(pageSize)); window.history.replaceState(null, '', url) }} />}</>}
  </div></PortalShell>
}

const meta = { id: 'pages-staff-popular-books', title: 'Pages/司書ポータル/人気書籍ランキング画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', docs: { description: { component: '人気書籍ランキングを参照するのページ合成。API fixtureを表示モデルへ変換する。' } }, distillery: { operation: 'getPopularBooks', contractSha256: 'f8e9b744b9d52be6da0b250d637b0d76b3160f575f7acddaa9c34a741ad8fe43', uc: '運営分析業務/蔵書の利用状況を分析するフロー/人気書籍ランキングを参照する' } }, globals: { portal: 'staff' } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { state: 'ready' } }
export const TiedRanking: Story = { args: { wholePeriod: true }, play: async ({ canvasElement }) => { const list = within(canvasElement).getByRole('list', { name: '人気書籍ランキング' }); await expect(within(list).getAllByRole('listitem')).toHaveLength(3); await expect(within(list).getAllByText('10 回')).toHaveLength(2); await expect(within(list).getByText('3', { exact: true })).toBeInTheDocument() } }
export const Loading: Story = { args: { state: 'loading' } }
export const Empty: Story = { args: { state: 'empty' } }
export const Error: Story = { args: { state: 'error' } }

export const Paged: Story = { args: { paged: true }, beforeEach: () => { const url = new URL(window.location.href); ['page', 'page_size', 'states'].forEach(key => url.searchParams.delete(key)); window.history.replaceState(null, '', url) }, play: async ({ canvasElement }) => { const c = within(canvasElement); await expect(c.getByText('22 件中 1–20 件')).toBeInTheDocument(); await userEvent.click(c.getByRole('button', { name: '次のページ' })); await expect(c.getByText('22 件中 21–22 件')).toBeInTheDocument(); await expect(c.getAllByText('蔵書サンプル 21').length).toBeGreaterThan(0); await expect(c.queryByText('蔵書サンプル 1')).not.toBeInTheDocument(); await expect(new URL(window.location.href).searchParams.get('page')).toBe('2'); await expect(new URL(window.location.href).searchParams.get('page_size')).toBe('20') } }

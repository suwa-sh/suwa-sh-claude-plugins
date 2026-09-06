import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { PortalShell } from '../../../components/ui/PortalShell'
import { Button } from '../../../components/ui/Button'
import { Alert, EmptyState, LoadingBlock } from '../../../components/ui/Feedback'
import { BookTable } from '../../../components/domain/BookTable'
import { StatCard } from '../../../components/domain/Reports'
import { ToggleGroup } from '../../../components/ui/ToggleGroup'
import { Pagination } from '../../../components/ui/Pagination'
import { bookResponse, pagedBooks, toBook, type ViewState } from '../_serviceAnalysis'
import type { BookState } from '../../../components/domain/types'

function Page({ state: initialState = 'ready', paged = false }: { state?: ViewState; paged?: boolean }) {
  const [state, setState] = useState(initialState), [filter, setFilter] = useState(() => { const value = new URLSearchParams(window.location.search).get('states'); return value && ['在庫あり', '貸出中', '予約待ち'].includes(value) ? value : '全状態' }), [page, setPage] = useState(() => Math.max(1, Math.floor(Number(new URLSearchParams(window.location.search).get('page')) || 1))), [pageSize] = useState(() => Math.min(100, Math.max(1, Math.floor(Number(new URLSearchParams(window.location.search).get('page_size')) || 20))))
  const items = (state === 'empty' ? [] : paged ? pagedBooks : bookResponse).filter(b => filter === '全状態' || b.current_status === filter)
  const displayed = items.slice((page - 1) * pageSize, page * pageSize)
  return <PortalShell portal="staff" currentPath="/staff/reports/inventory" title="在庫状況一覧" userName="佐藤 司書" height="100vh"><div className="flex flex-col gap-6">
    <ToggleGroup label="在庫状態" options={['全状態', '在庫あり', '貸出中', '予約待ち'].map(value => ({ value, label: value }))} value={filter} onChange={v => { setFilter(v); setPage(1); const url = new URL(window.location.href); v === '全状態' ? url.searchParams.delete('states') : url.searchParams.set('states', v); url.searchParams.set('page', '1'); window.history.replaceState(null, '', url) }} disabled={state === 'loading'} />
    {state === 'error' ? <Alert tone="destructive" title="データを取得できませんでした" action={<Button onClick={() => setState('ready')}>再取得</Button>}>通信状況を確認して、もう一度お試しください。</Alert> : <><StatCard label="表示条件に一致する蔵書数" value={items.length} unit="冊" loading={state === 'loading'} icon="book" /><BookTable books={displayed.map(toBook)} variant="inventory" loading={state === 'loading'} />{state !== 'loading' && <Pagination page={page} pageSize={pageSize} total={items.length} onChange={p => { setPage(p); const url = new URL(window.location.href); url.searchParams.set('page', String(p)); url.searchParams.set('page_size', String(pageSize)); window.history.replaceState(null, '', url) }} />}</>}
  </div></PortalShell>
}

const meta = { id: 'pages-staff-inventory', title: 'Pages/司書ポータル/在庫状況一覧画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', docs: { description: { component: '在庫状況一覧を参照するのページ合成。API fixtureを表示モデルへ変換する。' } }, distillery: { operation: 'listInventory', contractSha256: 'ba57cd8c1b937241fe7668c9ba59bbb3d01d6e1c5345ce3b8108ff4c391cbc65', uc: '運営分析業務/蔵書の利用状況を分析するフロー/在庫状況一覧を参照する' } }, globals: { portal: 'staff' } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { state: 'ready' } }
export const Filtered: Story = { args: { state: 'ready' }, play: async ({ canvasElement }) => { const c = within(canvasElement); await userEvent.click(c.getByRole('button', { name: '予約待ち' })); await expect(c.getByText('星をめぐる科学')).toBeInTheDocument(); await expect(c.queryByText('吾輩は猫である')).not.toBeInTheDocument() } }
export const Loading: Story = { args: { state: 'loading' } }
export const Empty: Story = { args: { state: 'empty' } }
export const Error: Story = { args: { state: 'error' } }

export const Paged: Story = { args: { paged: true }, beforeEach: () => { const url = new URL(window.location.href); ['page', 'page_size', 'states'].forEach(key => url.searchParams.delete(key)); window.history.replaceState(null, '', url) }, play: async ({ canvasElement }) => { const c = within(canvasElement); await expect(c.getByText('22 件中 1–20 件')).toBeInTheDocument(); await userEvent.click(c.getByRole('button', { name: '次のページ' })); await expect(c.getByText('22 件中 21–22 件')).toBeInTheDocument(); await expect(c.getAllByText('蔵書サンプル 21').length).toBeGreaterThan(0); await expect(c.queryByText('蔵書サンプル 1')).not.toBeInTheDocument(); await expect(new URL(window.location.href).searchParams.get('page')).toBe('2'); await expect(new URL(window.location.href).searchParams.get('page_size')).toBe('20') } }

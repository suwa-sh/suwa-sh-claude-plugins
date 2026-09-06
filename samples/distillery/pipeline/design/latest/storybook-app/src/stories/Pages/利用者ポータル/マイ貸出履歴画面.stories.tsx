import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { PortalShell } from '../../../components/ui/PortalShell'
import { Button } from '../../../components/ui/Button'
import { Alert, EmptyState, LoadingBlock } from '../../../components/ui/Feedback'
import { LoanTable } from '../../../components/domain/LoanTables'
import { Pagination } from '../../../components/ui/Pagination'
import { today, loanResponse, toLoan, type ViewState } from '../_serviceAnalysis'

function Page({ state: initialState = 'ready', overdue = false, paged = false }: { state?: ViewState; overdue?: boolean; paged?: boolean }) {
  const [state, setState] = useState(initialState), [page, setPage] = useState(1)
  const source = state === 'empty' ? [] : paged ? Array.from({ length: 21 }, (_, i) => ({ ...loanResponse.items[1], loan_id: `L-${i + 100}` })) : [...loanResponse.items].reverse()
  const rows = source.slice((page - 1) * 20, page * 20).map(l => toLoan(overdue && l.current_status === '貸出中' ? { ...l, current_status: '延滞', due_date: '2026-09-01' } : l))
  return <PortalShell portal="patron" currentPath="/me/loans" title="マイ貸出履歴" userName="山田 花子" height="100vh"><div className="flex flex-col gap-6">
    {state === 'error' ? <Alert tone="destructive" title="データを取得できませんでした" action={<Button onClick={() => setState('ready')}>再取得</Button>}>通信状況を確認して、もう一度お試しください。</Alert> : <><LoanTable loans={rows} today={today} variant="history" loading={state === 'loading'} />{state !== 'loading' && <Pagination page={page} pageSize={20} total={source.length} onChange={p => { setPage(p); const url = new URL(window.location.href); url.searchParams.set('page', String(p)); window.history.replaceState(null, '', url) }} />}</>}
  </div></PortalShell>
}

const meta = { id: 'pages-patron-loan-history', title: 'Pages/利用者ポータル/マイ貸出履歴画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', docs: { description: { component: '貸出履歴を参照するのページ合成。API fixtureを表示モデルへ変換する。' } }, distillery: { operation: 'listMyLoanHistory', contractSha256: '966c92e3cc4501e91586e25918356f3c8c14cf573ce1f8749efcd192f1a5f673', uc: '利用者サービス業務/自分の利用状況を確認するフロー/貸出履歴を参照する' } }, globals: { portal: 'patron' } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { state: 'ready' } }
export const WithOverdue: Story = { args: { overdue: true }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByText('延滞')).toBeInTheDocument() } }
export const Empty: Story = { args: { state: 'empty' } }
export const Loading: Story = { args: { state: 'loading' } }
export const Error: Story = { args: { state: 'error' } }
export const Retry: Story = { args: { state: 'error' }, play: async ({ canvasElement }) => { const c = within(canvasElement); await userEvent.click(c.getByRole('button', { name: '再取得' })); await expect(c.getByText('銀河鉄道の夜')).toBeInTheDocument() } }
export const Paged: Story = { args: { paged: true }, play: async ({ canvasElement }) => { const c = within(canvasElement); await userEvent.click(c.getByRole('button', { name: '次のページ' })); await expect(c.getByText('21 件中 21–21 件')).toBeInTheDocument() } }

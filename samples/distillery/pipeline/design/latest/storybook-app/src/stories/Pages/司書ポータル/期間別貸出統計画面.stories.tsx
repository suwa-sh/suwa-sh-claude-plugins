import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, userEvent, within } from 'storybook/test'
import { PortalShell } from '../../../components/ui/PortalShell'
import { Button } from '../../../components/ui/Button'
import { Alert, EmptyState, LoadingBlock } from '../../../components/ui/Feedback'
import { PeriodSelector, RankingList, PeriodStatChart, StatCard, type PeriodValue } from '../../../components/domain/Reports'
import { Pagination } from '../../../components/ui/Pagination'
import { initialPeriod, allPeriod, rankingResponse, statisticsResponse, type ViewState } from '../_serviceAnalysis'

function Page({ state: initialState = 'ready', daily = false }: { state?: ViewState; daily?: boolean }) {
  const [state, setState] = useState(initialState), [period, setPeriod] = useState<PeriodValue>(daily ? initialPeriod : allPeriod), [applied, setApplied] = useState(period), [invalid, setInvalid] = useState(false)
  const response = statisticsResponse(applied.granularity, applied.from, applied.to, state === 'empty')
  return <PortalShell portal="staff" currentPath="/staff/reports/loans" title="期間別貸出統計" userName="佐藤 司書" height="100vh"><div className="flex flex-col gap-6">
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const bad = !period.from || !period.to || period.from > period.to; setInvalid(bad); if (!bad) { setApplied(period); setState('ready'); const url = new URL(window.location.href); url.searchParams.set('period_type', period.granularity); url.searchParams.set('period_start', period.from); url.searchParams.set('period_end', period.to); window.history.replaceState(null, '', url) } }}><PeriodSelector value={period} onChange={setPeriod} disabled={state === 'loading'} /><Button type="submit" disabled={state === 'loading'}>集計する</Button></form>
    {invalid && <Alert tone="destructive" title="期間を確認してください">開始日は終了日以前の日付を指定してください。</Alert>}
    {state === 'error' ? <Alert tone="destructive" title="データを取得できませんでした" action={<Button onClick={() => setState('ready')}>再取得</Button>}>通信状況を確認して、もう一度お試しください。</Alert> : <><StatCard label="期間内の貸出件数" value={response.total_loans} unit="件" loading={state === 'loading'} icon="chart-bar" /><PeriodStatChart series={response.series} granularity={response.period_type} loading={state === 'loading'} /></>}
  </div></PortalShell>
}

const meta = { id: 'pages-staff-loan-statistics', title: 'Pages/司書ポータル/期間別貸出統計画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', docs: { description: { component: '期間別貸出統計を参照するのページ合成。API fixtureを表示モデルへ変換する。' } }, distillery: { operation: 'getLoanStatistics', contractSha256: '5996998110cbef9dc37863c0ca9fb535b33bd7bf9424cd1172434d78498c0e75', uc: '運営分析業務/蔵書の利用状況を分析するフロー/期間別貸出統計を参照する' } }, globals: { portal: 'staff' } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Monthly: Story = { args: { state: 'ready' } }
export const Daily: Story = { args: { daily: true }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole('img', { name: '日別の貸出件数' })).toBeInTheDocument() } }
export const Loading: Story = { args: { state: 'loading' } }
export const Empty: Story = { args: { state: 'empty', daily: true } }
export const Error: Story = { args: { state: 'error' } }

import { useState, useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn, within, expect, userEvent, waitFor } from 'storybook/test'
import { PortalShell } from '@/components/ui/PortalShell'
import { Button } from '@/components/ui/Button'
import { Alert, LoadingBlock } from '@/components/ui/Feedback'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { LoanRegisterPanel, ReturnRegisterPanel, ConfirmPanel } from '@/components/domain/CounterPanels'
import { BookCard } from '@/components/domain/BookCard'
import { ReservationQueueTracker } from '@/components/domain/ReservationQueueTracker'
import { ReservationStatusBadge } from '@/components/domain/StatusBadges'
import { ReservationTable, NotificationLogTable, OverdueTable } from '@/components/domain/LoanTables'
import { StatCard } from '@/components/domain/Reports'
import { PiiMaskedText } from '@/components/domain/PiiMaskedText'
import { api, TODAY, bookView, userView, loanView, reservationView, notificationView, useDemoAction } from '../_circulation/view'
type Props = { bookId?: string; reservationId?: string; loanId?: string; scenario: string; onNavigate: (route: string) => void; onRequest: (request: object) => void }

function Page({scenario,onRequest,onNavigate}:Props){
 const [state,setState]=useState(scenario)
 const [page,setPage]=useState(1)
 const count=state==='Empty'?0:1
 const rows=count?[{...loanView,state:'延滞' as const,dueDate:api.overdue.loan.due_date,lastReminderAt:api.overdue.notifications[0].sent_at,lastReminderResult:api.overdue.notifications[0].send_result,reminderCount:api.overdue.notifications.length}]:[]
 const notification={...notificationView,kind:api.overdue.notifications[0].notification_type,subject:api.overdue.notifications[0].subject}
 return <PortalShell portal="staff" currentPath="/staff/overdues" title="延滞・督促状況" userName="司書 田中"><div className="flex flex-col gap-4">
 {state==='Error'?<Alert tone="destructive" title="延滞一覧を取得できません"><Button onClick={()=>{onRequest({operation:'listOverdueLoans',query:{page,page_size:20}});setState('Default')}}>再取得する</Button></Alert>:<>
 <StatCard label="延滞中の貸出" value={count} unit="件" tone="destructive" icon="calendar-clock" loading={state==='Loading'}/>
 <OverdueTable today={TODAY} rows={rows} loading={state==='Loading'} onOpenUser={row=>onNavigate(`/staff/users/${row.userNumber}/status`)}/>
 <NotificationLogTable logs={count?[notification]:[]} loading={state==='Loading'}/>
 <Pagination page={page} pageSize={20} total={count} onChange={p=>{setPage(p);onRequest({operation:'listOverdueLoans',query:{page:p,page_size:20}})}}/>
 </>}
 </div></PortalShell>
}

const meta = { id: 'pages-staff-overdues', title: 'Pages/司書ポータル/延滞・督促状況画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', contract_sha256: 'c58e2e29d5d752a2e03be759ee495e9b4bb47443930111e6a586780c634ffc8b', uc: '延滞一覧を参照する', route: '/staff/overdues' }, args: { scenario: 'Default', onNavigate: fn(), onRequest: fn() } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { scenario: 'Default' }, play: async ({canvasElement,args})=>{ const c=within(canvasElement); await userEvent.click(c.getByRole('button',{name:'利用状況'})); expect(args.onNavigate).toHaveBeenCalledWith('/staff/users/U-000123/status'); } }
export const Empty: Story = { args: { scenario: 'Empty' } }
export const Loading: Story = { args: { scenario: 'Loading' } }
export const Error: Story = { args: { scenario: 'Error' } }

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
import { api, TODAY, bookView, userView, loanView, reservationView, notificationView, useDemoAction, getDraft } from '../_circulation/view'
type Props = { bookId?: string; reservationId?: string; loanId?: string; scenario: string; onNavigate: (route: string) => void; onRequest: (request: object) => void }

function Page({scenario, onRequest, bookId: routeBookId}: Props) {
 const [user, setUser] = useState(getDraft('loan-register',scenario)?.payload.body?.user_number ?? api.user.user_number as string)
 const [book, setBook] = useState(getDraft('loan-register',scenario)?.payload.body?.book_id ?? routeBookId ?? new URLSearchParams(window.location.search).get('bookId') ?? api.book.book_id as string)
 const [phase, setPhase] = useState<'input'|'allowed'|'denied'|'done'>(scenario === 'Allowed' || scenario === 'Submitting' || scenario === 'Error' || !!getDraft('loan-register',scenario) ? 'allowed' : scenario === 'Denied' ? 'denied' : scenario === 'Done' ? 'done' : 'input')
 const action = useDemoAction('loan-register', scenario, onRequest, {operation:'createLoan',body:{book_id:book,user_number:user}})
 const busy = action.status === 'Submitting'
 const reset = () => {if(action.pending)return;action.reset(); setPhase('input')}
 const lookup = () => {if(busy || action.pending)return; onRequest({operation:'getLoanEligibility',query:{book_id:book,user_number:user}}); if(book !== api.book.book_id || user !== api.user.user_number){action.setStatus('NotFound'); setPhase('input')} else {action.setStatus('Allowed');setPhase('allowed')}}
 return <PortalShell portal="staff" currentPath="/staff/loans/new" title="貸出受付" userName="司書 田中">
 <div className="flex flex-col gap-4">
 {action.status==='Error' && <Alert tone="destructive" title="貸出の結果を確認できません">入力を保持しています。同じ内容で結果を確認してください。<Button onClick={()=>action.run({operation:'createLoan',body:{book_id:book,user_number:user}},()=>setPhase('done'))}>結果を確認する</Button></Alert>}
 {action.status==='NotFound' && <Alert tone="destructive" title="書籍または利用者が見つかりません">IDを確認してください。</Alert>}
 <LoanRegisterPanel userNumber={user} bookId={book} onUserNumberChange={v=>{if(!action.pending && !busy){setUser(v);reset()}}} onBookIdChange={v=>{if(!action.pending && !busy){setBook(v);reset()}}} onLookup={lookup} today={api.eligibility.business_date} phase={phase} submitting={busy}
 lookup={phase==='input'?undefined:{user:userView,book:{...bookView,state:phase==='denied'?'貸出中':'在庫あり'},allowed:phase!=='denied',deniedReason:phase==='denied'?'この書籍は貸出中です。予約を案内してください。':api.eligibility.reason??undefined,dueDate:phase==='denied'?undefined:api.eligibility.due_date,loanPeriodDays:api.eligibility.loan_period_days}}
 onConfirm={()=>action.run({operation:'createLoan',body:{book_id:book,user_number:user}},()=>setPhase('done'))} onReset={()=>{if(!action.pending && !busy){setBook('');setUser('');reset()}}}/>
 </div></PortalShell>
}

const meta = { id: 'pages-staff-loan-register', title: 'Pages/司書ポータル/貸出受付画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', contract_sha256: '6f1d67d567645528fa27c72580a368049a32abcea92c19849ab163cf7b92a895', uc: '貸出を登録する', route: '/staff/loans/new' }, args: { scenario: 'Input', onNavigate: fn(), onRequest: fn() } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Input: Story = { args: { scenario: 'Input' }, play: async ({canvasElement,args})=>{ const c=within(canvasElement); await userEvent.click(c.getByRole('button',{name:'確認する'})); await userEvent.click(c.getByRole('button',{name:'貸出を確定する'})); await waitFor(()=>expect(c.getByText('貸出を登録しました')).toBeVisible()); expect(args.onRequest).toHaveBeenCalled(); } }
export const Allowed: Story = { args: { scenario: 'Allowed' } }
export const Denied: Story = { args: { scenario: 'Denied' } }
export const Done: Story = { args: { scenario: 'Done' } }
export const Submitting: Story = { args: { scenario: 'Submitting' } }
export const Error: Story = { args: { scenario: 'Error' }, beforeEach: ()=>{sessionStorage.setItem('story:loan-register:Error', JSON.stringify({"key": "restore-loan-register", "payload": {"operation": "createLoan", "body": {"book_id": "B-000102", "user_number": "U-000123"}}})); return ()=>sessionStorage.removeItem('story:loan-register:Error')}, play: async ({canvasElement,args})=>{const c=within(canvasElement);const saved=JSON.parse(sessionStorage.getItem('story:loan-register:Error')!);await userEvent.click(c.getByRole('button',{name:'確認する'})); const input=c.getByLabelText(/書籍 ID/); await userEvent.clear(input); await userEvent.type(input,'B-OTHER'); expect(input).toHaveValue('B-000102'); expect(JSON.parse(sessionStorage.getItem('story:loan-register:Error')!)).toEqual(saved); await userEvent.click(c.getByRole('button',{name:'結果を確認する'})); await waitFor(()=>expect(c.getByText('貸出を登録しました')).toBeVisible()); expect(args.onRequest).toHaveBeenCalledWith(saved); expect(sessionStorage.getItem('story:loan-register:Error')).toBeNull();} }
export const NotFound: Story = { args: { scenario: 'NotFound' } }

export const DirectLink: Story = {args:{scenario:'Input',bookId:'B-009999'},play:async({canvasElement,args})=>{const c=within(canvasElement);expect(c.getByLabelText(/書籍 ID/)).toHaveValue('B-009999');await userEvent.click(c.getByRole('button',{name:'確認する'}));expect(args.onRequest).toHaveBeenCalledWith({operation:'getLoanEligibility',query:{book_id:'B-009999',user_number:'U-000123'}})}}

export const ReloadPending: Story = { args:{scenario:'Input'}, beforeEach:()=>{sessionStorage.setItem('story:loan-register:Input',JSON.stringify({key:'reload-loan-register',payload:{operation:'createLoan',body:{book_id:'B-000102',user_number:'U-000123'}}}));return()=>sessionStorage.removeItem('story:loan-register:Input')}, play:async({canvasElement,args})=>{const c=within(canvasElement);const saved=JSON.parse(sessionStorage.getItem('story:loan-register:Input')!);await userEvent.click(c.getByRole('button',{name:'結果を確認する'}));await waitFor(()=>expect(c.getByText('貸出を登録しました')).toBeVisible());expect(args.onRequest).toHaveBeenCalledWith(saved);expect(sessionStorage.getItem('story:loan-register:Input')).toBeNull();} }

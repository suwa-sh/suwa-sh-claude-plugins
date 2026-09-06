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

function Page({scenario,onRequest,onNavigate,bookId:routeBookId}:Props){
 const [book,setBook]=useState(getDraft('return-register',scenario)?.payload.body?.book_id ?? routeBookId ?? new URLSearchParams(window.location.search).get('bookId') ?? api.book.book_id as string)
 const [phase,setPhase]=useState<'input'|'found'|'found-with-reservation'|'done'>(scenario==='Input'||scenario==='NotFound'?'input':scenario==='Found'?'found':scenario==='Done'?'done':'found-with-reservation')
 const action=useDemoAction('return-register',scenario,onRequest)
 const withReservation=scenario!=='Found'
 const busy=action.status==='Submitting'
 return <PortalShell portal="staff" currentPath="/staff/returns/new" title="返却受付" userName="司書 田中"><div className="flex flex-col gap-4">
 {action.status==='NotFound'&&<Alert tone="destructive" title="未返却の貸出が見つかりません">書籍IDを確認してください。</Alert>}
 {action.status==='Error'&&<Alert tone="destructive" title="返却の結果を確認できません">同じ内容で再確認してください。<Button onClick={()=>action.run({operation:'returnLoan',path:{loan_id:api.loan.loan_id},body:{version:api.loan.version}},()=>setPhase('done'))}>結果を確認する</Button></Alert>}
 <ReturnRegisterPanel bookId={book} onBookIdChange={v=>{if(!action.pending && !busy){setBook(v);setPhase('input');action.reset()}}} today={TODAY} phase={phase} submitting={busy}
 lookup={phase==='input'?undefined:{loan:phase==='done'?{...loanView,state:'返却済み',returnedAt:TODAY}:loanView,book:bookView,nextBookState:withReservation?'予約待ち':'在庫あり',firstReservation:withReservation?reservationView:undefined}}
 onLookup={()=>{if(busy || action.pending)return;onRequest({operation:'getReturnPreview',path:{book_id:book}});if(book!==api.book.book_id){action.setStatus('NotFound');setPhase('input')}else{setPhase(withReservation?'found-with-reservation':'found');action.setStatus('Found')}}}
 onConfirm={()=>action.run({operation:'returnLoan',path:{loan_id:api.loan.loan_id},body:{version:api.loan.version}},()=>setPhase('done'))}
 onReset={()=>{if(!action.pending && !busy){setBook('');setPhase('input');action.reset()}}}
 onNotify={()=>onNavigate(`/staff/returns/${api.loan.loan_id}/notify`)}/>
 {phase==='done'&&withReservation&&<Alert tone="info" title="返却通知を受け付けました">送信結果は返却通知画面で確認できます。</Alert>}
 </div></PortalShell>
}

const meta = { id: 'pages-staff-return-register', title: 'Pages/司書ポータル/返却受付画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', contract_sha256: '058b916330fc492b143e3abe4067677354bb6838b338004c869e440a45da8ecd', uc: '返却を登録する', route: '/staff/returns/new' }, args: { scenario: 'Input', onNavigate: fn(), onRequest: fn() } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Input: Story = { args: { scenario: 'Input' }, play: async ({canvasElement,args})=>{ const c=within(canvasElement); await userEvent.click(c.getByRole('button',{name:'確認する'})); await userEvent.click(c.getByRole('button',{name:'返却を確定する'})); await waitFor(()=>expect(c.getByText('返却を登録しました')).toBeVisible()); await userEvent.click(c.getByRole('button',{name:'返却通知を送る'})); expect(args.onNavigate).toHaveBeenCalledWith('/staff/returns/L-002001/notify'); } }
export const Found: Story = { args: { scenario: 'Found' } }
export const FoundWithReservation: Story = { args: { scenario: 'FoundWithReservation' } }
export const Done: Story = { args: { scenario: 'Done' } }
export const Submitting: Story = { args: { scenario: 'Submitting' } }
export const Error: Story = { args: { scenario: 'Error' }, beforeEach: ()=>{sessionStorage.setItem('story:return-register:Error', JSON.stringify({"key": "restore-return-register", "payload": {"operation": "returnLoan", "path": {"loan_id": "L-002001"}, "body": {"version": 1}}})); return ()=>sessionStorage.removeItem('story:return-register:Error')}, play: async ({canvasElement,args})=>{const c=within(canvasElement);const saved=JSON.parse(sessionStorage.getItem('story:return-register:Error')!);await userEvent.click(c.getByRole('button',{name:'確認する'})); const input=c.getByLabelText(/書籍 ID/); await userEvent.clear(input); await userEvent.type(input,'B-OTHER'); expect(input).toHaveValue('B-000102'); expect(JSON.parse(sessionStorage.getItem('story:return-register:Error')!)).toEqual(saved); await userEvent.click(c.getByRole('button',{name:'返却を確定する'})); await waitFor(()=>expect(c.getByText('返却を登録しました')).toBeVisible()); expect(args.onRequest).toHaveBeenCalledWith(saved); expect(sessionStorage.getItem('story:return-register:Error')).toBeNull();} }
export const NotFound: Story = { args: { scenario: 'NotFound' } }

export const ReloadPending: Story = { args:{scenario:'Input'}, beforeEach:()=>{sessionStorage.setItem('story:return-register:Input',JSON.stringify({key:'reload-return-register',payload:{operation:'returnLoan',path:{loan_id:'L-002001'},body:{version:1}}}));return()=>sessionStorage.removeItem('story:return-register:Input')}, play:async({canvasElement,args})=>{const c=within(canvasElement);const saved=JSON.parse(sessionStorage.getItem('story:return-register:Input')!);await userEvent.click(c.getByRole('button',{name:'結果を確認する'}));await waitFor(()=>expect(c.getByText('返却を登録しました')).toBeVisible());expect(args.onRequest).toHaveBeenCalledWith(saved);expect(sessionStorage.getItem('story:return-register:Input')).toBeNull();} }

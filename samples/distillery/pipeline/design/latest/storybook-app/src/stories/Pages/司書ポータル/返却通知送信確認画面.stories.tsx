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

function Page({scenario,onRequest,onNavigate,loanId:routeLoanId}:Props){
 const targetLoanId=routeLoanId ?? new URLSearchParams(window.location.search).get('loanId') ?? api.loan.loan_id
 useEffect(()=>onRequest({operation:'getReturnNotificationStatus',path:{loan_id:targetLoanId}}),[targetLoanId,onRequest])
 const [delivery,setDelivery]=useState(scenario)
 const action=useDemoAction('return-notification',scenario==='Error'?'Input':scenario,onRequest)
 useEffect(()=>{if(delivery!=='Queued')return;const timer=setInterval(()=>onRequest({operation:'getReturnNotificationStatus',path:{loan_id:targetLoanId}}),5000);return()=>clearInterval(timer)},[delivery,onRequest])
 const blocked=delivery==='Queued'||delivery==='Unknown'||delivery==='NoReservation'
 return <PortalShell portal="staff" currentPath={`/staff/returns/${targetLoanId}/notify`} title="返却通知" userName="司書 田中"><div className="flex flex-col gap-4">
 {delivery==='Loading'?<LoadingBlock message="通知結果を確認しています"/>:delivery==='Error'?<Alert tone="destructive" title="通知結果を取得できません"><Button onClick={()=>{onRequest({operation:'getReturnNotificationStatus',path:{loan_id:targetLoanId}});setDelivery('Default')}}>再取得する</Button></Alert>:<>
 {delivery==='Queued'&&<Alert tone="info" title="通知を受け付けました">送信結果を5秒ごとに確認しています。</Alert>}
 {delivery==='Unknown'&&<Alert tone="warning" title="送信結果を確認中です">重複を防ぐため再送を停止しています。</Alert>}
 {delivery==='Sent'&&<Alert tone="success" title="返却通知を送信しました"/>}
 {delivery==='Failed'&&<Alert tone="destructive" title="返却通知を送信できませんでした">送信記録と宛先を確認してください。</Alert>}
 <ConfirmPanel title="返却通知の送信" summary={[{label:'書籍',value:api.book.title},{label:'予約者',value:delivery==='NoReservation'?'予約者なし':api.user.name},{label:'送信先',value:delivery==='NoReservation'?'—':<PiiMaskedText value={api.user.email} kind="email"/>}]} blocked={blocked||delivery==='Sent'||delivery==='Failed'} blockedReason={delivery==='NoReservation'?'現在の通知対象予約はありません。':delivery==='Sent'?'この通知は送信済みです。':delivery==='Failed'?'この通知の配信は終了しています。結果の再確認を行ってください。':'配信結果の確認中です。'} submitting={action.status==='Submitting'} confirmLabel="通知を受け付ける" onConfirm={()=>action.run({operation:'requestReturnNotification',path:{reservation_id:api.reservation.reservation_id},body:{version:api.reservation.version}},()=>{setDelivery('Queued');onRequest({operation:'getReturnNotificationStatus',path:{loan_id:targetLoanId}})})} onCancel={()=>onNavigate('/staff/returns/new')}/>
 <ReservationTable reservations={delivery==='NoReservation'?[]:[{...reservationView,state:delivery==='Sent'?'通知済み':reservationView.state}]} showUser/>
 <NotificationLogTable logs={delivery==='Sent'?[notificationView]:delivery==='Failed'?[{...notificationView,result:'失敗'}]:[]}/>
 </>}
 </div></PortalShell>
}

const meta = { id: 'pages-staff-return-notify', title: 'Pages/司書ポータル/返却通知送信確認画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', contract_sha256: 'af1917cbdb896ddfb5acbb95ea184014f616d7e4bd7638537398f8a57f14d1a6', uc: '返却通知を送信する', route: '/staff/returns/:loanId/notify' }, args: { scenario: 'Default', onNavigate: fn(), onRequest: fn() } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { scenario: 'Default' }, play: async ({canvasElement,args})=>{ const c=within(canvasElement); await userEvent.click(c.getByRole('button',{name:'通知を受け付ける'})); await waitFor(()=>expect(c.getByText('通知を受け付けました')).toBeVisible()); expect(c.queryByText('返却通知を送信しました')).not.toBeInTheDocument(); } }
export const Sent: Story = { args: { scenario: 'Sent' } }
export const Failed: Story = { args: { scenario: 'Failed' } }
export const Queued: Story = { args: { scenario: 'Queued' } }
export const Unknown: Story = { args: { scenario: 'Unknown' } }
export const Error: Story = { args: { scenario: 'Error' } }
export const Loading: Story = { args: { scenario: 'Loading' } }
export const NoReservation: Story = { args: { scenario: 'NoReservation' } }

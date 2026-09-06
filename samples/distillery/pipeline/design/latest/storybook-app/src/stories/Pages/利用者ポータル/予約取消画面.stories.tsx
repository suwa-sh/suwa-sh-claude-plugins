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

function Page({scenario,onNavigate,onRequest,reservationId:routeReservationId}:Props){
 const targetReservationId=routeReservationId ?? new URLSearchParams(window.location.search).get('reservationId') ?? api.reservation.reservation_id
 useEffect(()=>onRequest({operation:'getReservation',path:{reservation_id:targetReservationId}}),[targetReservationId,onRequest])
 const action=useDemoAction('cancel-reservation',scenario,onRequest,{operation:'cancelReservation',path:{reservation_id:targetReservationId},body:{version:api.reservation.version}})
 return <PortalShell portal="patron" currentPath={`/reservations/${targetReservationId}/cancel`} title="予約取消" userName={userView.name}><div className="flex flex-col gap-4">
 {scenario==='NotFound'?<Alert tone="destructive" title="予約が見つかりません"><Button onClick={()=>onNavigate('/me/reservations')}>マイ予約状況へ</Button></Alert>:action.status==='Done'?<Alert tone="success" title="予約を取り消しました"><Button onClick={()=>onNavigate('/me/reservations')}>マイ予約状況へ</Button></Alert>:<>
 {action.status==='Error'&&<Alert tone="destructive" title="取消の結果を確認できません">内容を保持しています。同じ要求で結果を確認します。</Alert>}
 {action.status==='Conflict'&&<Alert tone="warning" title="予約の状態が更新されました"><Button onClick={()=>{onRequest({operation:'getReservation',path:{reservation_id:targetReservationId}});action.reset()}}>最新の予約を確認する</Button></Alert>}
 <ConfirmPanel title="予約を取り消しますか" tone="destructive" summary={[{label:'書籍',value:api.reservation.book_title},{label:'予約順位',value:`${api.reservation.queue_position} 位`},{label:'状態',value:<ReservationStatusBadge state={api.reservation.current_status}/>}]} impact="取り消すと予約の順番が失われます。" blocked={action.status==='Conflict'} blockedReason="最新の予約を確認してください。" submitting={action.status==='Submitting'} confirmLabel={action.status==='Error'?'結果を確認する':'予約を取り消す'} onConfirm={()=>action.run({operation:'cancelReservation',path:{reservation_id:targetReservationId},body:{version:api.reservation.version}},()=>{onRequest({operation:'listMyReservations'});onRequest({operation:'getBook',path:{book_id:api.book.book_id}})})} onCancel={()=>onNavigate('/me/reservations')}/></>}
 </div></PortalShell>
}

const meta = { id: 'pages-patron-cancel', title: 'Pages/利用者ポータル/予約取消画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', contract_sha256: 'cd0145c70c01ea9308fc5239d94c76ec15a10b69f28670785b5c7270813fa17b', uc: '予約を取り消す', route: '/reservations/:reservationId/cancel' }, args: { scenario: 'Default', onNavigate: fn(), onRequest: fn() } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { scenario: 'Default' }, play: async ({canvasElement,args})=>{ const c=within(canvasElement); await userEvent.click(c.getByRole('button',{name:'予約を取り消す'})); await waitFor(()=>expect(c.getByText('予約を取り消しました')).toBeVisible()); expect(args.onRequest).toHaveBeenCalled(); } }
export const Submitting: Story = { args: { scenario: 'Submitting' } }
export const Done: Story = { args: { scenario: 'Done' } }
export const Error: Story = { args: { scenario: 'Error' }, beforeEach: ()=>{sessionStorage.setItem('story:cancel-reservation:Error', JSON.stringify({"key": "restore-cancel-reservation", "payload": {"operation": "cancelReservation", "path": {"reservation_id": "R-003001"}, "body": {"version": 1}}})); return ()=>sessionStorage.removeItem('story:cancel-reservation:Error')}, play: async ({canvasElement,args})=>{const c=within(canvasElement);const saved=JSON.parse(sessionStorage.getItem('story:cancel-reservation:Error')!);await userEvent.click(c.getByRole('button',{name:'結果を確認する'})); await waitFor(()=>expect(c.getByText('予約を取り消しました')).toBeVisible()); expect(args.onRequest).toHaveBeenCalledWith(saved); expect(sessionStorage.getItem('story:cancel-reservation:Error')).toBeNull();} }
export const NotFound: Story = { args: { scenario: 'NotFound' } }
export const Conflict: Story = { args: { scenario: 'Conflict' } }

export const DirectLink: Story = {args:{scenario:'Default',reservationId:'R-009999'},play:async({canvasElement,args})=>{const c=within(canvasElement);expect(args.onRequest).toHaveBeenCalledWith({operation:'getReservation',path:{reservation_id:'R-009999'}});await userEvent.click(c.getByRole('button',{name:'予約を取り消す'}));await waitFor(()=>expect(c.getByText('予約を取り消しました')).toBeVisible());expect(args.onRequest).toHaveBeenCalledWith(expect.objectContaining({payload:{operation:'cancelReservation',path:{reservation_id:'R-009999'},body:{version:1}}}))}}

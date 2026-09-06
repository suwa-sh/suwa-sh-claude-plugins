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

function Page({scenario,onRequest,onNavigate,bookId:routeBookId}:Props){
 const targetBookId=routeBookId ?? new URLSearchParams(window.location.search).get('bookId') ?? api.book.book_id
 useEffect(()=>onRequest({operation:'getBook',path:{book_id:targetBookId}}),[targetBookId,onRequest])
 const action=useDemoAction('reserve',scenario,onRequest,{operation:'createReservation',body:{book_id:targetBookId}})
 const unavailable=scenario==='AlreadyAvailable'||scenario==='Electronic'
 const book={...bookView,id:targetBookId,state:scenario==='AlreadyAvailable'?'在庫あり' as const:scenario==='ReservationWaiting'?'予約待ち' as const:'貸出中' as const,media:scenario==='Electronic'?'電子' as const:'紙' as const}
 return <PortalShell portal="patron" currentPath={`/books/${targetBookId}/reserve`} title="予約申込" userName={userView.name}><div className="flex flex-col gap-4">
 {scenario==='Loading'?<LoadingBlock message="書籍を確認しています"/>:scenario==='NotFound'?<Alert tone="destructive" title="書籍が見つかりません"><Button onClick={()=>onNavigate('/search')}>蔵書検索へ</Button></Alert>:<>
 <BookCard book={book} variant="detail"/>
 {action.status==='Error'&&<Alert tone="destructive" title="予約の結果を確認できません">入力を保持しています。同じ内容で再確認してください。</Alert>}
 {action.status==='Done'?<><Alert tone="success" title="予約を受け付けました"/><ReservationQueueTracker state={api.reservation.current_status} position={api.reservation.queue_position}/><Button onClick={()=>onNavigate('/me/reservations')}>マイ予約状況へ</Button></>:<ConfirmPanel title="この書籍を予約しますか" summary={[{label:'書籍',value:api.book.title},{label:'現在の状態',value:book.state}]} blocked={unavailable} blockedReason={scenario==='Electronic'?'電子書籍は予約の対象外です。':'在庫があります。窓口で貸出を受け付けてください。'} submitting={action.status==='Submitting'} confirmLabel={action.status==='Error'?'結果を確認する':'予約を確定する'} onConfirm={()=>action.run({operation:'createReservation',body:{book_id:targetBookId}},()=>{onRequest({operation:'getBook',path:{book_id:targetBookId}});onRequest({operation:'listMyReservations'})})} onCancel={()=>onNavigate(`/books/${targetBookId}`)}/>}</>}
 </div></PortalShell>
}

const meta = { id: 'pages-patron-reserve', title: 'Pages/利用者ポータル/予約申込画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', contract_sha256: 'aa95a8ea27e624c3c5ca0cd1a1f6752a7a14f7a5975b9783fad2e1acf646116a', uc: '予約を登録する', route: '/books/:bookId/reserve' }, args: { scenario: 'OnLoan', onNavigate: fn(), onRequest: fn() } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const OnLoan: Story = { args: { scenario: 'OnLoan' }, play: async ({canvasElement,args})=>{ const c=within(canvasElement); await userEvent.click(c.getByRole('button',{name:'予約を確定する'})); await waitFor(()=>expect(c.getByText('予約を受け付けました')).toBeVisible()); await userEvent.click(c.getByRole('button',{name:'マイ予約状況へ'})); expect(args.onNavigate).toHaveBeenCalledWith('/me/reservations'); } }
export const AlreadyAvailable: Story = { args: { scenario: 'AlreadyAvailable' } }
export const Submitting: Story = { args: { scenario: 'Submitting' } }
export const Done: Story = { args: { scenario: 'Done' } }
export const Error: Story = { args: { scenario: 'Error' }, beforeEach: ()=>{sessionStorage.setItem('story:reserve:Error', JSON.stringify({"key": "restore-reserve", "payload": {"operation": "createReservation", "body": {"book_id": "B-000102"}}})); return ()=>sessionStorage.removeItem('story:reserve:Error')}, play: async ({canvasElement,args})=>{const c=within(canvasElement);const saved=JSON.parse(sessionStorage.getItem('story:reserve:Error')!);await userEvent.click(c.getByRole('button',{name:'結果を確認する'})); await waitFor(()=>expect(c.getByText('予約を受け付けました')).toBeVisible()); expect(args.onRequest).toHaveBeenCalledWith(saved); expect(sessionStorage.getItem('story:reserve:Error')).toBeNull();} }
export const Loading: Story = { args: { scenario: 'Loading' } }
export const NotFound: Story = { args: { scenario: 'NotFound' } }
export const Electronic: Story = { args: { scenario: 'Electronic' } }
export const ReservationWaiting: Story = { args: { scenario: 'ReservationWaiting' } }

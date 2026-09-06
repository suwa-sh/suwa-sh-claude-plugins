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
 const [state,setState]=useState(scenario)
 const rows=state==='Empty'?[]:[reservationView]
 return <PortalShell portal="staff" currentPath={`/staff/books/${targetBookId}/reservations`} title="書籍別予約状況" userName="司書 田中"><div className="flex flex-col gap-4">
 {state==='NotFound'?<Alert tone="destructive" title="書籍が見つかりません"><Button onClick={()=>onNavigate('/staff/books')}>蔵書一覧へ</Button></Alert>:state==='Error'?<Alert tone="destructive" title="予約一覧を取得できません"><Button onClick={()=>{onRequest({operation:'listReservations',path:{book_id:targetBookId},query:{page:1,page_size:20}});setState('Default')}}>再取得する</Button></Alert>:<>
 <BookCard book={{...bookView,id:targetBookId}} variant="compact"/>
 <ReservationTable reservations={rows} showUser loading={state==='Loading'}/>
 {state!=='Loading'&&rows.map(row=><Card key={row.id}><p>{row.userName}</p><ReservationQueueTracker state={row.state} position={row.position} total={1}/></Card>)}
 <Pagination page={1} pageSize={20} total={state==='Empty'?0:1} onChange={page=>onRequest({operation:'listReservations',path:{book_id:targetBookId},query:{page,page_size:20}})}/>
 </>}
 </div></PortalShell>
}

const meta = { id: 'pages-staff-reservations', title: 'Pages/司書ポータル/書籍別予約状況画面', component: Page, tags: ['autodocs'], parameters: { layout: 'fullscreen', contract_sha256: '12f58f12f6ed07cd059c81ccb21fd83c34c8d1b2c35a51ab23ac433ea1669951', uc: '予約一覧を参照する', route: '/staff/books/:bookId/reservations' }, args: { scenario: 'Default', onNavigate: fn(), onRequest: fn() } } satisfies Meta<typeof Page>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { scenario: 'Default' }, play: async ({canvasElement,args})=>{ const c=within(canvasElement); expect(c.getByRole('table',{name:'予約一覧'})).toBeVisible(); expect(c.getByText('山田 花子 (U-000123)')).toBeVisible(); } }
export const Empty: Story = { args: { scenario: 'Empty' } }
export const Loading: Story = { args: { scenario: 'Loading' } }
export const Error: Story = { args: { scenario: 'Error' } }
export const NotFound: Story = { args: { scenario: 'NotFound' } }

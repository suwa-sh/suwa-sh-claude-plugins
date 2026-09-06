import { useEffect, useRef, useState } from 'react'
import type { Book, User, Loan, Reservation, NotificationLog } from '../../../components/domain/types'
import { api } from './fixtures'
export { api, TODAY } from './fixtures'
export const bookView: Book = { id: api.book.book_id, title: api.book.title, author: api.book.author, isbn: api.book.isbn ?? '', publisher: api.book.publisher ?? '', genre: '技術', media: api.book.media_type, state: api.book.current_status, registeredAt: api.book.registered_at, reservationCount: api.book.reservation_count }
export const userView: User = { number: api.user.user_number, name: api.user.name, email: api.user.email, phone: api.user.phone ?? '', address: api.user.address ?? '', registeredAt: api.user.registered_at }
export const loanView: Loan = { id: api.loan.loan_id, book: { id: api.loan.book_id, title: api.loan.book_title, author: api.loan.book_author }, userNumber: api.loan.user_number, userName: api.loan.user_name, loanedAt: api.loan.loaned_on, dueDate: api.loan.due_date, returnedAt: api.loan.returned_on ?? undefined, state: api.loan.current_status }
export const reservationView: Reservation = { id: api.reservation.reservation_id, book: { id: api.reservation.book_id, title: api.reservation.book_title, author: api.reservation.book_author }, userNumber: api.reservation.user_number, userName: api.reservation.user_name, acceptedAt: api.reservation.accepted_at, position: api.reservation.queue_position, state: api.reservation.current_status }
export const notificationView: NotificationLog = { id: api.notification.notification_id, kind: api.notification.notification_type, to: api.notification.recipient_email, subject: api.notification.subject, sentAt: api.notification.sent_at, result: api.notification.send_result }

type Draft = {key: string; payload: {operation: string; body?: {book_id?: string; user_number?: string; version?: number}; path?: {loan_id?: string; reservation_id?: string}}}
export function getDraft(scope: string, scenario = 'Input'): Draft | undefined {
  try { const value = JSON.parse(sessionStorage.getItem(`story:${scope}:${scenario}`) ?? 'null'); return value?.key && value?.payload?.operation ? value : undefined } catch { return undefined }
}
const initialPayloads: Record<string, Draft['payload']> = {
 'loan-register': {operation:'createLoan',body:{book_id:api.book.book_id,user_number:api.user.user_number}},
 'return-register': {operation:'returnLoan',path:{loan_id:api.loan.loan_id},body:{version:api.loan.version}},
 'reserve': {operation:'createReservation',body:{book_id:api.book.book_id}},
 'cancel-reservation': {operation:'cancelReservation',path:{reservation_id:api.reservation.reservation_id},body:{version:api.reservation.version}},
 'return-notification': {operation:'requestReturnNotification',path:{reservation_id:api.reservation.reservation_id},body:{version:api.reservation.version}},
}
// Only this Story harness simulates a response. Durable unresolved requests retain their payload and key.
export function useDemoAction(scope: string, initial: string, onRequest?: (request: object) => void, pendingPayload?: Draft['payload']) {
 const [startingDraft] = useState(() => {
   const restored = getDraft(scope, initial)
   if(restored) return restored
   if(initial !== 'Error') return undefined
   const pending = {key:crypto.randomUUID(),payload:pendingPayload ?? initialPayloads[scope]}
   sessionStorage.setItem(`story:${scope}:${initial}`,JSON.stringify(pending))
   return pending
 })
 const [status,setStatus] = useState(startingDraft ? 'Error' : initial)
 const inFlight = useRef(false)
 const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
 const snapshot = useRef<Draft | undefined>(startingDraft)
 useEffect(() => () => clearTimeout(timer.current),[])
 const run = (payload: Draft['payload'], after:()=>void) => {
   if(inFlight.current) return
   snapshot.current ??= {key:crypto.randomUUID(),payload:structuredClone(payload)}
   sessionStorage.setItem(`story:${scope}:${initial}`,JSON.stringify(snapshot.current))
   inFlight.current=true; setStatus('Submitting'); onRequest?.(structuredClone(snapshot.current))
   timer.current=setTimeout(()=>{inFlight.current=false;setStatus('Done');sessionStorage.removeItem(`story:${scope}:${initial}`);snapshot.current=undefined;after()},350)
 }
 const reset=()=>{if(inFlight.current || snapshot.current)return;clearTimeout(timer.current);setStatus('Input')}
 return {status,setStatus,run,reset,draft:startingDraft,pending:!!snapshot.current}
}

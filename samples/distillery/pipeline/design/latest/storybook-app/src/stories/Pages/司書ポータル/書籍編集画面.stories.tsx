import {useState,useRef,useEffect} from 'react'
import type {Meta,StoryObj} from '@storybook/nextjs-vite'
import {fn,expect,within,userEvent,waitFor} from 'storybook/test'
import {PortalShell} from '@/components/ui/PortalShell'
import {Button} from '@/components/ui/Button'
import {Alert,LoadingBlock,EmptyState} from '@/components/ui/Feedback'
import {Select} from '@/components/ui/Input'
import {BookForm,UserForm,type BookFormValue,type BookFormErrors,type UserFormValue,type UserFormErrors} from '@/components/domain/Forms'
import {ConfirmPanel} from '@/components/domain/CounterPanels'
import {BookStatusBadge} from '@/components/domain/StatusBadges'
import {PiiMaskedText} from '@/components/domain/PiiMaskedText'
import type {Genre} from '@/components/domain/types'
type ApiEntity={ "author": string; "book_id": string; "current_status": "在庫あり" | "貸出中" | "予約待ち"; "genre_id": string; "genre_name": string; "isbn": string | null; "media_type": "紙" | "電子"; "my_reservation": { "current_status": "予約中" | "通知済み"; "queue_position": number; "reservation_id": string } | null; "publisher": string | null; "registered_at": string; "reservation_count": number; "title": string; "updated_at": string; "version": number }
const fixture: ApiEntity={"book_id":"B-001","title":"吾輩は猫である","author":"夏目漱石","isbn":"9784101010014","publisher":"青葉出版","genre_id":"G-001","genre_name":"文学","media_type":"紙","current_status":"在庫あり","version":2,"updated_at":"2026-09-06T01:00:00Z","registered_at":"2026-09-01T01:00:00Z","reservation_count":0,"my_reservation":null}
const genreResponse={"items":[{"genre_id":"G-001","genre_name":"文学","description":null},{"genre_id":"G-002","genre_name":"社会科学","description":null},{"genre_id":"G-003","genre_name":"自然科学","description":null},{"genre_id":"G-004","genre_name":"技術","description":null},{"genre_id":"G-005","genre_name":"芸術","description":null},{"genre_id":"G-006","genre_name":"歴史","description":null},{"genre_id":"G-007","genre_name":"児童書","description":null},{"genre_id":"G-008","genre_name":"その他","description":null}],"total":8,"page":1,"page_size":100}
const entityFixtures:ApiEntity[]=[fixture,{...fixture,book_id:'B-002',title:'銀河鉄道の夜',author:'宮沢賢治',version:5}]
type FormValue=BookFormValue
type Errors=BookFormErrors
type Request={operation:string;path:Record<string,string>;body:unknown;headers:Record<string,string>}
type Props={scenario:string;targetId:string;onNavigate:(route:string)=>void;onRequest:(request:unknown)=>void;onInvalidate:(keys:string[])=>void}
const operation="updateBook"
const storagePrefix='libro-story:S-001:'+operation+':'
const toForm=(item:ApiEntity):FormValue=>({title:item.title,author:item.author,isbn:item.isbn??'',publisher:item.publisher??'',genre:item.genre_name as Genre,media:item.media_type})
function Page({scenario,targetId,onNavigate,onRequest,onInvalidate}:Props){
 const routeEntity=entityFixtures.find(item=>item.book_id===targetId);const selected=routeEntity??entityFixtures[0];const storageKey=storagePrefix+targetId;
 const [status,setStatus]=useState(!routeEntity?'notfound':scenario==='Loading'?'loading':scenario==='Submitting'?'submitting':scenario==='Error'?'error':scenario==='Registered'||scenario==='Saved'||scenario==='Deleted'?'success':scenario==='Conflict'?'conflict':scenario==='Unknown'||scenario==='IdempotencyConflict'?'unknown':scenario==='NumberConflict'?'number-conflict':scenario==='Blocked'?'blocked':'ready');
 const [entity,setEntity]=useState(selected);const [initial,setInitial]=useState<FormValue|undefined>(toForm(selected));const [formKey,setFormKey]=useState(0);
 const [userType,setUserType]=useState('利用者');const [errors,setErrors]=useState<Errors>(scenario==='ValidationError'?{title:'タイトルを入力してください',author:'著者を入力してください'}:{});
 const [message,setMessage]=useState('');const pending=useRef<Request|null>(null);const busy=useRef(false);const alive=useRef(true);
 const savedDraft=useRef<FormValue|undefined>(initial);const requestFor=(body:unknown):Request=>({operation,path:{book_id:entity.book_id},body,headers:{'X-Idempotency-Key':crypto.randomUUID(),'If-Match':String(entity.version)}});
 useEffect(()=>{alive.current=true;onRequest({operation:"getBook",path:{book_id:targetId}});const saved=sessionStorage.getItem(storageKey);if(saved){try{pending.current=JSON.parse(saved);if(pending.current?.body){const restored=toForm({...selected,...pending.current.body as Partial<ApiEntity>});setInitial(restored);savedDraft.current=restored;setFormKey(k=>k+1)}setStatus('unknown')}catch{sessionStorage.removeItem(storageKey)}}else if(['Unknown','IdempotencyConflict'].includes(scenario)){pending.current=requestFor({title:selected.title,author:selected.author,isbn:selected.isbn,publisher:selected.publisher,genre_id:selected.genre_id,media_type:selected.media_type});sessionStorage.setItem(storageKey,JSON.stringify(pending.current))}return()=>{alive.current=false}},[]);
 const settle=async(request:Request,replay=false)=>{if(busy.current)return;busy.current=true;setStatus('submitting');onRequest(request);await new Promise(resolve=>setTimeout(resolve,240));if(!alive.current)return;busy.current=false;
 if(!replay&&scenario==='BusinessRejected'){pending.current=null;sessionStorage.removeItem(storageKey);setStatus('blocked');setMessage("貸出中・予約待ちの書籍は削除できません");return}

 if(!replay&&scenario==='Error'){setStatus('unknown');setMessage('通信が切断されました。保存結果を確認してください。');return}
 if(!replay&&scenario==='Conflict'){pending.current=null;sessionStorage.removeItem(storageKey);setStatus('conflict');return}
 const body=request.body as Partial<ApiEntity>|null;const result={...entity,...(body??{}),version:entity.version+1};setEntity(result);pending.current=null;sessionStorage.removeItem(storageKey);setMessage('');setStatus('success');onInvalidate(["listBooks","searchBooks","getBook"]);onNavigate("/staff/books");
 };
 const confirm=()=>{if(busy.current||pending.current)return;const request=requestFor(null);pending.current=request;sessionStorage.setItem(storageKey,JSON.stringify(request));void settle(request)};
 const submit=(value:FormValue)=>{if(busy.current||pending.current)return;savedDraft.current=value;const next:Errors={};
 if(!value.title.trim()||value.title.length>255)next.title='タイトルを1〜255文字で入力してください';if(!value.author.trim()||value.author.length>255)next.author='著者を1〜255文字で入力してください';if(value.isbn&&!/^(?:[0-9]{9}[0-9X]|[0-9]{13})$/.test(value.isbn))next.isbn='ISBNを10桁または13桁で入力してください';
 setErrors(next);if(Object.keys(next).length)return;
 const genre=genreResponse.items.find(g=>g.genre_name===value.genre);if(!genre){setMessage('ジャンル候補を再取得してください');return}const body={title:value.title,author:value.author,isbn:value.isbn||null,publisher:value.publisher||null,genre_id:genre.genre_id,media_type:value.media};
 const request=requestFor(body);pending.current=request;sessionStorage.setItem(storageKey,JSON.stringify(request));void settle(request);
 };
 const retryRead=async()=>{setStatus('loading');onRequest({operation:"getBook",path:{book_id:targetId}});await new Promise(resolve=>setTimeout(resolve,180));if(alive.current)setStatus('ready')};
 const replay=()=>{if(!pending.current){pending.current=requestFor({title:selected.title,author:selected.author,isbn:selected.isbn,publisher:selected.publisher,genre_id:selected.genre_id,media_type:selected.media_type});sessionStorage.setItem(storageKey,JSON.stringify(pending.current))}void settle(pending.current,true)};
 const latest:ApiEntity={...selected,title:selected.title+'（改訂版）',version:selected.version+1};
 const confirmLatest=()=>{onRequest({operation:"getBook",path:{book_id:targetId}});setEntity(latest);setInitial(savedDraft.current??toForm(entity));setFormKey(k=>k+1);pending.current=null;sessionStorage.removeItem(storageKey);setStatus('ready');setMessage('最新の状態に、確認した内容を適用しました。もう一度確定してください。')};
 return <PortalShell portal="staff" currentPath={'/staff/books/'+encodeURIComponent(targetId)+'/edit'} title="書籍編集画面" userName="青葉 司書" height="100vh"><div className="flex flex-col mx-auto" style={{gap:'var(--section-gap)',maxWidth:'52rem'}}>
 {status==='notfound'?<EmptyState title="対象が見つかりません" action={<Button onClick={()=>onNavigate('/staff/books')}>一覧へ戻る</Button>} />:status==='loading'?<LoadingBlock message="書籍情報を読み込み中です" />:status==='success'?<Alert tone="success" title="保存しました" action={<Button onClick={()=>onNavigate("/staff/books")}>一覧へ戻る</Button>}>書籍一覧を更新しました。</Alert>:<>
 {status==='error'&&<Alert tone="destructive" title="情報を取得できませんでした" action={<Button onClick={()=>void retryRead()}>再取得</Button>}>もう一度お試しください。</Alert>}
 {status==='unknown'&&<Alert tone="warning" title="保存結果を確認してください" action={<Button onClick={replay}>結果確認</Button>}>{scenario==='IdempotencyConflict'?'IDEMPOTENCY_CONFLICT：元の要求の結果を確認してから次の入力に進みます。':'通信切断後の要求を保持しています。同じ内容で結果を確認します。'}</Alert>}
 {status==='number-conflict'&&<Alert tone="destructive" title="VERSION_CONFLICT">利用者番号が競合しました。入力を保持しています。既存の登録結果を一覧で確認してください。<Button variant="outline" onClick={()=>onNavigate('/staff/users')}>一覧で確認</Button></Alert>}
 {status==='conflict'&&<Alert tone="warning" title="更新内容が競合しています" action={<Button onClick={confirmLatest}>最新状態を確認して再操作</Button>}>編集中の値を保持しています。最新値と比較してから編集内容を適用します。<dl><dt>最新の書籍情報</dt><dd>{latest.title}</dd><dt>編集中のタイトル</dt><dd>{(savedDraft.current??toForm(entity)).title}</dd></dl></Alert>}
 {message&&<Alert tone="warning">{message}</Alert>}
 {status!=='error'&&<fieldset disabled={['submitting','unknown','conflict','number-conflict'].includes(status)} className="flex flex-col" style={{gap:'var(--section-gap)'}}><BookForm key={formKey} mode="edit" initial={initial}  errors={errors} submitting={status==='submitting'} onSubmit={submit} onCancel={()=>{if(!busy.current&&!pending.current)onNavigate("/staff/books")}} /></fieldset>}
 </>}
 </div></PortalShell>
}
const meta={id:"pages-staff-update-book",title:"Pages/司書ポータル/書籍編集画面",component:Page,tags:['autodocs'],parameters:{layout:'fullscreen',spec:{uc:"蔵書管理業務/蔵書を管理するフロー/書籍を編集する",route:"/staff/books/:bookId/edit",contract_sha256:"1acd31db0302e644b7bf69e6bc1fc6a98c476f34c747b7733c9d0f5ba6d9d262",operations:["updateBook","listGenres","getBook"]}},args:{targetId:"B-001",scenario:"Default",onNavigate:fn(),onRequest:fn(),onInvalidate:fn()},beforeEach:()=>{Object.keys(sessionStorage).filter(key=>key.startsWith(storagePrefix)).forEach(key=>sessionStorage.removeItem(key))},render:(args)=><Page key={args.scenario+':'+args.targetId} {...args}/>} satisfies Meta<typeof Page>
export default meta
type Story=StoryObj<typeof meta>
export const Default: Story = {args:{scenario:"Default"},play:async({canvasElement,args})=>{const canvas=within(canvasElement);await userEvent.click(canvas.getByRole('button',{name:'保存する'}));await canvas.findByText('保存しました');await expect(args.onRequest).toHaveBeenCalledWith(expect.objectContaining({operation}));}}
export const Loading:Story={args:{scenario:"Loading"}}
export const Error:Story={args:{scenario:"Error"}}
export const Submitting:Story={args:{scenario:"Submitting"}}
export const Saved:Story={args:{scenario:"Saved"}}
export const ValidationError:Story={args:{scenario:"ValidationError"}}
export const Conflict:Story={args:{scenario:"Conflict"}}
export const Unknown: Story = {args:{scenario:"Unknown"},play:async({canvasElement,args})=>{const canvas=within(canvasElement);const snapshot=JSON.parse(sessionStorage.getItem(storagePrefix+args.targetId)!);await userEvent.click(canvas.getByRole('button',{name:'結果確認'}));await waitFor(()=>expect(args.onRequest).toHaveBeenCalledWith(snapshot));await waitFor(()=>expect(sessionStorage.getItem(storagePrefix+args.targetId)).toBeNull());}}

export const DirectLink:Story={args:{scenario:'Default',targetId:'B-002'},play:async({canvasElement,args})=>{const canvas=within(canvasElement);await expect(args.onRequest).toHaveBeenCalledWith({operation:'getBook',path:{book_id:'B-002'}});await canvas.findByDisplayValue('銀河鉄道の夜');await userEvent.click(canvas.getByRole('button',{name:'保存する'}));await canvas.findByText('保存しました');await expect(args.onRequest).toHaveBeenCalledWith(expect.objectContaining({operation,path:{book_id:'B-002'},headers:expect.objectContaining({'If-Match':'5'})}));}}

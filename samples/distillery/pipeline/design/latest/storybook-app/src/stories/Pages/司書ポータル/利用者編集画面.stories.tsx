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
type ApiEntity={ "address": string | null; "email": string; "name": string; "phone": string | null; "registered_at": string; "updated_at": string; "user_number": string; "user_type": "司書" | "利用者"; "version": number }
const fixture: ApiEntity={"user_number":"U-001","name":"山田 花子","email":"reader1@example.com","phone":null,"address":null,"user_type":"利用者","version":2,"updated_at":"2026-09-06T01:00:00Z","registered_at":"2026-09-01T01:00:00Z"}
const entityFixtures:ApiEntity[]=[fixture,{...fixture,user_number:'U-002',name:'青木 太郎',email:'reader2@example.com',version:5}]
type FormValue=UserFormValue
type Errors=UserFormErrors
type Request={operation:string;path:Record<string,string>;body:unknown;headers:Record<string,string>}
type Props={scenario:string;targetId:string;onNavigate:(route:string)=>void;onRequest:(request:unknown)=>void;onInvalidate:(keys:string[])=>void}
const operation="updateUser"
const storagePrefix='libro-story:S-001:'+operation+':'
const toForm=(item:ApiEntity):FormValue=>({name:item.name,email:item.email,phone:item.phone??'',address:item.address??''})
function Page({scenario,targetId,onNavigate,onRequest,onInvalidate}:Props){
 const routeEntity=entityFixtures.find(item=>item.user_number===targetId);const selected=routeEntity??entityFixtures[0];const storageKey=storagePrefix+targetId;
 const [status,setStatus]=useState(!routeEntity?'notfound':scenario==='Loading'?'loading':scenario==='Submitting'?'submitting':scenario==='Error'?'error':scenario==='Registered'||scenario==='Saved'||scenario==='Deleted'?'success':scenario==='Conflict'?'conflict':scenario==='Unknown'||scenario==='IdempotencyConflict'?'unknown':scenario==='NumberConflict'?'number-conflict':scenario==='Blocked'?'blocked':'ready');
 const [entity,setEntity]=useState(selected);const [initial,setInitial]=useState<FormValue|undefined>(toForm(selected));const [formKey,setFormKey]=useState(0);
 const [userType,setUserType]=useState('利用者');const [errors,setErrors]=useState<Errors>(scenario==='ValidationError'?{name:'氏名を入力してください',email:'メールアドレスを確認してください'}:{});
 const [message,setMessage]=useState('');const pending=useRef<Request|null>(null);const busy=useRef(false);const alive=useRef(true);
 const savedDraft=useRef<FormValue|undefined>(initial);const requestFor=(body:unknown):Request=>({operation,path:{user_number:entity.user_number},body,headers:{'X-Idempotency-Key':crypto.randomUUID(),'If-Match':String(entity.version)}});
 useEffect(()=>{alive.current=true;onRequest({operation:"getUser",path:{user_number:targetId}});const saved=sessionStorage.getItem(storageKey);if(saved){try{pending.current=JSON.parse(saved);if(pending.current?.body){const restored=toForm({...selected,...pending.current.body as Partial<ApiEntity>});setInitial(restored);savedDraft.current=restored;const role=(pending.current.body as Partial<ApiEntity>).user_type;if(role)setUserType(role);setFormKey(k=>k+1)}setStatus('unknown')}catch{sessionStorage.removeItem(storageKey)}}else if(['Unknown','IdempotencyConflict'].includes(scenario)){pending.current=requestFor({name:selected.name,email:selected.email,phone:selected.phone,address:selected.address,user_type:selected.user_type});sessionStorage.setItem(storageKey,JSON.stringify(pending.current))}return()=>{alive.current=false}},[]);
 const settle=async(request:Request,replay=false)=>{if(busy.current)return;busy.current=true;setStatus('submitting');onRequest(request);await new Promise(resolve=>setTimeout(resolve,240));if(!alive.current)return;busy.current=false;
 if(!replay&&scenario==='BusinessRejected'){pending.current=null;sessionStorage.removeItem(storageKey);setStatus('blocked');setMessage("有効な貸出または予約が残っている利用者は削除できません");return}

 if(!replay&&scenario==='Error'){setStatus('unknown');setMessage('通信が切断されました。保存結果を確認してください。');return}
 if(!replay&&scenario==='Conflict'){pending.current=null;sessionStorage.removeItem(storageKey);setStatus('conflict');return}
 const body=request.body as Partial<ApiEntity>|null;const result={...entity,...(body??{}),version:entity.version+1};setEntity(result);pending.current=null;sessionStorage.removeItem(storageKey);setMessage('');setStatus('success');onInvalidate(["listUsers","getUser","getUserActivity"]);onNavigate("/staff/users");
 };
 const confirm=()=>{if(busy.current||pending.current)return;const request=requestFor(null);pending.current=request;sessionStorage.setItem(storageKey,JSON.stringify(request));void settle(request)};
 const submit=(value:FormValue)=>{if(busy.current||pending.current)return;savedDraft.current=value;const next:Errors={};
 if(!value.name.trim()||value.name.length>255)next.name='氏名を1〜255文字で入力してください';if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.email))next.email='メールアドレスを確認してください';
 setErrors(next);if(Object.keys(next).length)return;
 const body={name:value.name,email:value.email,phone:value.phone||null,address:value.address||null,user_type:userType};
 const request=requestFor(body);pending.current=request;sessionStorage.setItem(storageKey,JSON.stringify(request));void settle(request);
 };
 const retryRead=async()=>{setStatus('loading');onRequest({operation:"getUser",path:{user_number:targetId}});await new Promise(resolve=>setTimeout(resolve,180));if(alive.current)setStatus('ready')};
 const replay=()=>{if(!pending.current){pending.current=requestFor({name:selected.name,email:selected.email,phone:selected.phone,address:selected.address,user_type:selected.user_type});sessionStorage.setItem(storageKey,JSON.stringify(pending.current))}void settle(pending.current,true)};
 const latest:ApiEntity={...selected,name:'山田 花子',email:'reader.updated@example.com',version:selected.version+1};
 const confirmLatest=()=>{onRequest({operation:"getUser",path:{user_number:targetId}});setEntity(latest);setInitial(savedDraft.current??toForm(entity));setFormKey(k=>k+1);pending.current=null;sessionStorage.removeItem(storageKey);setStatus('ready');setMessage('最新の状態に、確認した内容を適用しました。もう一度確定してください。')};
 return <PortalShell portal="staff" currentPath={'/staff/users/'+encodeURIComponent(targetId)+'/edit'} title="利用者編集画面" userName="青葉 司書" height="100vh"><div className="flex flex-col mx-auto" style={{gap:'var(--section-gap)',maxWidth:'52rem'}}>
 {status==='notfound'?<EmptyState title="対象が見つかりません" action={<Button onClick={()=>onNavigate('/staff/users')}>一覧へ戻る</Button>} />:status==='loading'?<LoadingBlock message="利用者情報を読み込み中です" />:status==='success'?<Alert tone="success" title="保存しました" action={<Button onClick={()=>onNavigate("/staff/users")}>一覧へ戻る</Button>}>利用者一覧を更新しました。</Alert>:<>
 {status==='error'&&<Alert tone="destructive" title="情報を取得できませんでした" action={<Button onClick={()=>void retryRead()}>再取得</Button>}>もう一度お試しください。</Alert>}
 {status==='unknown'&&<Alert tone="warning" title="保存結果を確認してください" action={<Button onClick={replay}>結果確認</Button>}>{scenario==='IdempotencyConflict'?'IDEMPOTENCY_CONFLICT：元の要求の結果を確認してから次の入力に進みます。':'通信切断後の要求を保持しています。同じ内容で結果を確認します。'}</Alert>}
 {status==='number-conflict'&&<Alert tone="destructive" title="VERSION_CONFLICT">利用者番号が競合しました。入力を保持しています。既存の登録結果を一覧で確認してください。<Button variant="outline" onClick={()=>onNavigate('/staff/users')}>一覧で確認</Button></Alert>}
 {status==='conflict'&&<Alert tone="warning" title="更新内容が競合しています" action={<Button onClick={confirmLatest}>最新状態を確認して再操作</Button>}>編集中の値を保持しています。最新値と比較してから編集内容を適用します。<dl><dt>最新の利用者情報</dt><dd>{latest.email}</dd><dt>編集中のメールアドレス</dt><dd>{(savedDraft.current??toForm(entity)).email}</dd></dl></Alert>}
 {message&&<Alert tone="warning">{message}</Alert>}
 {status!=='error'&&<fieldset disabled={['submitting','unknown','conflict','number-conflict'].includes(status)} className="flex flex-col" style={{gap:'var(--section-gap)'}}><Select label="利用者区分" value={userType} onChange={e=>setUserType(e.target.value)} options={[{value:'利用者',label:'利用者'},{value:'司書',label:'司書'}]} /><UserForm key={formKey} mode="edit" initial={initial} userNumber={entity.user_number} errors={errors} submitting={status==='submitting'} onSubmit={submit} onCancel={()=>{if(!busy.current&&!pending.current)onNavigate("/staff/users")}} /></fieldset>}
 </>}
 </div></PortalShell>
}
const meta={id:"pages-staff-update-user",title:"Pages/司書ポータル/利用者編集画面",component:Page,tags:['autodocs'],parameters:{layout:'fullscreen',spec:{uc:"利用者管理業務/利用者を管理するフロー/利用者を編集する",route:"/staff/users/:userId/edit",contract_sha256:"ae4b79648a63e1d7737426203d0a2a00551673078c5d4ffa00151ed8622d8ced",operations:["updateUser","getUser"]}},args:{targetId:"U-001",scenario:"Default",onNavigate:fn(),onRequest:fn(),onInvalidate:fn()},beforeEach:()=>{Object.keys(sessionStorage).filter(key=>key.startsWith(storagePrefix)).forEach(key=>sessionStorage.removeItem(key))},render:(args)=><Page key={args.scenario+':'+args.targetId} {...args}/>} satisfies Meta<typeof Page>
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

export const DirectLink:Story={args:{scenario:'Default',targetId:'U-002'},play:async({canvasElement,args})=>{const canvas=within(canvasElement);await expect(args.onRequest).toHaveBeenCalledWith({operation:'getUser',path:{user_number:'U-002'}});await canvas.findByDisplayValue('青木 太郎');await userEvent.click(canvas.getByRole('button',{name:'保存する'}));await canvas.findByText('保存しました');await expect(args.onRequest).toHaveBeenCalledWith(expect.objectContaining({operation,path:{user_number:'U-002'},headers:expect.objectContaining({'If-Match':'5'})}));}}

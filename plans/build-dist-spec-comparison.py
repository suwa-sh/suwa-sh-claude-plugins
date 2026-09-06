#!/usr/bin/env python3
"""Build an evidence-based, self-contained comparison; standard library only."""
from pathlib import Path
import subprocess, json, html, difflib, re

ROOT = Path(__file__).resolve().parents[1]
OLD = 'tests/fixtures/distillery/legacy-pipeline/specs/latest/'
NEW = 'tests/fixtures/distillery/spec-ready/'
UC = '蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/'
REV = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
# Regenerate from editable inputs in an isolated directory, and compare every derived file.
probe = r'''
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const {run,compile}=require('./plugins/distillery/skills/dist-spec/scripts/compileContracts');
const {build}=require('./plugins/distillery/skills/dist-spec/scripts/buildSpecViews');
const source='tests/fixtures/distillery/spec-ready',temp=fs.mkdtempSync(path.join(os.tmpdir(),'dist-compare-'));
try {
 fs.cpSync(source,temp,{recursive:true});
 const catalog=JSON.parse(fs.readFileSync(path.join(temp,'_cross-cutting/api/contracts.json')));
 const derived=[...compile(catalog).keys()];
 for(const file of derived)fs.rmSync(path.join(temp,file),{force:true});
 run(temp);
 const views=build(temp,path.join(temp,'_inputs/rdra'));
 for(const[file,body]of views){fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});fs.writeFileSync(path.join(temp,file),body);}
 const hashes={};
 for(const file of [...derived,...views.keys()]){
  const actual=fs.readFileSync(path.join(temp,file));
  if(!actual.equals(fs.readFileSync(path.join(source,file))))throw Error('Mismatch: '+file);
  hashes[file]=crypto.createHash('sha256').update(actual).digest('hex');
 }
 // A source edit must reach its generated native document, slice and summary hash.
 const edited=JSON.parse(JSON.stringify(catalog));
 edited.openapi.components.schemas.CreateLoanRequest.description='isolated propagation probe';
 const before=compile(catalog),after=compile(edited);
 const changed=[...after].filter(([f,b])=>before.get(f)!==b).map(([f])=>f);
 if(!changed.some(f=>f.endsWith('openapi.yaml'))||!changed.some(f=>f.endsWith('_contract-slice.json'))||!changed.some(f=>f.endsWith('_api-summary.yaml')))throw Error('Propagation incomplete');
 console.log(JSON.stringify({status:'pass',regenerated_files:Object.keys(hashes).length,hashes,isolated_description_edit_changed:changed}));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
'''
RESULT = json.loads(subprocess.check_output(['node', '-e', probe], cwd=ROOT, text=True))

def read(file): return (ROOT / file).read_text()
def gh(file, line=None):
    from urllib.parse import quote
    return 'https://github.com/suwa-sh/suwa-sh-claude-plugins/blob/'+REV+'/'+quote(file,safe='/')+(f'#L{line}' if line else '')
def section(file, heading):
    lines=read(file).splitlines(); start=lines.index(heading); level=len(heading)-len(heading.lstrip('#'))
    end=next((i for i in range(start+1,len(lines)) if re.match(r'^#{1,'+str(level)+r'} ',lines[i])),len(lines))
    return file,start+1,'\n'.join(lines[start:end]).strip()
def whole(file): return file,1,read(file).strip()
def fragment(file, prefix, needle, limit=35):
    lines=read(file).splitlines();start=next(i for i,x in enumerate(lines) if prefix in x)
    end=min(len(lines),start+limit)
    assert needle in '\n'.join(lines[start:end]), needle
    return file,start+1,'\n'.join(lines[start:end])

def panel(item,label):
    file,line,body=item
    return f'<div class="panel"><h4>{label}</h4><p class="path"><a href="{gh(file,line)}">{html.escape(file.split(UC)[-1] if UC in file else file.replace(NEW, ""))} · L{line}</a></p><pre>{html.escape(body)}</pre></div>'

cases = [
 ('api','APIの型表','重複を削除・機械生成へ',
  '現行はBackendのリクエスト/レスポンス表、UC summaryのschemas、統合OpenAPIに同じ型が現れる。修正版は本文の型表とsummaryのschemasをなくし、contracts.json内のnative OpenAPIを編集元にする。',
  section(OLD+UC+'tier-backend-api.md','#### リクエスト'), section(NEW+UC+'tier-backend-api.md','#### 入出力の正本'),
  NEW+'_cross-cutting/api/contracts.json', 'openapi.components.schemas.CreateLoanRequest / LoanResponse。compilerがopenapi.yamlとUC sliceを生成。',
  fragment(NEW+'_cross-cutting/api/contracts.json','"CreateLoanRequest":','"required"',27)),
 ('summary','summaryは型定義から索引へ','重複を削除・機械生成へ',
  '現行のschemas欄を削除。修正版はoperationの所有者・参照・sliceのhashを保持する。型はsliceに完全な形で含むため、入力の必須項目や制約を捨てたわけではない。',
  fragment(OLD+UC+'_api-summary.yaml','schemas:','CreateLoanRequest',41),whole(NEW+UC+'_api-summary.yaml'),
  NEW+'_cross-cutting/api/contracts.json','use_casesでprovides/consumesを宣言する。summary v2とsliceは直接編集せず再生成する。',None),
 ('rules','業務ルールと通常の処理フロー','重複を削除・参照へ',
  '現行の通常レイヤー往復図とBackendでの規則の再説明を整理。許可条件・期間の計算表をspec.mdのRULE-001〜004に置き、Backendは適用箇所と共有の実行順序へ接続する。障害時の順序まで削除してはいない。',
  section(OLD+UC+'tier-backend-api.md','## ビジネスルール'),section(NEW+UC+'tier-backend-api.md','## データアクセス・実行条件'),
  NEW+UC+'spec.md','業務ルール節が許可条件と計算の正本。画面・API・BDDは規則を利用/確認する側。',
  section(NEW+UC+'spec.md','## 業務ルール')),
 ('db','DBの列説明と更新値','重複を削除・責務を分割',
  '現行Backendのloans/books/users/reservationsの型表を削除。もともと存在する共有DB定義へ型を寄せ、どの列に何を書くかは_model-summary.yamlで管理する。追加した成功記録などによりmodel summary自体は増えている。',
  section(OLD+UC+'tier-backend-api.md','### loans（E-004 貸出）'),section(NEW+UC+'tier-backend-api.md','## データアクセス・実行条件'),
  NEW+UC+'_model-summary.yaml','tables[].operationsは更新列・値・WHERE。型・制約は共有rdb-schema.yaml、取引順序はloan-commit.md。',
  fragment(NEW+UC+'_model-summary.yaml','tables:','book_title',35)),
 ('ui','共通UIのトークンとProps説明','既存の共有定義へ参照',
  '共通UIは現行にも存在した。今回新しく作った一元管理ではなく、UCに再掲していた色/余白の表と細かな共通Props表を減らした。画面固有の表示・所有権・操作状態はUC本文に残す。',
  section(OLD+UC+'tier-frontend-staff.md','#### デザイントークン参照'),section(NEW+UC+'tier-frontend-staff.md','## 変更概要・画面仕様'),
  NEW+'_cross-cutting/ux-ui/common-components.md','共通コンポーネントの契約。色・余白・日付表示等は同じディレクトリのui-design.md。',None),
 ('state','ページとFormの所有権・再取得','重複整理と不整合修正',
  '現行にはキーの保持者と成功時のキャッシュ対象について複数の記載があり、不一致があった。修正版はページを唯一のキー所有者とし、成功後の無効化を情報別prefixの一表にした。これは削除だけでなく挙動の具体化。',
  section(OLD+UC+'tier-frontend-staff.md','### LoanRegistrationForm'),section(NEW+UC+'tier-frontend-staff.md','## 所有権と受け渡し'),
  NEW+UC+'tier-frontend-staff.md','所有権、操作の状態遷移、成功後の再取得の各節。共通Buttonはキーを持たない。',
  section(NEW+UC+'tier-frontend-staff.md','## 成功後の再取得')),
 ('recovery','冪等性と障害回復','不足の補完・設計変更',
  '現行のKVSに処理結果を保存する規則を、貸出と成功応答を同じDB取引で保存する規則に変更した。24時間TTLから期限なし保持への変更を含む。削減効果として数えるべき変更ではない。',
  section(OLD+UC+'tier-backend-api.md','#### 冪等キーの判定規則'),section(NEW+'_cross-cutting/datastore/loan-commit.md','## 採用した設計判断'),
  NEW+'_cross-cutting/datastore/loan-commit.md','排他・commit・応答紛失・再送・保存期間の正本。DB列型はrdb-schema.yaml、画面の応答別動作はFrontendに置く。',None)
]

rows=[]
for name in ['spec.md','tier-backend-api.md','tier-frontend-staff.md','_api-summary.yaml','_model-summary.yaml']:
    a=len(read(OLD+UC+name).splitlines());b=len(read(NEW+UC+name).splitlines());rows.append((name,a,b,b-a))
shared=len(read(NEW+'_cross-cutting/datastore/loan-commit.md').splitlines())
css='''*{box-sizing:border-box}body{margin:0;background:#F4F1EA;color:#1A1A1A;font:16px/1.85 Inter,"Noto Sans JP","Hiragino Kaku Gothic ProN",sans-serif}main{max-width:1280px;margin:auto;padding:40px}h1{font-size:36px;line-height:1.5}h2{font-size:28px}h3{font-size:20px}h4{margin:0 0 8px}a{color:#245DB8;text-underline-offset:4px;overflow-wrap:anywhere}a:focus-visible,summary:focus-visible{outline:3px solid #245DB8;outline-offset:4px}.meta,.path{font-size:12px;color:#5C594F}.lead{font-size:20px;max-width:960px}.notice{border-left:4px solid #245DB8;background:white;padding:16px 24px}.table{overflow:auto}table{border-collapse:collapse;width:100%;min-width:650px}td,th{border-bottom:1px solid #CFC9BC;padding:12px;text-align:left;vertical-align:top}th{background:#EAE5DA}section{margin-top:56px;padding-top:24px;border-top:1px solid #CFC9BC;scroll-margin-top:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}.panel{min-width:0;background:white;border:1px solid #CFC9BC;padding:20px}pre{margin-bottom:0;white-space:pre;overflow:auto;max-height:440px;font:13px/1.75 ui-monospace,monospace;background:#F7F5F0;padding:12px}code{font: .9em ui-monospace,monospace}.panel pre{white-space:pre-wrap;overflow-wrap:anywhere}.owner{padding:16px 20px;background:#E9EFF8;margin:20px 0}.kind{color:#245DB8;font-size:12px;font-weight:700}details{background:white;border:1px solid #CFC9BC;padding:16px;margin:20px 0}summary{cursor:pointer;font-weight:600}.diff span{display:block;min-height:1.75em}.del{background:#FBEAE7}.add{background:#E5F0E6}.nav{display:flex;flex-wrap:wrap;gap:12px 24px;list-style:none;padding:0}.back{display:inline-block;margin-top:16px}@media(max-width:800px){main{padding:24px 16px}.pair{grid-template-columns:1fr}h1{font-size:28px}h2{font-size:24px}.panel{padding:16px}}'''
parts=[f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>dist-spec 現行と修正版の比較</title><style>{css}</style></head><body><main><header><p class="meta">DIST-SPEC / BEFORE & AFTER · 仕様 {REV[:7]}</p><h1>何を削り、どこへ集約したか。</h1><p class="lead">貸出登録の現行出力と修正版を、実ファイルの記載で比較します。各項目の「管理先」を見れば、仕様変更時にどこを編集すればよいか分かります。</p><div class="notice"><strong>比較の出所</strong><br>現行：legacy-pipelineのdist-pipeline出力。修正版：spec-readyの編集済み本文と、実装済みcompilerから今回再生成した契約・索引。<br>本文全体を新しいdist-pipelineで自動生成し直した比較ではありません。機械生成部分は別ディレクトリで再生成し、{RESULT['regenerated_files']}ファイルの一致を確認しました。</div></header><section id="index"><h2>先に結論</h2><p>人が同じ仕様を何度も編集する箇所を減らしています。派生ファイルには型が残るため、ファイル数や保存容量が必ず減る仕組みではありません。</p><ul class="nav">''']
parts += [f'<li><a href="#{id}">{title}</a></li>' for id,title,*_ in cases]
parts += ['<li><a href="#numbers">行数と比較範囲</a></li><li><a href="#diffs">全文差分</a></li></ul><div class="table"><table><tr><th>情報</th><th>人が編集する場所</th><th>読む側 / 生成先</th></tr>']
for label,owner,consumer in [('API型・制約','contracts.json → openapi内のschemas/paths','compiler → OpenAPI / UC slice / summary'),('業務条件・期限計算','UC/spec.mdのRULE-001〜004','Backend・Frontendは参照、BDDで確認'),('DBの型・制約','共有datastore/rdb-schema.yaml','UCのモデル操作から参照'),('DBの更新値・WHERE','UC/_model-summary.yaml','Backendから参照'),('共通UI','共有ux-ui/ui-design.md / common-components.md','UCには画面固有の表示・動作だけ'),('画面の状態・再取得','UC/tier-frontend-staff.md','Form・Button・API clientへの責務分担'),('commit・再送','共有datastore/loan-commit.md','API処理と画面の再送動作を接続')]:
    parts.append(f'<tr><td>{label}</td><td>{owner}</td><td>{consumer}</td></tr>')
parts.append('</table></div></section>')
for id,title,kind,explanation,before,after,owner,ownership,extra in cases:
    parts.append(f'<section id="{id}"><p class="kind">{kind}</p><h2>{title}</h2><p>{explanation}</p><div class="pair">{panel(before,"現行の実記載")}{panel(after,"修正版の実記載")}</div><div class="owner"><strong>編集する場所：</strong><a href="{gh(owner)}">{html.escape(owner.replace(NEW,""))}</a><br>{ownership}</div>')
    if extra:parts.append('<details><summary>移動先・管理先の実記載を開く</summary>'+panel(extra,'正本 / 参照先')+'</details>')
    parts.append('<a class="back" href="#index">一覧へ戻る ↑</a></section>')
parts.append('<section id="numbers"><h2>削減した本文と、増えた情報を分ける</h2><div class="table"><table><tr><th>比較対象</th><th>現行（行）</th><th>修正版（行）</th><th>増減</th></tr>')
for name,a,b,d in rows:parts.append(f'<tr><td>{name}</td><td>{a}</td><td>{b}</td><td>{d:+}</td></tr>')
a=sum(x[1] for x in rows[:3]);b=sum(x[2] for x in rows[:3]);parts.append(f'<tr><th>本文3ファイル合計</th><td>{a}</td><td>{b}</td><td>{b-a:+}（{(a-b)/a:.1%}減）</td></tr><tr><td>追加の共有障害回復規則</td><td>独立ファイルなし</td><td>{shared}</td><td>不足補完・設計変更を含む</td></tr><tr><td>UC用_contract-slice.json</td><td>なし</td><td>{len(read(NEW+UC+"_contract-slice.json").splitlines())}</td><td>機械生成の追加</td></tr></table></div><p>本文と追加の共有規則を合わせると{b+shared}行。ただしこれはイベント全体の総量ではありません。共有UI・参照用3UC・契約生成物を含めた削減率は示していません。現行の統合契約は全41UC、修正版は4操作なので、そのファイルサイズを削減効果として比較するのも不適切です。</p></section>')
parts.append('<section><h2>一元管理の効果をどう確認したか</h2><p>一時ディレクトリから生成ファイルを消し、contracts.jsonを入力にcompilerを実行。BUCとトレーサビリティも再生成し、チェックイン済みの生成物とバイト単位で一致しました。</p><p>さらに一時的にCreateLoanRequestのdescriptionだけを変更し、OpenAPI・貸出登録のslice・summaryのhashに自動反映されることを確認しました。この試験変更はサンプルに保存していません。</p><details><summary>再生成・反映試験の結果とhash</summary><pre>'+html.escape(json.dumps(RESULT,ensure_ascii=False,indent=2))+'</pre></details><h3>まだ残る重複</h3><p>Backendの認証説明と契約側の共通認証説明、エラー表の説明など、一部は複数箇所に残っています。現行サンプルの一元管理が全項目で完了したとは言えません。また、業務規則の表とBDDの期待値の再登場は、定義と検証の役割が異なるため単純には削除していません。</p><p>非同期workerを含む他の代表UCに同じ整理を適用する確認と、本文を含む自動生成結果の比較は、今回の機械生成部分の比較とは別の残作業です。</p></section>')
parts.append('<section id="diffs"><h2>本文3ファイルの全文差分</h2><p>「−」が現行からの削除、「＋」が修正版への追加です。設計変更・BDD修正・参照パス変更も含む生の差分です。</p>')
for name,*_ in rows[:3]:
    diff=difflib.unified_diff(read(OLD+UC+name).splitlines(),read(NEW+UC+name).splitlines(),fromfile='現行/'+name,tofile='修正版/'+name,lineterm='')
    text=''.join('<span class="'+('add' if x.startswith('+') else 'del' if x.startswith('-') else '')+'">'+html.escape(x)+'</span>' for x in diff)
    parts.append(f'<details><summary>{name}の全文差分</summary><pre class="diff">{text}</pre></details>')
parts.append('</section><footer><p class="meta">生成元：plans/build-dist-spec-comparison.py。引用は実ファイルから抽出。生成再現性は実行時に検証。</p></footer></main></body></html>')
(ROOT/'plans/dist-spec-output-comparison.html').write_text(''.join(parts))
(ROOT/'plans/dist-spec-output-comparison-evidence.json').write_text(json.dumps({'revision':REV,'old_root':OLD,'new_root':NEW,'counts':rows,'regeneration':RESULT},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'html':'plans/dist-spec-output-comparison.html','bytes':(ROOT/'plans/dist-spec-output-comparison.html').stat().st_size,'regenerated_files':RESULT['regenerated_files'],'counts':rows},ensure_ascii=False))

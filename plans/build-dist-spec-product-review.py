from pathlib import Path
import html,json,re,subprocess,os,difflib
from urllib.parse import unquote
root=Path(__file__).resolve().parents[1]
sample=root/'samples/distillery/spec-latest-linked';event=sample/'docs/specs/events/20260906_122355_spec_generation';old=sample/'docs/specs/events/20260906_120000_spec_generation';uc=Path('蔵書利用業務/書籍を貸し出すフロー/貸出を登録する')
marked=os.environ.get('MARKED_MODULE') or str(next((Path.home()/'.npm/_npx').glob('*/node_modules/marked/lib/marked.cjs')))
def render(p):
 if p.suffix!='.md':return '<pre>'+html.escape(p.read_text())+'</pre>'
 return subprocess.run(['node','-e',"const fs=require('fs');process.stdout.write(require(process.argv[1]).parse(fs.readFileSync(0,'utf8')))",marked],input=p.read_text(),text=True,capture_output=True,check=True).stdout
product=[event/uc/n for n in ['spec.md','tier-backend-api.md','tier-frontend-staff.md']]
management=[p for p in sorted(event.rglob('*')) if p.is_file() and (p.name=='README.md' and p.parent==event or 'feedback-requests' in p.parts or '_review' in p.parts) and p.suffix in ['.md','.json','.yaml']]
others=[event/uc/'_model-summary.yaml',event/uc/'_api-summary.yaml']+list((event/'_cross-cutting/api').rglob('*.yaml'))
files=list(dict.fromkeys(product+management+others)); references=[]
for p in list(files):
 if p.suffix=='.md':
  for link in re.findall(r'\]\(([^)]+)\)',p.read_text()):
   q=(p.parent/link.split('#')[0]).resolve()
   if q.is_file() and sample in q.parents and q not in files:files.append(q);references.append(q)
ids={p.resolve():f'f{i}' for i,p in enumerate(files)}
def section(p,opened=False):
 body=render(p)
 headings={}
 def heading(m):
  text=html.unescape(re.sub('<[^>]+>','',m.group(2)))
  slug=re.sub(r'[^\w\s-]','',text.lower()).replace(' ','-')
  anchor=ids[p.resolve()]+'-h'+str(len(headings))
  headings[slug]=anchor
  return '<h'+m.group(1)+' id="'+anchor+'">'+m.group(2)+'</h'+m.group(1)+'>'
 body=re.sub(r'<h([1-6])>(.*?)</h\1>',heading,body)
 body=re.sub(r'href="#([^"]+)"',lambda m:'href="#'+headings.get(unquote(m.group(1)),ids[p.resolve()])+'"',body)
 def link(m):
  target=(p.parent/m.group(1).split('#')[0]).resolve()
  if target in ids:return 'href="#'+ids[target]+'" onclick="document.getElementById(\''+ids[target]+'\').open=true"'
  return 'title="'+html.escape(m.group(1))+'"'
 body=re.sub(r'href="([^"#][^"]*)"',link,body)
 if p==product[0]:
  counter=[0]
  def diagram(m):
   i=counter[0];counter[0]+=1;svg=root/f'plans/dist-spec-product-diagrams/{i}.svg'
   return '<div class="diagram">'+svg.read_text()+'</div><details><summary>図のソース</summary>'+m.group(0)+'</details>' if svg.exists() else m.group(0)
  body=re.sub(r'<pre><code class="language-mermaid">.*?</code></pre>',diagram,body,flags=re.S)
 return '<details id="'+ids[p.resolve()]+'"'+(' open' if opened else '')+'><summary>'+html.escape(str(p.relative_to(sample)))+'</summary><article>'+body+'</article></details>'
old_intro=re.search(r'## 概要\n(.*?)(?=\n## )',(old/uc/'spec.md').read_text(),re.S).group(1).strip()
new_intro=re.search(r'## 概要\n(.*?)(?=\n## )',product[0].read_text(),re.S).group(1).strip()
diffs=[]
for p in product:
 text=''.join(difflib.unified_diff((old/uc/p.name).read_text().splitlines(True),p.read_text().splitlines(True),fromfile='前回/'+p.name,tofile='今回/'+p.name))
 diffs.append('<details><summary>'+p.name+' の全文差分</summary><pre>'+html.escape(text)+'</pre></details>')
page='''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>実装対象を説明するspec</title><style>*{box-sizing:border-box}body{margin:0;background:#F4F1EA;color:#1A1A1A;font:16px/1.8 Inter,"Noto Sans JP",sans-serif}main{max-width:1200px;padding:48px 24px;margin:auto}h1{font-size:36px;line-height:1.4}h2{margin-top:48px;font-size:24px}h3{font-size:20px}a{color:#245DB8}p{max-width:940px}nav{display:flex;gap:24px;flex-wrap:wrap;padding:12px 0;border-block:1px solid #CFC9BC}.notice{padding:16px 20px;background:#fff;border-left:4px solid #3B82F6}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:12px;text-align:left;border-bottom:1px solid #CFC9BC;vertical-align:top}th{background:#ECE8DE}details{border:1px solid #CFC9BC;border-radius:4px;background:#fff;margin:16px 0}summary{padding:16px;cursor:pointer;overflow-wrap:anywhere}article{padding:8px 24px 24px}pre{background:#ECE8DE;padding:20px;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 ui-monospace,monospace}code{overflow-wrap:anywhere}.diagram{overflow-x:auto}.diagram svg{width:100%;height:auto;min-width:760px}details:target{outline:3px solid #3B82F6}.compare{display:grid;grid-template-columns:1fr 1fr;gap:20px}.compare pre{margin:0}footer{border-top:1px solid #CFC9BC;margin-top:40px;color:#5C594F}@media(max-width:640px){main{padding:24px 16px}h1{font-size:28px}article{padding:8px 12px}.compare{grid-template-columns:1fr}table{display:block;overflow-x:auto}}</style><main><p>DISTILLERY / 仕様本文の見直し</p><h1>ユースケースの仕様を読み、<br>提案の採用状況は別に確認する</h1><nav><a href="#overview">概要の比較</a><a href="#product">仕様本文</a><a href="#management">提案と整合確認</a><a href="#refs">契約と参照元</a><a href="#diff">全文差分</a></nav><p>spec本文を、具体的な変更案が採用された場合の実装対象に書き換えました。生成ルールと進捗を本文から移し、tierでは条件、処理、結果、値の所有者を表やリストで接続しています。</p><p class="notice"><b>このページの採用状況</b><br>7件の変更案は提案段階です。実際のRDRA、arch、designのlatestは変更していません。本文は採用後の姿を示し、現在との相違は下の管理記録にまとめています。未採用のためspecs/latestへの昇格は行っていません。</p><h2 id="overview">概要の比較</h2><div class="compare"><div><h3>前回</h3><pre>'''+html.escape(old_intro)+'''</pre></div><div><h3>今回</h3><pre>'''+html.escape(new_intro)+'''</pre></div></div><h2>記載先の分担</h2><table><tr><th>情報</th><th>記載先</th></tr><tr><td>アクター、契機、達成する結果、分岐</td><td>spec.md</td></tr><tr><td>入力の接続、処理順序、条件と結果、状態の所有者</td><td>tier仕様の表とリスト</td></tr><tr><td>現在の正本との差、具体案、完了条件</td><td>還流リクエスト</td></tr><tr><td>提案と本文の対応、未採用の状況、照合結果</td><td>proposal-baselineとレビュー記録</td></tr></table><h2 id="product">仕様本文</h2><p>以下の本文には、スキルの手順や採用待ちの注記を含めていません。リンク先の現在のlatestは、提案が未反映のものとして末尾に収録しています。</p>'''+''.join(section(p,p==product[0]) for p in product)+'''<h2 id="management">提案と整合確認</h2><table><tr><th>上流の結果</th><th>spec工程の処理</th></tr><tr><td>提案どおり採用</td><td>最新の内容と分岐、契約、BDDを照合し、本文を維持</td></tr><tr><td>別案を採用</td><td>結果が変わる箇所だけ修正</td></tr><tr><td>未採用または一部採用</td><td>不一致をレビューへ記録し、昇格を保留</td></tr></table><p>採用時の照合例は、1件の変更案を隔離した一時コピーへ反映した検証です。実際の上流が採用済みになった記録とは区別しています。</p>'''+''.join(section(p) for p in management)+'''<h2 id="refs">契約と現在の参照元</h2>'''+''.join(section(p) for p in others+references)+'''<h2 id="diff">前回からの全文差分</h2>'''+''.join(diffs)+'''<footer><p>入力と過去イベントは維持。新イベント: 20260906_122355_spec_generation</p></footer></main></html>'''
(root/'plans/dist-spec-product-review.html').write_text(page)
print(len(page.encode()),'bytes')

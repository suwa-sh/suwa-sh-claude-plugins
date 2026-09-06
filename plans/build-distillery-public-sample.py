"""Build a self-contained reader from the published pipeline sample."""
from pathlib import Path
from urllib.parse import quote, unquote
import argparse
import hashlib
import html
import json
import os
import re
import subprocess

repo = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--sample-root', type=Path, default=repo/'samples/distillery/pipeline')
parser.add_argument('--diagrams', type=Path)
parser.add_argument('--output', type=Path, default=repo/'plans/distillery-public-sample.html')
args = parser.parse_args()
sample = args.sample_root.resolve()
spec = sample/'specs/latest'
catalog = json.loads((spec/'_cross-cutting/api/contracts.json').read_text())
marked = os.environ.get('MARKED_MODULE') or str(next((Path.home()/'.npm/_npx').glob('*/node_modules/marked/lib/marked.cjs')))
branch = subprocess.check_output(['git', 'branch', '--show-current'], cwd=repo, text=True).strip()
base_url = 'https://github.com/suwa-sh/suwa-sh-claude-plugins/blob/'+quote(branch, safe='')+'/samples/distillery/pipeline/'
diagram_cache = {}
if args.diagrams:
    for index, item in enumerate(json.loads((args.diagrams/'inventory.json').read_text()), 1):
        image = args.diagrams/f'rendered-{index}.svg'
        if image.exists():
            diagram_cache[(item['file'], item['index'], item['sha256'])] = image.read_text()

groups = []
for uc in catalog['use_cases']:
    directory = spec/uc['business']/uc['buc']/uc['uc']
    files = [directory/'spec.md']+sorted(directory.glob('tier-*.md'))
    groups.append({'name': uc['uc'], 'business': uc['business'], 'files': files})
shared = [spec/p for p in [
    '_cross-cutting/technical-rules.md',
    '_cross-cutting/ux-ui/ui-design.md',
    '_cross-cutting/ux-ui/common-components.md',
    '_cross-cutting/api/openapi/openapi.yaml',
    '_cross-cutting/api/asyncapi/asyncapi.yaml',
    '_cross-cutting/datastore/rdb-schema.yaml',
    '_cross-cutting/datastore/datastore-schema.md',
    '_cross-cutting/datastore/generated/table-index.yaml',
    '_review/proposal-baseline.md',
]]
shared += sorted((spec/'feedback-requests').glob('*.md'))
event_id = re.search(r'^event_id:\s*[\"\']?([^\s\"\']+)', (spec/'spec-event.yaml').read_text(), re.M)
if event_id:
    shared += [sample/'specs/events'/event_id[1]/'_review/proposal-baseline.md']
shared += [sample/'pipeline/README.md']
groups.append({'name': '共通定義と実行記録', 'business': '共通', 'files': [p for p in shared if p.exists()]})
all_files = list(dict.fromkeys(p for g in groups for p in g['files']))
file_ids = {p.resolve(): str(i) for i, p in enumerate(all_files)}
contents = {}
svg_counter = 0

def render(path):
    global svg_counter
    text = path.read_text()
    if path.suffix != '.md':
        return '<pre>'+html.escape(text)+'</pre>'
    svgs = {}
    def replace_diagram(match):
        global svg_counter
        source = match.group(1)
        key = (str(path.relative_to(spec)), len(svgs), hashlib.sha256(source.encode()).hexdigest())
        token = 'DIAGRAMTOKEN'+str(svg_counter)
        image = diagram_cache.get(key)
        if image:
            prefix = 'chart'+str(svg_counter)+'-'
            for old in sorted(set(re.findall(r'\bid="([^"]+)"', image)), key=len, reverse=True):
                image = image.replace('id="'+old+'"', 'id="'+prefix+old+'"')
                image = re.sub('#'+re.escape(old)+r'(?=[\s"\);,.{:\]])', '#'+prefix+old, image)
            svgs[token] = '<div class="diagram">'+image+'</div><details><summary>図のソース</summary><pre>'+html.escape(source)+'</pre></details>'
        else:
            svgs[token] = '<pre>'+html.escape(source)+'</pre>'
        svg_counter += 1
        return '\n\n'+token+'\n\n'
    text = re.sub(r'```mermaid\s*\n(.*?)```', replace_diagram, text, flags=re.S)
    script = """const fs=require('fs'),m=require(process.argv[1]);
m.use({renderer:{html(token){const t=typeof token==='string'?token:token.text;return /^<a id=\"[A-Za-z0-9_-]+\"><\\/a>\\s*$/.test(t)?t:'';}}});
process.stdout.write(m.parse(fs.readFileSync(0,'utf8')));"""
    body = subprocess.run(['node', '-e', script, marked], input=text, text=True, capture_output=True, check=True).stdout
    def heading(match):
        label = html.unescape(re.sub('<[^>]+>', '', match.group(2)))
        slug = re.sub(r'[^\w\s-]', '', label.lower()).replace(' ', '-')
        return '<h'+match.group(1)+' id="'+html.escape(slug, quote=True)+'">'+match.group(2)+'</h'+match.group(1)+'>'
    body = re.sub(r'<h([1-6])>(.*?)</h\1>', heading, body)
    for token, svg in svgs.items():
        body = body.replace('<p>'+token+'</p>', svg)
    def link(match):
        ref = html.unescape(match.group(1))
        if '://' in ref or ref.startswith('mailto:'):
            return match.group(0)
        part, _, anchor = ref.partition('#')
        target = (path.parent/unquote(part)).resolve() if part else path.resolve()
        if target in file_ids:
            return 'href="#file-'+file_ids[target]+'" data-file="'+file_ids[target]+'" data-anchor="'+html.escape(unquote(anchor), quote=True)+'"'
        try:
            relative = target.relative_to(sample)
            return 'href="'+base_url+quote(str(relative), safe='/')+('#'+quote(anchor) if anchor else '')+'" target="_blank" rel="noopener"'
        except ValueError:
            return 'title="'+html.escape(ref, quote=True)+'"'
    body = re.sub(r'href="([^"]+)"', link, body)
    return body

for path in all_files:
    contents[file_ids[path.resolve()]] = {
        'name': path.name, 'path': str(path.relative_to(sample)),
        'html': render(path), 'url': base_url+quote(str(path.relative_to(sample)), safe='/')}
navigation = [{'name': g['name'], 'business': g['business'], 'files': [file_ids[p.resolve()] for p in g['files']]} for g in groups]
http_count = sum(op['kind']=='openapi' for uc in catalog['use_cases'] for op in uc['provides'])
async_count = sum(op['kind']=='asyncapi' for uc in catalog['use_cases'] for op in uc['provides'])
data = json.dumps({'groups': navigation, 'files': contents}, ensure_ascii=False).replace('<', '\\u003c')
page = '''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>図書館管理システムの公開仕様</title>
<style>*{box-sizing:border-box}body{margin:0;background:#F4F1EA;color:#1A1A1A;font:16px/1.75 Inter,"Noto Sans JP",sans-serif}a{color:#245DB8}header{max-width:1320px;margin:auto;padding:40px 28px 24px}h1{font-size:32px;line-height:1.4;margin:8px 0 20px}h2{font-size:24px;margin-top:32px}h3{font-size:19px}p{max-width:950px}.meta{color:#5C594F;font-size:14px}.metrics{display:flex;gap:24px;flex-wrap:wrap;border-block:1px solid #CFC9BC;padding:14px 0}.layout{max-width:1320px;margin:auto;display:grid;grid-template-columns:270px minmax(0,1fr);gap:28px;padding:0 28px 48px}aside{align-self:start;position:sticky;top:12px;max-height:94vh;overflow:auto}button,select{font:inherit}button{cursor:pointer;border:1px solid #CFC9BC;background:transparent;border-radius:4px;padding:8px 12px;color:inherit;text-align:left}button:hover,button[aria-current=true]{background:#fff;border-color:#3B82F6}aside button{width:100%;display:block;margin-bottom:5px;font-size:14px}aside h2{font-size:14px;color:#5C594F;margin:22px 0 8px}#tabs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}#content{background:#fff;border:1px solid #CFC9BC;padding:24px;overflow-wrap:anywhere}#content h1{font-size:28px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:10px;text-align:left;vertical-align:top;border-bottom:1px solid #CFC9BC}th{background:#ECE8DE}pre{background:#ECE8DE;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.65 ui-monospace,monospace}code{overflow-wrap:anywhere}.diagram{overflow-x:auto;margin:20px 0}.diagram svg{max-width:none!important;width:100%;height:auto;min-width:680px}details{margin:16px 0;border:1px solid #CFC9BC;padding:12px}summary{cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #3B82F6;outline-offset:2px}@media(max-width:760px){header{padding:24px 16px}h1{font-size:26px}.layout{display:block;padding:0 16px 32px}aside{position:static;max-height:260px;border-block:1px solid #CFC9BC;margin-bottom:20px}#content{padding:14px}table{display:block;overflow-x:auto}.diagram svg{min-width:640px}}</style>
<header><p class="meta">DISTILLERY / 公開pipelineサンプル</p><h1>図書館管理システムの仕様を読む</h1><p>ユースケースは「利用者が何を達成するか」の単位です。各UCの仕様から、処理の分岐と受入条件を確認し、tier仕様で画面やAPIへの接続を確認できます。</p><div class="metrics">COUNTS</div><details><summary>記載先の分担と今回の生成範囲</summary><table><tr><th>確認したいこと</th><th>正本</th></tr><tr><td>業務条件と状態遷移</td><td>RDRA latest（業務要件のモデル）</td></tr><tr><td>APIの型と制約</td><td>分割OpenAPI / AsyncAPI。全体はbundleで参照</td></tr><tr><td>DBの列と所有先</td><td>サブドメインごとの分割RDB schema</td></tr><tr><td>UI部品のPropsとトークン</td><td>design latestのStorybook</td></tr><tr><td>共通の再送、取引、画面の回復</td><td>共通定義。UCには操作固有の接続と分岐</td></tr></table><p>Fable版のdesign完了状態を再構成し、改訂したdist-specと後続工程を実行した1本です。初期Storybookの過去スナップショットがないため、初期の部品一覧から後段の追加分を除きました。前段への変更要求と実際の反映は「共通定義と実行記録」から確認できます。</p></details></header>
<div class="layout"><aside id="nav" aria-label="ユースケース"></aside><main><p id="location" class="meta"></p><div id="tabs" aria-label="仕様ファイル"></div><p><a id="source" target="_blank" rel="noopener">GitHubで正本を開く</a></p><article id="content"></article></main></div><script id="data" type="application/json">DATA</script><script>
const d=JSON.parse(document.getElementById('data').textContent),nav=document.getElementById('nav'),tabs=document.getElementById('tabs');let current=0;
function showFile(id){const f=d.files[id];document.getElementById('content').innerHTML=f.html;document.getElementById('location').textContent=f.path;document.getElementById('source').href=f.url;for(const b of tabs.children)b.setAttribute('aria-current',b.dataset.id===id);history.replaceState(null,'','#file-'+id)}
function showGroup(i,id){current=i;tabs.replaceChildren();for(const file of d.groups[i].files){const b=document.createElement('button');b.textContent=d.files[file].name;b.dataset.id=file;b.onclick=()=>showFile(file);tabs.append(b)}for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-current',+b.dataset.index===i);showFile(id||d.groups[i].files[0])}
let business='';d.groups.forEach((g,i)=>{if(g.business!==business){const h=document.createElement('h2');h.textContent=g.business;nav.append(h);business=g.business}const b=document.createElement('button');b.textContent=g.name;b.dataset.index=i;b.onclick=()=>showGroup(i);nav.append(b)});
document.getElementById('content').addEventListener('click',e=>{const a=e.target.closest('a[data-file]');if(!a)return;e.preventDefault();const id=a.dataset.file,anchor=a.dataset.anchor;showGroup(d.groups.findIndex(g=>g.files.includes(id)),id);if(anchor)document.getElementById(anchor)?.scrollIntoView({block:'start'})});
const requested=location.hash.replace('#file-',''),initial=d.groups.findIndex(g=>g.name==='貸出を登録する');showGroup(d.groups.findIndex(g=>g.files.includes(requested))>=0?d.groups.findIndex(g=>g.files.includes(requested)):Math.max(0,initial),d.files[requested]?requested:undefined);
</script></html>'''
page = page.replace('COUNTS', '<span>'+str(len(catalog['use_cases']))+' UC</span><span>'+str(http_count)+' HTTP操作</span><span>'+str(async_count)+' 非同期操作</span>')
page = page.replace('DATA</script>', data+'</script>')
args.output.write_text(page)
print(json.dumps({'output': str(args.output), 'bytes': len(page.encode()), 'files': len(contents), 'diagrams': svg_counter}))

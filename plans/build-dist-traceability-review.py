"""Render the generated matrix as a wide, scrollable review table."""
from pathlib import Path
import json
import re
import subprocess
from urllib.parse import quote, unquote

repo = Path(__file__).resolve().parents[1]
source = repo/'samples/distillery/pipeline/specs/latest/_cross-cutting/traceability-matrix.md'
marked = next((Path.home()/'.npm/_npx').glob('*/node_modules/marked/lib/marked.cjs'))
body = subprocess.run(['node', '-e', "const fs=require('fs');process.stdout.write(require(process.argv[1]).parse(fs.readFileSync(0,'utf8')))", str(marked)], input=source.read_text().split('## 要素と対応先')[1], text=True, capture_output=True, check=True).stdout
branch = subprocess.check_output(['git', 'branch', '--show-current'], cwd=repo, text=True).strip()
def link(match):
    path = (source.parent/unquote(match[1])).resolve().relative_to(repo)
    return 'href="https://github.com/suwa-sh/suwa-sh-claude-plugins/blob/'+quote(branch, safe='/')+'/'+quote(str(path), safe='/')+'" target="_blank" rel="noopener"'
body = re.sub(r'href="([^"]+)"', link, body)
page = '''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RDRA要素 × 全ユースケース</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#f4f1ea;color:#1a1a1a;font:15px/1.6 system-ui,sans-serif}h1{font-size:26px;margin:0 0 12px}p{max-width:1000px}a{color:#245db8}label{display:block;margin:16px 0}input{font:inherit;padding:8px;width:min(420px,100%)}.scroll{overflow:auto;max-height:75vh;border:1px solid #cfc9bc;background:white}table{border-collapse:separate;border-spacing:0;width:max-content;table-layout:fixed}th,td{min-width:180px;max-width:240px;width:180px;padding:10px;border-right:1px solid #d9d4c9;border-bottom:1px solid #d9d4c9;vertical-align:top;overflow-wrap:anywhere}th{position:sticky;top:0;z-index:2;background:#e8e4da;text-align:left}td:nth-child(1),th:nth-child(1){position:sticky;left:0;min-width:280px;width:280px;max-width:280px;background:#f4f1ea;z-index:1}td:nth-child(2),th:nth-child(2){position:sticky;left:280px;min-width:90px;width:90px;max-width:90px;background:#f4f1ea;z-index:1}th:nth-child(1),th:nth-child(2){z-index:3;background:#e8e4da}td:empty{background:#fafafa}a:focus-visible,input:focus-visible,.scroll:focus-visible{outline:3px solid #3b82f6}#result{font-size:14px}@media(max-width:650px){body{padding:12px}td:nth-child(1),th:nth-child(1){min-width:130px;width:130px;max-width:130px}td:nth-child(2),th:nth-child(2){left:130px;min-width:70px;width:70px;max-width:70px}th,td{min-width:150px;width:150px}}
</style><h1>RDRA要素 × 全ユースケース</h1><p>セルのリンクが、従来括弧内にあった対応箇所です。空欄は対応記録なし、linkedは対応記録ありを示し、実装完了の判定とは区別します。表を横にスクロールして全UCを確認できます。</p><label>要素を絞り込む <input id="filter" type="search" placeholder="例：予約、書籍、状態"></label><p id="result" aria-live="polite"></p><div class="scroll" tabindex="0" role="region" aria-label="全ユースケースとの対応表">BODY</div><script>const table=document.querySelector('table'),rows=[...table.tBodies[0].rows];function filter(){const query=document.getElementById('filter').value;for(const row of rows)row.hidden=!row.cells[0].textContent.includes(query);document.getElementById('result').textContent=rows.filter(r=>!r.hidden).length+' / '+rows.length+' 要素 × '+(table.tHead.rows[0].cells.length-2)+' UC'}document.getElementById('filter').addEventListener('input',filter);filter();</script></html>'''.replace('BODY', body[body.index('<table>'):])
output = repo/'plans/dist-traceability-matrix.html'
output.write_text(page)
print(json.dumps({'output':str(output),'bytes':len(page.encode())}))

from pathlib import Path
import html
root=Path(__file__).resolve().parents[1]
sample=root/'samples/distillery/spec-progressive'
files=[p for p in sorted(sample.rglob('*')) if p.is_file() and p.suffix in ('.yaml','.json','.md')]
parts=[]
for p in files:
 rel=p.relative_to(sample)
 parts.append(f'<details><summary>{html.escape(str(rel))}</summary><pre>{html.escape(p.read_text())}</pre></details>')
page='''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>契約を段階的に読む — AsyncAPIとRDB</title><style>*{box-sizing:border-box}body{margin:0;background:#F4F1EA;color:#1A1A1A;font:16px/1.8 Inter,"Noto Sans JP",sans-serif}main{max-width:1080px;padding:40px 24px;margin:auto}h1{font-size:32px;line-height:1.5}h2{margin-top:40px;font-size:24px}a{color:#245DB8}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:12px;text-align:left;vertical-align:top;border-bottom:1px solid #CFC9BC}th{background:#ECE8DE}.note{padding:16px 20px;border-left:4px solid #3B82F6;background:white}details{background:white;border:1px solid #CFC9BC;margin:12px 0;border-radius:4px}summary{padding:16px;cursor:pointer;overflow-wrap:anywhere}pre{background:#ECE8DE;padding:20px;font:13px/1.7 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}p{max-width:900px}@media(max-width:640px){table{display:block;overflow-x:auto}main{padding:24px 16px}h1{font-size:28px}}</style><main><p>DISTILLERY / 段階的開示 / 2026-09-06</p><h1>小さい索引から、<br>必要な契約だけを読む</h1><p>OpenAPIに加え、AsyncAPIとRDBスキーマにも分割管理を適用しました。正本の編集単位と、実装担当が読む範囲を分けています。</p><table><tr><th>契約</th><th>1. 入口</th><th>2. 対象の詳細</th><th>3. 必要な依存</th></tr><tr><td>OpenAPI</td><td>操作・所有UCの索引</td><td>対象operationのslice</td><td>要求・応答・共通schema</td></tr><tr><td>AsyncAPI</td><td>操作・所有UCの索引</td><td>対象operationとchannel</td><td>message・payload・共通schema</td></tr><tr><td>RDB</td><td>サブドメインの所有索引</td><td>対象domainのテーブル</td><td>外部キーの参照キー、業務操作に必要な外部列</td></tr></table><p class="note">全体bundleは表示・全体整合検証・codegen向けの生成物です。UC担当が最初から全量を読む入力にはしません。正本の型定義は一箇所に置き、派生物を人が修正する運用にしません。</p><h2>AsyncAPIのフォーマット</h2><pre>api/
  contracts.json                # UC・操作・tierの所有と利用
  asyncapi.yaml                 # ネイティブの小さい入口
  operations/sendLoan.yaml
  channels/loan-created.yaml
  components/messages/LoanCreated.yaml
  components/schemas/LoanCreatedPayload.yaml
  generated/asyncapi.bundle.yaml # 表示・codegen向け生成物

各UC/
  _api-summary.yaml
  _contract-slice.json           # 必要な操作と依存の生成物</pre><p>operationからchannel、そのchannelで使用するmessageへの参照関係を維持します。ACK、再試行、順序、重複排除、障害時の振る舞いは技術仕様へ接続します。</p><h2>RDBのフォーマット</h2><pre>datastore/
  rdb-schema.yaml                # arch latestへの参照・domain索引
  domains/SD-001.yaml             # 蔵書貸出・予約の正本
  domains/SD-002.yaml             # 蔵書目録の正本
  domains/SD-003.yaml             # 利用者管理の正本
  generated/rdb-schema.bundle.yaml
  generated/domain-slices/SD-001.yaml
  generated/domain-slices/SD-002.yaml
  generated/domain-slices/SD-003.yaml</pre><p>サブドメインとエンティティの所有先はarch latestに従います。対象domainのsliceには自分のテーブルと、外部キーの検証に必要な境界外のキーだけを含めます。外部のemail等を業務処理が使う場合は、その列・制約を所有先から追加で読みます。キーだけの外部ビューから完全なrow型やDDLを生成しません。</p><p class="note">仕様の分割は物理DBやトランザクションの分割を意味しません。複数domainの表を同じ取引で更新する場合、その原子性・更新責務はarch latestとtierに残します。所有先が不明な表は勝手にcommonへ入れず、archへ還流します。</p><h2>生成したサンプルを読む</h2><p>AsyncAPIは既存の契約テスト用サンプルを分割。RDBは現行サンプルのloans・books・usersを既存archのSD-001/002/003へ配置しました。分割・参照・生成の検証用であり、前回の貸出仕様の7件の還流要求を解決したものではありません。以下は実ファイルの全文です。</p>'''+''.join(parts)+'''<p>仕様の意味はlatestを参照し、過去イベントへの固定は行いません。ソース: samples/distillery/spec-progressive</p></main></html>'''
(root/'plans/dist-spec-progressive-review.html').write_text(page)
print(f'{len(page.encode())} bytes')

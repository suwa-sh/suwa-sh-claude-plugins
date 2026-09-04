# TODO / 追加提案

本ファイルは後続スキルからの追加提案を集約する。
RDRA に存在しない要素を追加する前に、ここで合意を得てから requirements スキルで反映する。

## 2026-09-03 dist-requirements からの追加提案

### DIST-001: 予約・在庫管理の粒度（タイトル単位 vs 蔵書冊単位）
- **発生元**: dist-requirements (20260903_030744_initial_build)
- **種別**: RDRA確認
- **提案内容**: 仮採用: 書籍1タイトル=1冊として書籍の状態（在庫あり/貸出中/予約待ち）を管理。同一タイトルの複数冊（蔵書コピー）を扱う場合は情報「蔵書」を追加し、状態を冊単位に分離する必要がある。他案: 蔵書（冊）エンティティを初期から分離 / タイトル単位で在庫数を持つ。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-requirements からの追加提案

### DIST-002: 利用者のWeb画面ログイン（認証）方式
- **発生元**: dist-requirements (20260903_030744_initial_build)
- **種別**: RDRA確認
- **提案内容**: 仮採用: 利用者は利用者番号+パスワードでログインし自分の貸出履歴・予約状況を閲覧する（要望に認証方式の記載なし。USDM には認証 SPEC を追加せず後段の NFR/arch で扱う）。他案: 司書が発行するワンタイムリンク / 外部IdP（自治体アカウント等）連携。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-requirements からの追加提案

### DIST-003: 貸出期間・リマインド日数・貸出上限の具体値
- **発生元**: dist-requirements (20260903_030744_initial_build)
- **種別**: RDRA確認
- **提案内容**: 仮採用: 貸出期間 14日、リマインドは返却期限3日前、1人あたり貸出上限は未設定（要望に数値の記載なし。ビジネスパラメータとして情報「貸出期間」「リマインド日数」を定義済み）。他案: 貸出期間 7日/21日、リマインド 1日前、貸出上限 5冊。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-004: B.1.1.4 バッチ処理件数（仮採用 Lv1: 1回あたり〜10万件）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1（日次バッチで貸出中の貸出〜10万件を走査）。蔵書規模が RDRA に無く弱い推論。他案: Lv2（〜100万件、複数館・大規模蔵書）/ Lv0 相当（〜1万件、小規模館で明示）。蔵書冊数の想定を確認したい。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-005: B.1.2.2 ピーク時データ量（仮採用 Lv1: 通常時の2倍）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1（新刊入荷日・長期休暇前でも通常時の2倍以内）。季節変動の記述が RDRA に無い。他案: Lv2（通常時の3倍、夏休み等の繁忙期あり）/ Lv3（通常時の5倍、イベント時の集中）。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-006: B.2.2.2 バッチ処理量（仮採用 Lv1: 1回あたり〜10万件）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1（貸出中の貸出走査＋通知レコード生成で〜10万件）。他案: Lv2（〜100万件）/ Lv0 相当（〜1万件）。B.1.1.4 と同じく蔵書規模に依存。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-007: C.5.1.1 サポート時間（仮採用 Lv1: 営業時間内 9時〜17時）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1（開館時間帯のみ。夜間の利用者操作は検索・予約・照会に限られるため）。運用体制が RDRA に無い。他案: Lv2（9時〜21時、夜間開館に合わせる）/ Lv3（平日24時間、M2 標準）。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-008: D.3.1.2 移行元環境の廃棄（仮採用 Lv1: 紙台帳は館内規定で保管、表計算ファイルは参照専用アーカイブ）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1。移行元の廃棄方針は RDRA に記述なし。他案: Lv0 相当（廃棄せず並行保管を継続）/ Lv2（移行検証完了後に表計算ファイルを削除し紙台帳も規定期間後に廃棄）。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-009: D.5.1.1 移行リハーサル（仮採用 Lv1: 1回実施）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1（移行量小・一括移行のため1回）。移行体制が RDRA に無い。他案: Lv0（リハーサルなし、休館日に本番投入のみ）/ Lv2（2回実施、M2 標準）。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-010: D.5.1.2 移行判定基準（仮採用 Lv1: 件数一致＋主要属性のサンプル突合）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1（書籍・利用者の件数一致と ISBN・利用者番号・メールアドレスのサンプル突合）。他案: Lv2（全件突合＋貸出中データの状態整合確認）/ Lv0 相当（件数一致のみ）。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-011: E.3.1.1 セキュリティ診断（仮採用 Lv1: ツールによる自動診断）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1（社外公開があるため診断なしは不可、小規模のため手動診断は見送り）。他案: Lv2（手動による脆弱性診断、M2 標準）/ Lv0（診断なし、M1 標準）。個人情報を扱うため Lv2 への引き上げも検討余地あり。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-012: E.8.2.1 IDS/IPS（仮採用 Lv1: IDS による検知のみ）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1（検知のみ、自動遮断なし）。他案: Lv0 相当（導入なし、WAF とファイアウォールで代替）/ Lv2（IPS で自動遮断）。デプロイ環境が決まればマネージドサービスの有無で再判定。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-013: E.10.1.1 WAF（仮採用 Lv1: 基本的な WAF ルール適用）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1（マネージドルールセットのデフォルト適用）。他案: Lv2（カスタムルール＋定期チューニング、M2 標準）/ Lv0（WAF なし、M1 標準）。利用者向け検索・予約画面を社外公開するため Lv0 は非推奨。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-014: F.1.1.3 対応デバイス（仮採用 Lv2: PC＋タブレット、スマートフォンは要確認）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv2（司書窓口は PC、利用者向けは PC/タブレット）。RDRA に「モバイル」「スマートフォン」の記述なし。他案: Lv3 相当（スマートフォン対応を含める。利用者の検索・予約はスマホ利用が多い可能性）/ Lv1 相当（PC のみ）。スマホ対応の有無は F.1.1.2 対応ブラウザ・デザインシステムにも影響。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-015: F.1.2.2 帯域要件（仮採用 Lv1: 〜100Mbps）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv1（画面主体・大容量添付なし）。館内回線の前提が RDRA に無い。他案: Lv2（〜1Gbps、書影画像等を扱う場合）/ Lv0 相当（〜10Mbps、テキスト画面のみ）。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-quality-attributes からの追加提案

### DIST-016: F.3.1.2 アクセシビリティ（仮採用 Lv2: JIS X 8341-3:2016 レベル AA 目標）
- **発生元**: dist-quality-attributes (nfr:20260903_031858_initial_nfr)
- **種別**: NFR確認
- **提案内容**: 仮採用: Lv2（公共性のある利用者向け画面として AA 目標）。アクセシビリティ要件は RDRA に記述なし。他案: Lv1（レベル A、最低限）/ Lv3（AA 準拠を必須要件とし第三者試験を実施）。公立図書館なら自治体の Web アクセシビリティ方針に従う必要がある。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-architecture からの追加提案

### DIST-017: 集約境界（AG-003 貸出 / AG-005 予約）と越境トランザクションの確定
- **発生元**: dist-architecture (arch:20260903_032540_initial_arch)
- **種別**: Arch確認
- **提案内容**: 仮採用: 貸出・予約・書籍を別集約とし UC 単位で同期整合（単一 RDB トランザクション）。他の選択肢: 書籍単位の予約帳を root にして予約を member 化 / 集約を跨ぐ更新を結果整合（ドメインイベント）にする。confidence: low（戦略段階の仮説）。dist-spec の UC 解析後に確定すること。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-architecture からの追加提案

### DIST-018: 集約 invariants（不変条件）16 件の確定
- **発生元**: dist-architecture (arch:20260903_032540_initial_arch)
- **種別**: Arch確認
- **提案内容**: 仮採用: 条件.tsv の禁止・必須・一意・範囲表現から機械抽出した 16 件をそのまま採用。他の選択肢: 重複予約禁止・貸出冊数上限など RDRA 未記載ルールの追加 / 戦略段階では空配列にして dist-spec で詳細化。confidence: low（AG-002 閲覧範囲や AG-006 重複防止は不変条件かアクセス制御・冪等性か判断が分かれる）。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-architecture からの追加提案

### DIST-019: BC の team_ownership 指定
- **発生元**: dist-architecture (arch:20260903_032540_initial_arch)
- **種別**: Arch確認
- **提案内容**: 仮採用: 全 BC の team_ownership を null（未定）のまま進める。他の選択肢: BC ごとにチーム名を個別指定 / 全 BC を 1 チーム所有。confidence: low（RDRA からチーム情報は推論不能）。チーム編成確定後に arch-design.yaml へ追記すること。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-architecture からの追加提案

### DIST-020: 書籍検索のストレージ方式（RDB 索引 vs Search Engine）
- **発生元**: dist-architecture (arch:20260903_032540_initial_arch)
- **種別**: Arch確認
- **提案内容**: 仮採用: RDB の索引 + LIKE / 全文検索インデックスで実装（Search Engine なし）。他の選択肢: Search Engine を追加 / KVS キャッシュ + RDB。confidence: low（NFR B に全文検索要件なし、蔵書規模が RDRA に無い）。蔵書冊数と検索要件（表記揺れ・ランキング）を確認して再判定すること。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-architecture からの追加提案

### DIST-021: サポート体制と夜間バッチ失敗時の運用
- **発生元**: dist-architecture (arch:20260903_032540_initial_arch)
- **種別**: Arch確認
- **提案内容**: 仮採用: 営業時間内サポート + 翌営業日再実行（夜間失敗はアラート通知のみ）。他の選択肢: 夜間オンコール対応 / バッチ起動を開館直前に移して営業時間内で失敗対応。confidence: low（NFR C.5.1.1 サポート時間 Lv1 は運用体制不明の弱い推論）。運用体制確定後にバッチ起動時刻と再実行手順を確定すること。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-architecture からの追加提案

### DIST-022: 貸出統計（E-009）の持ち方（集計テーブル vs オンデマンド集計）
- **発生元**: dist-architecture (arch:20260903_032540_initial_arch)
- **種別**: Arch確認
- **提案内容**: 仮採用: resource_mutable の集計テーブル（Materialized View、日次バッチ or 要求時に再集計）。他の選択肢: エンティティ化せず貸出からのオンデマンド集計クエリ / event 型（集計実行ごとに INSERT 追記）。confidence: low（貸出からの派生でありエンティティ化の要否はレスポンス実測で変わる）。NFR B.2.1.3 10 秒以内の実測後に再判定すること。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-architecture からの追加提案

### DIST-023: トークン期限接近ログ（LP-004）の要否
- **発生元**: dist-architecture (arch:20260903_032540_initial_arch)
- **種別**: Arch確認
- **提案内容**: 仮採用: presentation 層で WARN 出力（しきい値は設定ファイル）。他の選択肢: 出力しない（再認証誘導で足りると割り切る）/ API Gateway 側のアクセスログに残有効期間を含める。confidence: low（NFR E.5.1.1 はトークン運用の詳細を規定していない）。トークン有効期間の運用方針確定後に再判定すること。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-infrastructure からの追加提案

### DIST-024: クラウドベンダーの仮採用（aws）
- **発生元**: dist-infrastructure (infra:20260903_040307_infra_product_design)
- **種別**: Infra確認
- **提案内容**: arch technology_context.constraints はクラウドベンダー未定。MCL 実行のため foundation-context を最小構成で自動生成し target_clouds = aws を仮採用した（confidence: low）。他の選択肢: gcp / azure。確定後は mcl-foundation-design を実行して docs/mcl/foundation/output/foundation-context.yaml を置き換え、infra を再実行する。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-infrastructure からの追加提案

### DIST-025: リージョン / マルチリージョン方針の仮採用（ap-northeast-1 単一リージョン + マルチ AZ）
- **発生元**: dist-infrastructure (infra:20260903_040307_infra_product_design)
- **種別**: Infra確認
- **提案内容**: foundation-context 未整備のため allowed_regions を ap-northeast-1 のみで仮採用（confidence: low）。NFR A.3.1.1 / A.3.1.2 災害対策 grade 1 と 1 館運用が根拠。他の選択肢: 大阪リージョンへのバックアップ複製 / 東京-大阪アクティブ-スタンバイ。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-infrastructure からの追加提案

### DIST-026: データレジデンシーの仮採用（japan）
- **発生元**: dist-infrastructure (infra:20260903_040307_infra_product_design)
- **種別**: Infra確認
- **提案内容**: RDRA/NFR に明示的なレジデンシー要件はない。利用者の個人情報（氏名・連絡先・貸出履歴）を保持し個人情報保護法準拠（CTP-012）のため product-input.yaml の data_sensitivity.data_residency = japan を保守的に仮採用（confidence: low）。他の選択肢: none / japan + バックアップのみ海外可。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-design-system からの追加提案

### DIST-027: スマートフォン対応の要否（利用者ポータル）
- **発生元**: dist-design-system (20260903_041812_design_system)
- **種別**: NFR確認
- **提案内容**: NFR F.1.1.3 対応デバイス Lv2（PC + タブレット、スマホ要確認 / confidence: low）を仮採用し、design では lg/md をフル設計・sm（<768px）はハンバーガー + 1 カラムの簡易対応に留めた。利用者がスマートフォンから検索・予約・利用状況確認を行う想定なら、sm をフル設計（モバイルファースト）に切り替える。選択肢: A) PC+タブレット（採用） / B) スマホもフル対応 / C) PC のみ
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-design-system からの追加提案

### DIST-028: アクセシビリティ目標レベル（JIS X 8341-3 AA）
- **発生元**: dist-design-system (20260903_041812_design_system)
- **種別**: NFR確認
- **提案内容**: NFR F.3.1.2 アクセシビリティ（confidence: low）から JIS X 8341-3:2016 レベル AA を目標として仮採用した。design ではコントラスト AA・色+文言併用・focus-visible・reduced-motion 尊重・addon-a11y 有効化までを含めている。公共図書館として AA 準拠が正式要件なら spec / impl で検証手順（スクリーンリーダー・キーボード操作）を追加する。選択肢: A) AA 目標（採用） / B) A のみ / C) AA 準拠を必須要件化
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-spec からの追加提案

### DIST-029: 利用者削除時の貸出中・予約中の扱い（仮採用: 削除不可 409）
- **発生元**: dist-spec (20260903_044456_spec_generation)
- **種別**: RDRA追加
- **提案内容**: RDRA 条件.tsv に利用者削除の可否条件が無い。spec では貸出中/延滞の貸出、予約中/通知済みの予約がある利用者の削除を 409 で拒否する保守的な扱いを仮採用（confidence: low）。他の選択肢: 削除時に予約取消・貸出を返却済み扱いにする連鎖処理 / 制約なしで削除。要件として確定する場合は条件.tsv に「利用者削除可否判定」を追加すること。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-spec からの追加提案

### DIST-030: 書籍検索のキーワード照合方式（仮採用: 正規化つき部分一致）
- **発生元**: dist-spec (20260903_044456_spec_generation)
- **種別**: RDRA確認
- **提案内容**: 条件.tsv「書籍検索条件判定」は照合方式を規定していない。spec ではタイトル・著者・出版社・ISBN への部分一致（大文字小文字・全角半角を正規化、RDB 索引 + LIKE）を仮採用（confidence: low）。他の選択肢: 完全一致のみ / 形態素解析つき全文検索（Search Engine 追加、arch DIST-020 と連動）。蔵書規模と表記揺れ要件の確認後に再判定すること。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-spec からの追加提案

### DIST-031: 利用者の認証情報を初期作成する UC の追加
- **発生元**: dist-spec (20260903_044456_spec_generation)
- **種別**: RDRA追加
- **提案内容**: Step6.5 反証レビュー R-003（blocker）。credentials に行を作成する UC が RDRA にも Spec にも存在せず、登録された利用者は永久にログインできない。認証必須の利用者ポータル UC（貸出履歴を参照する / 予約状況を参照する / 予約を登録する / 予約を取り消す）が到達不能になる。対応案: BUC「利用者管理業務 / 利用者を管理するフロー」の UC「利用者を登録する」に認証情報の初期作成（初期パスワード発行または招待メール送付）を含めるか、独立 UC「認証情報を発行する」を追加する。RDRA に UC を追加後、パイプライン再実行で rdb-schema.yaml の credentials.used_by に INSERT 元 UC を登録する。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-spec からの追加提案

### DIST-032: 貸出統計を集計する定期実行 UC の追加
- **発生元**: dist-spec (20260903_044456_spec_generation)
- **種別**: RDRA追加
- **提案内容**: Step6.5 反証レビュー R-006（blocker）。loan_statistics を UPSERT する集計バッチの UC が RDRA にも Spec にも存在せず、運営分析 2 UC（期間別貸出統計を参照する / 人気書籍ランキングを参照する）の参照元データを誰が作るのかが未定義。対応案: BUC「運営分析業務 / 蔵書の利用状況を分析するフロー」にタイマー起動 UC「貸出統計を集計する」（tier-worker）を追加する。暫定措置として集計バッチの前提（実行周期・UPSERT キー・ranking 付与・loan_count / loan_total の定義・遅延到着の再集計・cache:report:* 無効化）を _cross-cutting/datastore/rdb-schema.yaml の _review_notes に注記済み。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-spec からの追加提案

### DIST-033: spec-event スキーマに USDM SPEC 参照フィールドを追加する
- **発生元**: dist-spec (20260903_044456_spec_generation)
- **種別**: スキーマ拡張
- **提案内容**: Step6.5 反証レビュー R-019（major）。spec-event.yaml の use_cases 要素は business / buc / uc / files / api_count / async_event_count のみで、USDM の SPEC ID・受入基準への機械可読な参照が無く、UC が USDM のどの SPEC に遡るかを検証できない（event 配下 185 ファイルに SPEC- が 0 件、docs/usdm/latest/requirements.yaml には SPEC-001-01〜SPEC-006-01 の 17 件）。対応案: dist-spec スキル側で use_cases に usdm_spec_ids / usdm_acceptance_criteria_refs を追加し、生成 Step で埋める。あわせて _cross-cutting/traceability-matrix.md に USDM SPEC × UC のマトリクスと SPEC 網羅率を追加する。本イベントの成果物は変更していない。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open

## 2026-09-03 dist-spec からの追加提案

### DIST-034: UC 側 KVS キー名を kvs-schema.yaml の命名規約に追随させる
- **発生元**: dist-spec (20260903_044456_spec_generation)
- **種別**: 成果物追随
- **提案内容**: Step6.5 反証レビュー R-008（major）。_cross-cutting/datastore/kvs-schema.yaml が正本として cache:{リソース}:{サブ種別}:{識別子} / lock:{種別}:{識別子} に統一したが、12 UC の _model-summary.yaml と tier md に旧キー名が残っている。旧→新: cache:book-reservations→cache:reservations:book / cache:me-loans→cache:loans:me / cache:me-reservations→cache:reservations:me / cache:user-usage→cache:users:usage / cache:book:{bookId}→cache:books:detail:{bookId} / job:reminder-extraction→lock:job:reminder-extraction / job:overdue-detection→lock:job:overdue-detection / dedupe:notification→lock:notification / consumer:return-notice→lock:consumer:return-notice。**Step6.5 round 1 の R-008 対応で解消済み**（UC 側 _model-summary.yaml の key_pattern 16 種はすべて kvs-schema.yaml の pattern と一致し、旧キー名は kvs-schema.yaml の改名履歴注記にのみ残る）。
- **根拠**: Step6.5 round 2 の R-032 で実測確認。UC 側成果物に旧キー名は 0 件。
- **影響範囲**: なし（追加作業不要）
- **推奨対応**: [x] 対応不要（解消済み）
- **ステータス**: closed（解消済み）

## 2026-09-04 dist-pipeline からの追加提案

### DIST-035: Step6b: RDRA フィードバック 4 件の要旨（網羅率 100% 未達）
- **発生元**: dist-pipeline (20260903_044456_spec_generation)
- **種別**: RDRA追加
- **提案内容**: Step6b 網羅率チェックで `docs/specs/latest/_cross-cutting/rdra-feedback.md` が残存（網羅率 100% 未達）。dialogue_policy=auto_adopt のため差分再実行は行わず、要旨を todo に登録して事後判断とする。

変更要望 4 件:

1. 情報「貸出期間」の属性「更新日」— 削除、または保守 UC（例:「貸出期間を設定する」）を追加。参照側 UC は valid_from で世代解決するため更新日を使用しない。
2. 情報「リマインド日数」の属性「更新日」— 削除、または保守 UC（例:「リマインド日数を設定する」）を追加。同上の理由。
3. UC 追加: 認証情報（credentials）の初期作成 — DIST-031 として起票済み（blocker）。
4. UC 追加: 貸出統計（loan_statistics）の集計定期実行 — DIST-032 として起票済み（blocker）。

推奨: #1 / #2 は同一原因（ビジネスパラメータ保守 UC 不在）のため、対応方針を「属性削除」か「保守 UC 追加」のどちらかに統一する。保守 UC を追加する場合は貸出期間・リマインド日数を 1 UC（例:「ビジネスパラメータを設定する」、アクター: 司書）にまとめると UC 数増加を最小化できる。

差分再実行が必要な場合は feedback request Markdown を作成し `/distillery:dist-pipeline path/to/{feedback_id}.md` で実行する。
- **根拠**: (サブエージェントが記入)
- **影響範囲**: (サブエージェントが記入)
- **推奨対応**: [ ] requirements スキル再実行で反映 / [ ] 却下 / [ ] 保留
- **ステータス**: open


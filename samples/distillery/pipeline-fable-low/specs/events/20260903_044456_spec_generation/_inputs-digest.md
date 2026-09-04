design_available: true
event_id: 20260903_044456_spec_generation

# arch ダイジェスト

- 転写元: `docs/arch/latest/arch-design.yaml`
- source_sha256: `00ef834d62946ecc806f3ac1755b4250fecff62244405745e1a7df4ef94c91d4`
- 生成: `extractSections.js`（原文転写。要約・言い換えなし）

## 転写済みセクションのチェックリスト

| セクション | 状態 |
|---|---|
| `technology_context` | 転写済み |
| `domain_architecture` | 転写済み |
| `system_architecture.tiers` | 転写済み |
| `app_architecture.tier_layers` | 転写済み |
| `data_architecture.entities` | 転写済み |

`not_applicable` = 元ファイルにセクション自体が存在しない（フォールバック対象外。元ファイルを読みに行かない）。

## technology_context

```yaml
technology_context:
  languages:
    - "未定（ユーザー希望なし。dist-impl の bootstrap 時に確定する）"
  frameworks:
    - "未定（ユーザー希望なし。Web フロントエンドは SPA フレームワーク、バックエンドは REST + ORM を持つ汎用 Web フレームワークを想定）"
  constraints:
    - "クラウドベンダー未定・ベンダーニュートラル（CaaS(k8s) / RDB / KVS / MQ / Object Storage 等の汎用用語で設計し、ベンダー固有サービス名を使わない）"
    - "デプロイ先未定（クラウド / オンプレミスのいずれにも配置可能な構成とする。CaaS(k8s) を第一候補、コンテナ + LB を代替候補とする）"
    - "1 館向けの小規模システム（NFR B.1.1.1 同時アクセス〜100）。モジュラモノリス + 単一 RDB で開始し、BC 境界をモジュールとして維持する"
    - "利用者向け（公開経路）と司書向け（館内経路）の 2 系統フロントエンドを分離する（NFR E.5.3.1）"
    - "Backend API とワーカーは domain / repository / gateway を共有ライブラリとして共有する（モノレポ運用が前提）"
```

## domain_architecture

```yaml
domain_architecture:
  subdomains:
    - id: "SD-001"
      name: "貸出・予約・期限管理"
      type: "core"
      investment_policy: "最優先で深いモデリングと継続的リファクタリングに投資。チーム最強の人材を配置"
      related_buc_ids:
        - "BUC-004"
        - "BUC-005"
        - "BUC-006"
        - "BUC-007"
        - "BUC-008"
      reason: "システム概要が「貸出・返却・予約を Web 画面から行う」「返却期限自動設定・リマインド・督促の自動送信で司書の手作業とミスを削減」をシステムの目的として明示。書籍/貸出/予約の 3 状態モデルが連動する最も複雑な業務領域。ただし「競争優位」「差別化」の明示キーワードは無く、Core 判定は経営判断のためユーザー確認必須"
      source_model: "BUC: 書籍を貸し出すフロー, 書籍を返却するフロー, 書籍を予約するフロー, 返却期限を通知するフロー, 延滞者に督促するフロー, システム概要: 貸出・返却・予約 / 司書の手作業とミスを削減, 状態: 書籍の状態, 貸出の状態, 予約の状態"
      confidence: "medium"
    - id: "SD-002"
      name: "蔵書管理"
      type: "supporting"
      investment_policy: "good enough な品質で安定運用。標準的なフレームワーク採用"
      related_buc_ids:
        - "BUC-001"
        - "BUC-002"
      reason: "書籍・ジャンルの登録・編集・削除・検索は貸出・予約の前提となるマスタ管理業務。中核業務を支援するが差別化要因ではない。媒体種別（紙・電子）は将来拡張の起点"
      source_model: "BUC: 蔵書を管理するフロー, 書籍を検索するフロー, 情報: 書籍, ジャンル, バリエーション: 媒体種別"
      confidence: "medium"
    - id: "SD-003"
      name: "利用者管理"
      type: "supporting"
      investment_policy: "good enough な品質で安定運用。標準的なフレームワーク採用"
      related_buc_ids:
        - "BUC-003"
        - "BUC-009"
      reason: "利用者の登録・編集・削除と、利用者区分に基づく自分の利用状況の閲覧（利用状況閲覧範囲判定）は貸出・予約の主体を管理する支援業務。個人情報（氏名・連絡先）を扱うため感度は高いが差別化要因ではない"
      source_model: "BUC: 利用者を管理するフロー, 自分の利用状況を確認するフロー, 情報: 利用者, 条件: 利用状況閲覧範囲判定"
      confidence: "medium"
    - id: "SD-004"
      name: "運営分析"
      type: "supporting"
      investment_policy: "good enough な品質で安定運用。標準的なフレームワーク採用"
      related_buc_ids:
        - "BUC-010"
      reason: "在庫状況・人気書籍ランキング・期間別貸出統計は貸出記録の参照系集計であり、選書・運営改善の判断材料を提供する支援業務"
      source_model: "BUC: 蔵書の利用状況を分析するフロー, 情報: 貸出統計, 条件: 人気書籍ランキング判定, 集計期間判定"
      confidence: "medium"
    - id: "SD-005"
      name: "通知配信"
      type: "generic"
      investment_policy: "外部 SaaS / ライブラリ採用、自作回避。コスト効率優先"
      related_buc_ids:
        - "BUC-005"
        - "BUC-007"
        - "BUC-008"
      reason: "返却通知・リマインド・督促の 3 種のメール送信はすべて外部システム「メール配信サービス」経由。外部システム.tsv の通知系カテゴリと一致する汎用機能（該当 BUC は SD-001 と重複。送信 UC を含む BUC のみ列挙）"
      source_model: "外部システム: メール配信サービス, 情報: 通知, バリエーション: 通知種別, BUC: 書籍を返却するフロー, 返却期限を通知するフロー, 延滞者に督促するフロー"
      confidence: "high"
  bounded_contexts:
    - id: "BC-001"
      name: "蔵書コンテキスト"
      ubiquitous_language:
        - term: "書籍"
          definition: "蔵書として一元管理する 1 冊の本。書籍 ID で識別し、タイトル・著者・ISBN・出版社・ジャンル・媒体種別を持つ。貸出・予約コンテキストからは書籍 ID と書籍の状態で参照される"
        - term: "書籍の状態"
          definition: "在庫あり・貸出中・予約待ちの 3 値。蔵書コンテキストが所有し、貸出登録・返却登録・予約取消を契機に遷移する"
        - term: "ジャンル"
          definition: "書籍を分類する区分（文学・社会科学・自然科学・技術・芸術・歴史・児童書・その他）。検索条件と分析単位に使う"
        - term: "媒体種別"
          definition: "紙・電子の区別。初期リリースは紙のみ貸出・予約対象。電子は登録のみ可能"
      related_subdomain_id: "SD-002"
      owned_entity_ids:
        - "E-001"
        - "E-002"
      owned_buc_ids:
        - "BUC-001"
        - "BUC-002"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「蔵書管理」に対応。書籍の状態モデルを所有し、司書の登録・編集・削除と利用者・司書の検索という独立したアクター集合を持つ"
      source_model: "情報: 書籍, ジャンル, 状態: 書籍の状態, 条件: 書籍検索条件判定, 在庫状況判定, 媒体種別判定, BUC: 蔵書を管理するフロー, 書籍を検索するフロー"
      confidence: "medium"
    - id: "BC-002"
      name: "利用者コンテキスト"
      ubiquitous_language:
        - term: "利用者"
          definition: "図書館を利用する人。一意の利用者番号で識別し、氏名・連絡先・利用者区分を持つ。貸出・予約の主体であり通知の送信先"
        - term: "利用者番号"
          definition: "司書が登録時に付与する一意の識別子。他コンテキストは利用者番号で利用者を参照する"
        - term: "利用者区分"
          definition: "司書・利用者の 2 値。操作範囲と利用状況の閲覧範囲（自分のみ / 任意の利用者）を切り替える"
      related_subdomain_id: "SD-003"
      owned_entity_ids:
        - "E-003"
      owned_buc_ids:
        - "BUC-003"
        - "BUC-009"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「利用者管理」に対応。条件.tsv で利用状況閲覧範囲判定が利用者管理コンテキストに置かれているため、利用者本人の利用状況参照（BUC-009）もこの BC が扱う。個人情報を集約して保護境界を明確化"
      source_model: "情報: 利用者, 条件: 利用状況閲覧範囲判定, バリエーション: 利用者区分, BUC: 利用者を管理するフロー, 自分の利用状況を確認するフロー"
      confidence: "medium"
    - id: "BC-003"
      name: "貸出コンテキスト"
      ubiquitous_language:
        - term: "貸出"
          definition: "利用者に書籍を貸し出した記録。貸出日・返却期限・返却日と貸出の状態（貸出中・延滞・返却済み）を持つ"
        - term: "返却期限"
          definition: "貸出日に貸出期間を加算して自動設定する日付。リマインド・延滞判定の基準"
        - term: "延滞"
          definition: "返却期限を超過して未返却の貸出の状態。日次バッチが判定し督促の送信対象とする"
        - term: "貸出期間"
          definition: "返却期限算出に使う業務パラメータ（日数）"
        - term: "リマインド日数"
          definition: "返却期限の何日前からリマインド対象とするかを定める業務パラメータ"
      related_subdomain_id: "SD-001"
      owned_entity_ids:
        - "E-004"
        - "E-005"
        - "E-006"
      owned_buc_ids:
        - "BUC-004"
        - "BUC-005"
        - "BUC-007"
        - "BUC-008"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「貸出管理」に対応。貸出の状態モデルと返却期限に関する業務パラメータを所有し、司書の貸出・返却登録とタイマーの日次バッチ（リマインド抽出・延滞判定）を扱う"
      source_model: "情報: 貸出, 貸出期間, リマインド日数, 状態: 貸出の状態, 条件: 貸出可否判定, 返却期限算出, 返却後の書籍状態判定, リマインド対象判定, 延滞判定, BUC: 書籍を貸し出すフロー, 書籍を返却するフロー, 返却期限を通知するフロー, 延滞者に督促するフロー"
      confidence: "medium"
    - id: "BC-004"
      name: "予約コンテキスト"
      ubiquitous_language:
        - term: "予約"
          definition: "貸出中または予約待ちの書籍に対する利用者の予約記録。受付日時順の予約順位と予約の状態（予約中・通知済み・取消）を持つ"
        - term: "予約順位"
          definition: "同一書籍に対する受付順の順位。取消時に後続を繰り上げる。順位 1 位が返却通知と貸出の対象"
        - term: "通知済み"
          definition: "書籍返却時に順位 1 位の利用者へ返却通知を送った後の予約の状態。貸出登録で予約は完了して終了する"
      related_subdomain_id: "SD-001"
      owned_entity_ids:
        - "E-007"
      owned_buc_ids:
        - "BUC-006"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「予約管理」に対応。予約の状態モデルと予約順位決定ルールを所有し、主アクターが利用者（予約登録・取消）と司書（予約一覧）で貸出コンテキストと異なる"
      source_model: "情報: 予約, 状態: 予約の状態, 条件: 予約可否判定, 予約順位決定, BUC: 書籍を予約するフロー"
      confidence: "medium"
    - id: "BC-005"
      name: "通知コンテキスト"
      ubiquitous_language:
        - term: "通知"
          definition: "利用者に送信した返却通知・リマインド・督促のメール記録。送信先・件名・本文・送信日時・送信結果と対象貸出 ID / 対象予約 ID を持つ"
        - term: "通知種別"
          definition: "返却通知・リマインド・督促の 3 値。送信契機（返却登録・期限接近・期限超過）と送信内容を切り替える"
        - term: "送信結果"
          definition: "メール配信サービスからの応答。通知の重複や漏れの防止と延滞一覧での督促送信状況の確認に使う"
      related_subdomain_id: "SD-005"
      owned_entity_ids:
        - "E-008"
      owned_buc_ids:
        - "BUC-005"
        - "BUC-007"
        - "BUC-008"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「通知管理」に対応。外部システム「メール配信サービス」との連携領域を独立 BC として隔離し、通知記録を所有する。owned_buc_ids は送信 UC を含む BUC（貸出コンテキストと重複）"
      source_model: "情報: 通知, 外部システム: メール配信サービス, 条件: 返却通知対象判定, バリエーション: 通知種別, BUC: 書籍を返却するフロー, 返却期限を通知するフロー, 延滞者に督促するフロー"
      confidence: "medium"
    - id: "BC-006"
      name: "運営分析コンテキスト"
      ubiquitous_language:
        - term: "貸出統計"
          definition: "貸出記録を集計期間種別（日・月・年）と書籍ごとに集計した情報。貸出回数・貸出件数・ランキング順位を持つ"
        - term: "人気書籍ランキング"
          definition: "書籍ごとの貸出回数の多い順に付与した順位"
        - term: "在庫状況"
          definition: "書籍の状態を一覧表示するための参照ビュー。蔵書コンテキストの書籍の状態を読み取り専用で利用する"
      related_subdomain_id: "SD-004"
      owned_entity_ids:
        - "E-009"
      owned_buc_ids:
        - "BUC-010"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「運営分析管理」に対応。貸出・書籍を読み取り専用で集計する参照系で、他コンテキストの状態を変更しない"
      source_model: "情報: 貸出統計, 条件: 人気書籍ランキング判定, 集計期間判定, バリエーション: 集計期間種別, BUC: 蔵書の利用状況を分析するフロー"
      confidence: "medium"
  context_map:
    - id: "CM-001"
      from_bc_id: "BC-003"
      to_bc_id: "BC-001"
      pattern: "customer_supplier"
      direction: "downstream"
      translator_description: "貸出コンテキストが書籍 ID で書籍を参照し、貸出登録・返却登録を契機に書籍の状態（在庫あり ⇄ 貸出中 / 予約待ち）の遷移を蔵書コンテキストに要求する。蔵書コンテキストは書籍の状態遷移 API を貸出の要件に合わせて提供する"
      integration_events: []
      reason: "貸出 UC が書籍と書籍の状態を参照・遷移させる。書籍の状態は蔵書コンテキストが所有するが遷移契機は貸出側にあるため、上流（蔵書）が下流（貸出）の要件に応える Customer-Supplier"
      source_model: "BUC: 書籍を貸し出すフロー, 書籍を返却するフロー, 状態: 書籍の状態, 条件: 貸出可否判定, 返却後の書籍状態判定"
      confidence: "medium"
    - id: "CM-002"
      from_bc_id: "BC-004"
      to_bc_id: "BC-001"
      pattern: "customer_supplier"
      direction: "downstream"
      translator_description: "予約コンテキストが書籍の状態（貸出中・予約待ち・在庫あり）を参照して予約可否を判定し、全予約取消時に書籍の状態を在庫ありへ戻すよう蔵書コンテキストに要求する"
      integration_events: []
      reason: "予約可否判定は書籍の状態に依存し、予約取消は書籍の状態遷移（予約待ち → 在庫あり）を引き起こす"
      source_model: "BUC: 書籍を予約するフロー, 状態: 書籍の状態, 条件: 予約可否判定"
      confidence: "medium"
    - id: "CM-003"
      from_bc_id: "BC-003"
      to_bc_id: "BC-002"
      pattern: "ohs"
      direction: "downstream"
      translator_description: "利用者コンテキストが利用者番号による利用者照会（登録済み判定・連絡先取得）を公開ホストサービスとして提供し、貸出コンテキストは公開モデルをそのまま利用する"
      integration_events: []
      reason: "利用者は貸出・予約・通知の 3 BC から参照される（下流が複数）ため、上流に OHS + Published Language を置く"
      source_model: "BUC: 書籍を貸し出すフロー, 情報: 利用者, 条件: 貸出可否判定"
      confidence: "medium"
    - id: "CM-004"
      from_bc_id: "BC-004"
      to_bc_id: "BC-002"
      pattern: "ohs"
      direction: "downstream"
      translator_description: "予約コンテキストが利用者番号で予約主体を参照する。利用者コンテキストの公開ホストサービスを利用"
      integration_events: []
      reason: "予約の主体は利用者番号で識別され、利用者は複数 BC から参照される"
      source_model: "BUC: 書籍を予約するフロー, 情報: 予約, 利用者"
      confidence: "medium"
    - id: "CM-005"
      from_bc_id: "BC-003"
      to_bc_id: "BC-004"
      pattern: "customer_supplier"
      direction: "downstream"
      translator_description: "貸出コンテキストが返却登録時に予約中の予約の有無と予約順位 1 位を予約コンテキストに問い合わせ（返却後の書籍状態判定）、予約待ち書籍の貸出登録時は順位 1 位の利用者に限定し、貸出登録で該当予約を完了させるよう要求する"
      integration_events: []
      reason: "返却 UC と貸出 UC が予約を参照し、貸出登録が予約の状態（通知済み → 終了）を変える。予約コンテキストが貸出の要件に応じたクエリと完了操作を提供する"
      source_model: "BUC: 書籍を返却するフロー, 書籍を貸し出すフロー, 状態: 予約の状態, 条件: 返却後の書籍状態判定, 貸出可否判定"
      confidence: "medium"
    - id: "CM-006"
      from_bc_id: "BC-005"
      to_bc_id: "BC-003"
      pattern: "conformist"
      direction: "downstream"
      translator_description: "通知コンテキストは貸出コンテキストが決めたリマインド対象・延滞判定結果（貸出 ID・利用者番号・返却期限）をそのまま受け取り、通知種別リマインド / 督促のメールを組み立てる。翻訳は行わない"
      integration_events: []
      reason: "送信対象の判定ロジック（リマインド対象判定・延滞判定）は貸出コンテキストが所有し、通知側は結果に従うのみ。影響力ゼロで受容可"
      source_model: "BUC: 返却期限を通知するフロー, 延滞者に督促するフロー, 条件: リマインド対象判定, 延滞判定, 情報: 通知"
      confidence: "medium"
    - id: "CM-007"
      from_bc_id: "BC-005"
      to_bc_id: "BC-004"
      pattern: "customer_supplier"
      direction: "downstream"
      translator_description: "通知コンテキストが返却通知対象（予約順位 1 位の予約）を予約コンテキストから取得し、送信後に予約の状態を予約中 → 通知済みへ遷移させるよう要求する"
      integration_events: []
      reason: "返却通知対象判定は予約順位 1 位を要し、送信結果が予約の状態遷移を引き起こす双方向の連携"
      source_model: "BUC: 書籍を返却するフロー, 条件: 返却通知対象判定, 状態: 予約の状態"
      confidence: "medium"
    - id: "CM-008"
      from_bc_id: "BC-005"
      to_bc_id: "BC-002"
      pattern: "ohs"
      direction: "downstream"
      translator_description: "通知コンテキストが利用者番号から送信先メールアドレスを利用者コンテキストの公開ホストサービス経由で取得する"
      integration_events: []
      reason: "通知は利用者番号を送信先の識別子とし、連絡先の正本は利用者コンテキストにある"
      source_model: "情報: 通知, 利用者"
      confidence: "medium"
    - id: "CM-009"
      from_bc_id: "BC-006"
      to_bc_id: "BC-003"
      pattern: "conformist"
      direction: "downstream"
      translator_description: "運営分析コンテキストが貸出記録（貸出日・書籍 ID）をそのまま読み取り、期間別貸出件数と書籍別貸出回数を集計する"
      integration_events: []
      reason: "貸出統計は貸出記録の読み取り専用集計であり、貸出コンテキストのモデルに追従してよい"
      source_model: "BUC: 蔵書の利用状況を分析するフロー, 情報: 貸出統計, 貸出, 条件: 集計期間判定, 人気書籍ランキング判定"
      confidence: "medium"
    - id: "CM-010"
      from_bc_id: "BC-006"
      to_bc_id: "BC-001"
      pattern: "conformist"
      direction: "downstream"
      translator_description: "運営分析コンテキストが書籍の状態とジャンルをそのまま読み取り、在庫状況一覧とランキング表示に用いる"
      integration_events: []
      reason: "在庫状況一覧は書籍の状態の参照ビューであり、蔵書コンテキストのモデルに追従してよい"
      source_model: "BUC: 蔵書の利用状況を分析するフロー, 情報: 書籍, ジャンル, 条件: 在庫状況判定"
      confidence: "medium"
  aggregate_hypotheses:
    - id: "AG-001"
      bounded_context_id: "BC-001"
      root_entity_id: "E-001"
      member_entity_ids: []
      invariants:
        - "貸出中・予約待ちの書籍は削除できない"
        - "媒体種別が電子の書籍は登録のみ可能で、貸出・予約の対象にできない（初期リリース）"
        - "書籍の状態は在庫あり・貸出中・予約待ちのいずれか 1 つ"
      note: "仮説。ジャンル（E-002）は複数書籍から参照されるマスタのため集約外の参照とする。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 書籍, 状態: 書籍の状態, 条件: 媒体種別判定, 在庫状況判定"
      confidence: "low"
    - id: "AG-002"
      bounded_context_id: "BC-002"
      root_entity_id: "E-003"
      member_entity_ids: []
      invariants:
        - "利用者番号は一意"
        - "利用者区分が利用者の場合、自分の利用者番号に紐づく貸出履歴・予約状況のみ閲覧できる"
      note: "仮説。2 件目はアクセス制御ルールでもあるため Part 1 の認可設計と重複させて扱う。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 利用者, 条件: 利用状況閲覧範囲判定, バリエーション: 利用者区分"
      confidence: "low"
    - id: "AG-003"
      bounded_context_id: "BC-003"
      root_entity_id: "E-004"
      member_entity_ids: []
      invariants:
        - "書籍の状態が在庫あり、かつ貸出先が登録済みの利用者である場合のみ貸出できる"
        - "予約待ちの書籍は予約順位 1 位の利用者に限り貸出できる"
        - "返却期限は貸出日に貸出期間を加算した日付とする（必須・自動設定）"
        - "貸出中で未返却かつ当日が返却期限を超過した貸出は延滞に遷移する"
        - "返却済みの貸出は状態を変更しない"
      note: "仮説。貸出 1 件 = 書籍 1 冊 × 利用者 1 人の記録で強整合範囲が完結する。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 貸出, 状態: 貸出の状態, 条件: 貸出可否判定, 返却期限算出, 延滞判定"
      confidence: "low"
    - id: "AG-004"
      bounded_context_id: "BC-003"
      root_entity_id: "E-005"
      member_entity_ids:
        - "E-006"
      invariants:
        - "貸出期間・リマインド日数は適用開始日時点で有効な値が 1 つ存在する"
      note: "仮説。貸出期間とリマインド日数は返却期限に関する業務パラメータとして 1 集約（貸出ポリシー設定）にまとめたが、独立した 2 つの設定エンティティとして扱う選択肢もある。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 貸出期間, リマインド日数, 条件: 返却期限算出, リマインド対象判定"
      confidence: "low"
    - id: "AG-005"
      bounded_context_id: "BC-004"
      root_entity_id: "E-007"
      member_entity_ids: []
      invariants:
        - "書籍の状態が在庫ありの書籍には予約できない"
        - "同一書籍の予約順位は受付日時の早い順に付与し、取消時は後続の予約中・通知済みの予約を繰り上げる"
        - "取消・終了した予約は順位の管理対象から外す"
      note: "仮説。予約順位の繰り上げは同一書籍の予約集合にまたがる整合性のため、書籍単位の予約リスト（予約帳）を集約 root とする代替案がある。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 予約, 状態: 予約の状態, 条件: 予約可否判定, 予約順位決定"
      confidence: "low"
    - id: "AG-006"
      bounded_context_id: "BC-005"
      root_entity_id: "E-008"
      member_entity_ids: []
      invariants:
        - "同一契機（対象貸出 ID / 対象予約 ID × 通知種別）に対する通知の重複送信と漏れを防ぐ"
        - "返却通知は予約中の予約がある場合のみ、予約順位 1 位の利用者に送信する"
      note: "仮説。通知は送信のたびに追記される記録（イベント寄り）で、単独集約として扱う。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 通知, 条件: 返却通知対象判定, バリエーション: 通知種別"
      confidence: "low"
    - id: "AG-007"
      bounded_context_id: "BC-006"
      root_entity_id: "E-009"
      member_entity_ids: []
      invariants: []
      note: "仮説。貸出統計は貸出記録からの派生データで不変条件を持たない。集約というより読み取りモデルとして扱う可能性が高い。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 貸出統計, 条件: 人気書籍ランキング判定, 集計期間判定"
      confidence: "low"
  diagram_mermaid: |
    graph LR
      BC1["蔵書コンテキスト"]
      BC2["利用者コンテキスト"]
      BC3["貸出コンテキスト"]
      BC4["予約コンテキスト"]
      BC5["通知コンテキスト"]
      BC6["運営分析コンテキスト"]
      BC3 -->|Customer-Supplier| BC1
      BC4 -->|Customer-Supplier| BC1
      BC3 -->|OHS+PL| BC2
      BC4 -->|OHS+PL| BC2
      BC3 -->|Customer-Supplier| BC4
      BC5 -->|Conformist| BC3
      BC5 -->|Customer-Supplier| BC4
      BC5 -->|OHS+PL| BC2
      BC6 -->|Conformist| BC3
      BC6 -->|Conformist| BC1
```

## system_architecture.tiers

```yaml
  tiers:
    - id: "tier-frontend-user"
      name: "利用者向けフロントエンド"
      description: "社外の利用者がインターネット経由で利用する Web UI。書籍検索・書籍詳細/在庫状況・予約申込/取消・マイ貸出履歴・マイ予約状況を提供する。管理機能は含めない"
      technology_candidates:
        - "SPA"
        - "レスポンシブ Web UI"
        - "CDN"
      policies:
        - id: "SP-001"
          name: "マルチ OS・マルチブラウザ・PC/タブレット対応"
          description: "Windows / macOS 上の Chrome / Edge / Safari 最新版と、PC およびタブレットの画面幅に対応するレスポンシブ UI を提供する。スマートフォン対応は要確認とする"
          reason: "社外の利用者が自身の端末のブラウザから利用するため、単一 OS・単一ブラウザの指定は現実的でない"
          source_model: "アクター: 利用者（社外）, NFR F.1.1.1, NFR F.1.1.2, NFR F.1.1.3"
          confidence: "medium"
        - id: "SP-002"
          name: "利用者向け画面のレスポンス目標"
          description: "検索・予約・利用状況照会の画面操作は 5 秒以内に応答する。コード分割による初期ロード軽量化、静的資産の CDN 配信とブラウザキャッシュ、一覧のページネーションを標準とする"
          reason: "一般利用者向け画面の応答基準 5 秒以内が NFR で定義されている"
          source_model: "UC: 書籍を検索する / 予約を登録する / 貸出履歴を参照する, NFR B.2.1.1, NFR B.1.2.1"
          confidence: "medium"
        - id: "SP-003"
          name: "公開機能の限定"
          description: "インターネットへ公開するのは利用者向けの検索・予約・利用状況照会のみとする。蔵書・利用者の管理機能や貸出・返却登録は本ティアに含めない"
          reason: "利用制限で司書向け管理機能は館内ネットワーク限定、利用者向け機能はインターネット公開と機能ごとに接続元を分ける方針が定められている"
          source_model: "アクター: 司書（社内）/ 利用者（社外）, NFR E.5.3.1"
          confidence: "medium"
        - id: "SP-004"
          name: "アクセシビリティ目標"
          description: "利用者向け画面は JIS X 8341-3:2016 レベル AA 準拠を目標とし、キーボード操作・コントラスト・スクリーンリーダー対応を設計基準に含める"
          reason: "社外の一般利用者向けに公開する図書館システムとして望ましいが、RDRA に明示はなく弱い推論"
          source_model: "アクター: 利用者（社外）, NFR F.3.1.2"
          confidence: "low"
      rules:
        - id: "SR-001"
          name: "API 経由のデータアクセス"
          description: "フロントエンドからデータストアへの直接アクセスを禁止し、必ず API Gateway 経由で Backend API を呼び出す"
          reason: "セキュリティとデータ整合性の確保"
          source_model: "なし"
          confidence: "default"
        - id: "SR-002"
          name: "ブラウザ側に個人情報・認証情報を永続化しない"
          description: "利用者の氏名・連絡先・貸出履歴やアクセストークンを localStorage 等に永続保存しない。トークンはメモリ保持または HttpOnly / Secure Cookie で扱う"
          reason: "貸出履歴は思想信条を推知しうる要配慮情報に準じ、端末側への残留を避ける必要がある"
          source_model: "情報: 利用者 / 貸出, NFR E.1.2.1, NFR E.6.1.1"
          confidence: "medium"
        - id: "SR-003"
          name: "Web アプリケーション脆弱性対策"
          description: "出力エスケープによる XSS 対策、CSRF トークン、Content Security Policy をフレームワーク標準機能で適用し、リリース前に自動診断を実施する"
          reason: "利用者入力（キーワード・ISBN 等）を扱う公開画面があるため"
          source_model: "UC: 書籍を検索する, NFR E.10.2.1, NFR E.3.1.1"
          confidence: "medium"
    - id: "tier-frontend-staff"
      name: "司書向けフロントエンド"
      description: "館内ネットワークから司書が利用する管理 Web UI。蔵書管理・利用者管理・貸出/返却受付・返却通知送信・予約状況・延滞/督促状況・在庫状況/人気書籍ランキング/期間別貸出統計を提供する"
      technology_candidates:
        - "SPA"
        - "レスポンシブ Web UI"
      policies:
        - id: "SP-005"
          name: "館内ネットワーク限定公開"
          description: "司書向け画面は館内ネットワークからのみ到達可能とし、インターネットへ公開しない。API Gateway の経路制御と組み合わせて接続元を制限する"
          reason: "司書は社内アクターであり、管理機能は館内限定で利用する方針が定められている"
          source_model: "アクター: 司書（社内・提供者）, NFR E.5.3.1"
          confidence: "medium"
        - id: "SP-006"
          name: "窓口業務の操作効率と集計画面の応答目標"
          description: "貸出受付・返却受付は利用者番号と書籍 ID の入力から最少操作で完了できる画面とする。在庫状況一覧・人気書籍ランキング・期間別貸出統計は集計要求から 10 秒以内に表示する"
          reason: "貸出・返却は窓口のリアルタイム処理であり、集計画面は管理者向け基準 10 秒以内が定義されている"
          source_model: "BUC: 書籍を貸し出すフロー / 書籍を返却するフロー / 蔵書の利用状況を分析するフロー, NFR B.2.1.3, NFR A.4.1.2"
          confidence: "medium"
      rules:
        - id: "SR-004"
          name: "API 経由のデータアクセス"
          description: "フロントエンドからデータストアへの直接アクセスを禁止し、必ず API Gateway 経由で Backend API を呼び出す"
          reason: "セキュリティとデータ整合性の確保"
          source_model: "なし"
          confidence: "default"
        - id: "SR-005"
          name: "状態変更操作の確認ステップとダブルサブミット防止"
          description: "書籍削除・利用者削除・貸出登録・返却登録・返却通知送信は確認画面を経由し、送信中はボタンを無効化する。送信には冪等キーを付与する"
          reason: "RDRA に削除確認画面・返却通知送信確認画面が定義されており、状態遷移を伴う操作の重複を防ぐ必要がある"
          source_model: "BUC: 蔵書を管理するフロー / 書籍を返却するフロー, 画面: 書籍削除確認画面 / 返却通知送信確認画面"
          confidence: "medium"
    - id: "tier-api-gateway"
      name: "API Gateway"
      description: "2 系統のフロントエンドから Backend API への入口。TLS 終端、WAF、IdP 発行トークンの検証、粗粒度 RBAC、公開経路 / 館内経路の分離、レート制限を担う"
      technology_candidates:
        - "API Gateway / リバースプロキシ"
        - "WAF"
        - "LB"
      policies:
        - id: "SP-007"
          name: "公開経路と館内経路の分離"
          description: "利用者向け API（検索・予約・利用状況照会）はインターネットから、司書向け API（蔵書・利用者管理、貸出・返却登録、分析）は館内ネットワークからのみ受け付ける。経路ごとに接続元 IP 制限を設定する"
          reason: "機能ごとに接続元を分ける利用制限と、DMZ / 内部セグメント分離の方針を入口で集約して実現する"
          source_model: "アクター: 司書（社内）/ 利用者（社外）, NFR E.5.3.1, NFR E.8.3.1"
          confidence: "medium"
        - id: "SP-008"
          name: "WAF マネージドルールの適用"
          description: "公開経路の前段にマネージドルールセットのデフォルト適用による WAF を置く。カスタムルール運用は初期リリースでは行わない"
          reason: "利用者向け検索・予約画面を社外へ公開するため WAF なしは避ける。小規模のためカスタムルール運用は過剰"
          source_model: "アクター: 利用者（社外）, NFR E.10.1.1"
          confidence: "medium"
        - id: "SP-009"
          name: "トークン検証と粗粒度 RBAC"
          description: "IdP が発行したアクセストークンを検証し、トークン内の利用者区分クレーム（司書 / 利用者）で API 経路単位の粗粒度アクセス制御を行う。本人限定などの細粒度判定は Backend API に委ねる"
          reason: "利用者区分による役割別の操作範囲切替が RDRA と NFR の双方で明示されている"
          source_model: "バリエーション: 利用者区分, 条件: 利用状況閲覧範囲判定, NFR E.5.2.1, NFR E.5.1.1"
          confidence: "high"
        - id: "SP-010"
          name: "レート制限"
          description: "公開経路に接続元単位のレート制限を設定し、ピーク時（通常の 2 倍）を超える突発負荷と総当たり攻撃の緩和を行う。認証エンドポイントは IdP のアカウントロックと併用する"
          reason: "返却通知直後の予約者アクセス集中と、Web ログインへの総当たり攻撃の基本対策が必要"
          source_model: "NFR B.1.2.1, NFR E.7.2.1"
          confidence: "medium"
      rules:
        - id: "SR-006"
          name: "TLS 終端と内部通信の再暗号化"
          description: "API Gateway で TLS1.2 以上を終端し、Backend API への内部通信も TLS で再暗号化する"
          reason: "内部通信を含む全通信暗号化が NFR で定義されている"
          source_model: "NFR E.6.1.2, NFR F.1.2.1"
          confidence: "high"
        - id: "SR-007"
          name: "アクセスログの出力と trace_id の付与"
          description: "全リクエストについて trace_id・認証主体（user_id）・経路・応答コード・処理時間をアクセスログとして構造化出力する。フロントエンドが trace_id を付与していない場合は Gateway で生成する"
          reason: "アクセスログ＋監査ログの取得と横断トレーサビリティの起点が必要"
          source_model: "NFR C.6.1.2, NFR E.7.1.1, NFR C.1.3.1"
          confidence: "medium"
    - id: "tier-idp"
      name: "IdP"
      description: "司書・利用者の認証を担うアイデンティティプロバイダー。ID/パスワード認証、パスワードポリシー、アカウントロック、OAuth2/OIDC によるトークン発行を行う"
      technology_candidates:
        - "セルフホスト IdP"
        - "OAuth2/OIDC"
      policies:
        - id: "SP-011"
          name: "パスワードポリシー付き ID/パスワード認証"
          description: "利用者番号（または司書 ID）とパスワードによる認証を行い、複雑性・有効期限のパスワードポリシーを適用する。MFA および外部 IdP 連携は初期リリースでは採用しない"
          reason: "本人限定の情報を Web で参照するためパスワードポリシー付き認証を要するが、外部 IdP 連携や MFA は RDRA になく過剰"
          source_model: "アクター: 司書 / 利用者, 条件: 利用状況閲覧範囲判定, NFR E.5.1.1"
          confidence: "medium"
        - id: "SP-012"
          name: "ログイン失敗の連続検知とアカウントロック"
          description: "一定回数のログイン失敗でアカウントを一時ロックし、ロック・解除をログに記録する"
          reason: "利用者番号とパスワードによる Web ログインへの総当たり攻撃の基本対策"
          source_model: "アクター: 利用者（社外）, NFR E.7.2.1"
          confidence: "medium"
        - id: "SP-013"
          name: "認証情報の保護"
          description: "パスワードはソルト付きハッシュで保管し、トークン署名鍵等の認証情報は暗号化して保管する"
          reason: "認証情報は保管時暗号化の対象として明示されている"
          source_model: "NFR E.6.1.1"
          confidence: "high"
      rules:
        - id: "SR-008"
          name: "ログイン / ログアウトの監査ログ"
          description: "ログイン成功・失敗、ログアウト、パスワード変更、アカウントロックを user_id・接続元・時刻とともに監査ログに記録する"
          reason: "ログイン / ログアウト＋データアクセスログの監査ログ取得が定義されている"
          source_model: "NFR E.7.1.1, NFR C.6.1.2"
          confidence: "high"
        - id: "SR-009"
          name: "利用者区分クレームの発行"
          description: "発行するトークンに主体識別子（利用者番号）と利用者区分（司書 / 利用者）をクレームとして含め、API Gateway と Backend API の認可判定に用いる"
          reason: "利用者区分により操作範囲と閲覧範囲を切り替えるため、認証結果として役割を伝搬する必要がある"
          source_model: "バリエーション: 利用者区分, 情報: 利用者, NFR E.5.2.1"
          confidence: "medium"
    - id: "tier-backend-api"
      name: "Backend API"
      description: "蔵書 / 利用者 / 貸出 / 予約 / 通知 / 運営分析の 6 BC をモジュールとして内包するモジュラモノリス API。UC の同期処理、本人限定判定、3 状態モデルの遷移、通知メッセージの MQ 発行を担う"
      technology_candidates:
        - "CaaS(k8s)"
        - "コンテナ + LB"
      policies:
        - id: "SP-014"
          name: "モジュラモノリス構成"
          description: "6 つの BC を 1 デプロイ単位内の独立モジュールとして実装し、モジュール間は公開インタフェース（コンテキストマップの OHS / Customer-Supplier に対応）経由でのみ依存する。媒体種別（電子書籍）を拡張点として設計する"
          reason: "1 館・9 エンティティ・27 UC の小規模で分散化の根拠はないが、6 コンテキストへの分割と将来の電子書籍対応が拡張性要件として明示されている"
          source_model: "BC: BC-001〜BC-006, バリエーション: 媒体種別, NFR F.2.2.1, NFR B.1.1.1"
          confidence: "medium"
        - id: "SP-015"
          name: "ステートレスな水平スケールアウト構成"
          description: "API プロセスはセッション状態を持たず、N+1 の複数インスタンスを LB 配下で稼働させる。利用者増に対してはインスタンス追加でスケールアウトする"
          reason: "社外公開のため利用者増に備えるスケールアウトと、サーバ内 N+1 冗長が定義されている"
          source_model: "アクター: 利用者（社外）, NFR B.3.1.1, NFR A.2.1.1, NFR B.2.1.2"
          confidence: "medium"
        - id: "SP-016"
          name: "本人限定アクセスの Backend 作り込み"
          description: "利用者区分が利用者の場合、貸出履歴・予約状況・予約取消はトークンの利用者番号と対象データの利用者番号が一致する場合のみ許可する。司書は利用者番号を指定して任意の利用者を参照できる。個人情報を扱う利用者・通知モジュールは厳格側に倒し、判定結果をデータアクセスログに残す"
          reason: "唯一のアクセス制御条件が所有権ベースであり、認可パターン数が少ないため Backend の作り込みで十分。ただし利用者・通知は個人情報の正本のため厳格認可を必須とする"
          source_model: "条件: 利用状況閲覧範囲判定, 情報: 利用者 / 通知, NFR E.5.2.1, NFR E.7.1.1"
          confidence: "high"
        - id: "SP-017"
          name: "メール送信の非同期化"
          description: "返却通知の送信要求は通知レコードを作成して MQ へ発行し、API 応答は外部メール配信サービスの結果を待たない。送信結果はワーカーが通知レコードに反映する"
          reason: "外部サービス呼び出しを同期にすると 5 秒以内の応答目標と可用性が外部サービスに依存するため"
          source_model: "UC: 返却通知を送信する, 外部システム: メール配信サービス, NFR B.2.1.1, NFR A.1.2.1"
          confidence: "medium"
        - id: "SP-018"
          name: "越境状態遷移の同期トランザクション"
          description: "貸出登録・返却登録・予約取消など複数集約（書籍・貸出・予約）に波及する状態遷移は、単一 RDB トランザクション内で同期的に整合させる。結果整合（ドメインイベント）は採用しない"
          reason: "1 館規模で同時更新競合は小さく、3 状態モデル間の不整合は窓口混乱と復旧作業の負担に直結する"
          source_model: "状態: 書籍の状態, 貸出の状態, 予約の状態, 条件: 返却後の書籍状態判定, NFR A.4.1.1, NFR C.3.3.1"
          confidence: "medium"
      rules:
        - id: "SR-010"
          name: "データアクセス監査ログ"
          description: "利用者・貸出・予約・通知の参照と更新について、user_id・操作種別・対象エンティティ ID・認可判定結果を監査ログに記録する。本文や連絡先などの値自体は記録しない"
          reason: "本人限定参照の逸脱を検知する監査ログが必要"
          source_model: "条件: 利用状況閲覧範囲判定, NFR E.7.1.1, NFR C.6.1.2"
          confidence: "high"
        - id: "SR-011"
          name: "入力検証とパラメータ化クエリ"
          description: "検索条件種別ごとに入力を検証し、DB アクセスは必ずパラメータ化クエリで行う"
          reason: "利用者入力を検索条件に用いるためインジェクション対策が必須"
          source_model: "UC: 書籍を検索する, 条件: 書籍検索条件判定, NFR E.10.2.1"
          confidence: "medium"
        - id: "SR-012"
          name: "業務パラメータの外部化"
          description: "貸出期間・リマインド日数はコードに埋め込まず、適用開始日つきの設定データとして RDB で管理し、返却期限算出・リマインド対象判定はその時点の有効値を参照する"
          reason: "貸出期間・リマインド日数が業務パラメータとして情報モデルに定義されている"
          source_model: "情報: 貸出期間 / リマインド日数, 条件: 返却期限算出 / リマインド対象判定"
          confidence: "high"
    - id: "tier-worker"
      name: "ワーカー"
      description: "日次バッチ（リマインド対象抽出・リマインド送信、延滞判定・督促送信）と、MQ から通知メッセージを受け取りメール配信サービス経由で送信する非同期ワーカー"
      technology_candidates:
        - "CronJob(k8s)"
        - "MQ"
        - "コンテナワーカー"
      policies:
        - id: "SP-019"
          name: "日次バッチのスケジュール枠"
          description: "リマインド対象抽出・延滞判定は夜間〜早朝の 8 時間枠内に完了させ、バックアップ時間帯（1 時〜4 時）とは重ならない時刻に起動する。運用時間外（8 時〜9 時）の計画停止枠とも分離する"
          reason: "日次バッチはリマインド・督促の当日送信に間に合えばよく、バックアップと時間帯を分離する方針が定められている"
          source_model: "アクター: タイマー, BUC: 返却期限を通知するフロー / 延滞者に督促するフロー, NFR B.2.2.1, NFR C.1.1.2, NFR A.1.1.1"
          confidence: "medium"
        - id: "SP-020"
          name: "Queue-Based Load Leveling と DLQ"
          description: "メール送信は MQ を介したワーカーで処理し、送信失敗は指数バックオフで再試行、規定回数超過は DLQ へ退避して手動再処理する。ワーカーは Competing Consumers として水平スケール可能にする"
          reason: "バッチ起点の一括送信と返却通知の突発送信を平準化し、外部サービス障害時の送信漏れを防ぐ"
          source_model: "BUC: 返却期限を通知するフロー / 延滞者に督促するフロー, 情報: 通知（送信結果）, NFR B.1.2.1, NFR B.2.2.2"
          confidence: "medium"
        - id: "SP-021"
          name: "バッチ完了とキュー滞留の監視"
          description: "日次バッチの開始・終了・処理件数・失敗件数を構造化ログとメトリクスで出力し、未完了・失敗・キュー滞留・DLQ 到達をアラート対象とする"
          reason: "日次バッチの完了とメール送信結果をアプリケーション層で監視する必要がある"
          source_model: "NFR C.1.3.1, NFR C.3.1.1, アクター: タイマー"
          confidence: "medium"
        - id: "SP-030"
          name: "中断許容ワークロードとしてのコスト最適化"
          description: "キュー消費ワーカー・スケジュール実行ワーカーはスポット/プリエンプティブルインスタンスの利用を第一候補とする。中断時は SIGTERM 受信での可視性タイムアウト解放とリトライ、冪等消費（SR-013）・再実行可能性（SR-014）を前提に安全に再処理する"
          reason: "インフラ設計（MCL product-design）の結果に基づく: 通知送信・日次バッチは即時性要求が低く中断を許容できるため、コスト最適化の余地が大きい"
          source_model: "infra: product-cost-hints.yaml → spot_candidates[worker_consumer, worker_scheduled]"
          confidence: "medium"
      rules:
        - id: "SR-013"
          name: "通知の重複送信防止"
          description: "対象貸出 ID / 対象予約 ID × 通知種別 × 送信日を一意キーとして通知レコードを作成してから送信し、MQ の MessageId とジョブ実行 ID で重複処理を検知する"
          reason: "通知の重複や漏れを防ぐ要件が情報モデルに定義されている"
          source_model: "情報: 通知, 条件: リマインド対象判定 / 延滞判定, NFR B.1.1.4"
          confidence: "high"
        - id: "SR-014"
          name: "バッチの再実行可能性"
          description: "バッチは途中失敗時に未処理分のみを再処理できるよう、対象抽出と送信を分離し、処理済みを通知レコードで判定する。〜10 万件を想定してチャンク分割で処理する"
          reason: "1 回あたり〜10 万件の走査を 8 時間枠内で完了させ、失敗時の再実行を安全にする"
          source_model: "UC: リマインド対象を抽出する / 延滞を判定する, NFR B.1.1.4, NFR B.2.2.1"
          confidence: "medium"
    - id: "tier-datastore"
      name: "データストア"
      description: "業務データの正本となる RDB、冪等キー・セッション・参照系キャッシュを保持する KVS、バックアップの遠隔地保管に用いる Object Storage"
      technology_candidates:
        - "RDB"
        - "KVS"
        - "Object Storage"
      policies:
        - id: "SP-022"
          name: "RDB を正本とする強整合"
          description: "書籍・利用者・貸出・予約・通知・貸出統計・業務パラメータは RDB に保持し、3 状態モデルの遷移はトランザクションで整合させる。KVS は正本を持たず、冪等キー・セッション・キャッシュに限定する"
          reason: "状態モデル間の整合性が求められ、金銭取引はないが当日の貸出・予約記録の消失は窓口混乱を招く"
          source_model: "情報: 書籍 / 貸出 / 予約 / 通知, 状態: 書籍の状態, 貸出の状態, 予約の状態, NFR B.1.1.2"
          confidence: "high"
        - id: "SP-023"
          name: "冗長化・バックアップ・復旧目標"
          description: "RDB は N+1 冗長（手動切替、切替 60 分未満）とパリティ相当のストレージ冗長で構成し、日次フル＋差分バックアップにトランザクションログ退避を組み合わせて RPO 数時間・RTO 2 時間を満たす。バックアップは 7 世代を保持し、Object Storage で遠隔地に保管する。復旧後は平常時 80% 以上の処理能力を確保する"
          reason: "可用性・回復性・災害対策・バックアップ方式の NFR を満たす最小構成"
          source_model: "NFR A.2.1.1, NFR A.2.5.1, NFR A.1.2.1, NFR A.4.1.1, NFR A.4.1.2, NFR A.4.1.3, NFR A.3.1.1, NFR A.3.1.2, NFR C.1.2.1, NFR C.1.2.2, NFR C.1.2.3"
          confidence: "medium"
        - id: "SP-024"
          name: "機密データの保管時暗号化"
          description: "利用者の氏名・連絡先（メールアドレス・電話番号・住所）、認証情報、貸出履歴、通知の送信先・本文を保管時暗号化の対象とする。全データ暗号化は行わない"
          reason: "個人情報を含む列に限定した保管時暗号化が定義されている"
          source_model: "情報: 利用者 / 貸出 / 通知, NFR E.6.1.1"
          confidence: "high"
        - id: "SP-025"
          name: "内部セグメントへの配置"
          description: "RDB / KVS は内部セグメントに配置し、インターネットおよび DMZ から直接到達できないようにする。Backend API・ワーカーからのみ接続を許可する"
          reason: "個人情報を保持する DB を社外の利用者から直接到達させない"
          source_model: "情報: 利用者, アクター: 利用者（社外）, NFR E.8.3.1"
          confidence: "medium"
        - id: "SP-026"
          name: "ストレージのオンライン拡張"
          description: "RDB とバックアップ領域は無停止でボリューム追加できる構成とする。年間〜100 万件・総容量 100GB 未満を初期サイズとする"
          reason: "データ量は小規模だがオンライン拡張が定義されている"
          source_model: "NFR B.3.3.1, NFR B.1.1.2"
          confidence: "default"
      rules:
        - id: "SR-015"
          name: "テスト・開発環境へのデータマスキング"
          description: "本番データをテスト環境・開発環境へ複製する際は、利用者の氏名・連絡先・通知の送信先/本文を匿名化データに置換する"
          reason: "個人情報をテスト環境へそのまま複製しないための措置"
          source_model: "情報: 利用者 / 通知, NFR E.6.2.1, NFR C.4.1.1, NFR C.4.2.1"
          confidence: "medium"
        - id: "SR-016"
          name: "初期データ移行"
          description: "紙台帳・表計算ファイルの書籍・ジャンル・利用者データを休館日に一括移行する。ISBN・ジャンル・媒体種別・利用者区分の正規化と、ISBN 重複・メールアドレス欠損のクレンジングを移行前に行い、リハーサルを 1 回実施して件数一致とサンプル突合で判定する。失敗時は既存運用へ戻す"
          reason: "移行元が紙台帳と表計算ファイルであり、一括移行・〜100GB・リハーサル 1 回が定義されている"
          source_model: "システム概要: 紙台帳と表計算ファイル, 情報: 書籍 / ジャンル / 利用者, NFR D.1.1.1, NFR D.2.1.1, NFR D.4.1.1, NFR D.4.1.2, NFR D.4.1.3, NFR D.5.1.1, NFR D.5.1.2, NFR D.5.1.3"
          confidence: "medium"
    - id: "tier-external-integration"
      name: "外部連携"
      description: "メール配信サービスへの送信を担うアダプタ。通知コンテキストの ACL としてメール配信サービスの API モデルを通知記録の語彙に翻訳し、回復性パターンを適用する"
      technology_candidates:
        - "HTTPS API クライアント"
        - "SMTPS クライアント"
        - "ACL アダプタ"
      policies:
        - id: "SP-027"
          name: "ACL によるドメインモデル保護"
          description: "メール配信サービスの宛先・件名・本文・送信結果の表現を通知コンテキストの語彙に翻訳し、外部サービス固有のモデルを Backend API・ワーカーのドメインへ持ち込まない。サービス差し替え時の影響を本ティアに閉じ込める"
          reason: "外部システムは通知系のメール配信サービス 1 つであり、Generic サブドメインとして隔離する"
          source_model: "外部システム: メール配信サービス, BC: BC-005, 情報: 通知（送信結果）"
          confidence: "medium"
        - id: "SP-028"
          name: "Retry + Circuit Breaker + Timeout"
          description: "送信呼び出しにタイムアウトを設定し、一時障害は指数バックオフ＋Jitter で再試行、継続障害はサーキットブレーカーで遮断して通知レコードを送信失敗として保留する。Timeout はサーキットブレーカーの閾値時間より短くする"
          reason: "外部サービス障害時に API・ワーカーへ障害を連鎖させず、サービス切替 60 分未満の可用性目標を守る"
          source_model: "外部システム: メール配信サービス, NFR A.1.2.1, NFR A.2.1.1"
          confidence: "medium"
        - id: "SP-029"
          name: "送信結果の記録と監視"
          description: "メール配信サービスからの応答を通知レコードの送信結果に反映し、失敗率とサーキットブレーカーの Open 状態をアプリケーション監視の対象とする"
          reason: "送信結果と日次バッチの完了をアプリケーション層で監視する要件がある"
          source_model: "情報: 通知（送信結果）, NFR C.1.3.1, NFR C.3.1.1"
          confidence: "medium"
      rules:
        - id: "SR-017"
          name: "外部通信の暗号化"
          description: "メール配信サービスとの通信は HTTPS（TLS1.2 以上）または SMTPS に限定する"
          reason: "外部システムとの通信を含む全通信暗号化と通信プロトコルが定義されている"
          source_model: "NFR E.6.1.2, NFR F.1.2.1"
          confidence: "high"
        - id: "SR-018"
          name: "再試行対象の限定"
          description: "認証エラー・宛先不正などの 4xx 系エラーは再試行せず送信失敗として記録する。再試行は通知 ID を冪等キーとして行い、同一通知の二重送信を防ぐ"
          reason: "恒久的な障害の再試行は無駄であり、冪等でない送信の重複は利用者への迷惑メールとなる"
          source_model: "情報: 通知, NFR A.1.2.1"
          confidence: "default"
        - id: "SR-019"
          name: "外部サービス認証情報の秘匿"
          description: "メール配信サービスの API キー等はシークレット管理機構で保管し、コードやログに含めない"
          reason: "認証情報の保管時暗号化が定義されている"
          source_model: "NFR E.6.1.1"
          confidence: "default"
```

## app_architecture.tier_layers

```yaml
  tier_layers:
    - tier_id: "tier-backend-api"
      layers:
        - id: "L-backend-api-presentation"
          name: "プレゼンテーション層"
          responsibility: "Driver Side の入出力。REST リクエスト/レスポンスの変換、入力バリデーション、トークンからの認可コンテキスト（user_id・利用者区分）抽出、アクセスログ出力と trace_id の後続伝播"
          allowed_dependencies:
            - "L-backend-api-usecase"
          policies:
            - id: "LP-001"
              name: "API 境界での入力バリデーション"
              description: "検索条件種別・ISBN 形式・媒体種別・利用者番号・書籍 ID など全入力を API 境界でスキーマ検証する。ビジネスルール（貸出可否・予約可否など）は domain 層に委ね、ここでは型・形式・必須のみ検証する"
              reason: "利用者入力を検索条件や登録値に用いる UC が多く、インジェクション対策と不正値の早期排除が必要"
              source_model: "条件: 書籍検索条件判定 / 媒体種別判定 / 貸出可否判定, UC: 書籍を検索する / 書籍を登録する, NFR E.10.2.1"
              confidence: "high"
            - id: "LP-002"
              name: "アクセスログと trace_id 伝播"
              description: "全リクエストのメソッド・パス・user_id・応答コード・処理時間を構造化アクセスログとして出力する。API Gateway が付与した trace_id を受け取り、無ければ生成して usecase 以降と MQ メッセージへ伝播する"
              reason: "アプリケーション監視とアクセスログ＋監査ログ種別が定義され、社外アクターからのリクエストを横断追跡する必要がある"
              source_model: "アクター: 利用者（社外）, NFR C.1.3.1, NFR C.6.1.2"
              confidence: "medium"
            - id: "LP-003"
              name: "認可コンテキストの抽出"
              description: "検証済みトークンから user_id（利用者番号 / 司書 ID）と利用者区分を取り出し、usecase の入力として明示的に渡す。presentation 層ではロール判定を行わず、本人限定の判定は usecase / domain に委ねる"
              reason: "唯一のアクセス制御条件が所有権ベース（本人限定）であり、判定はデータを知る usecase 以降で行う設計とした"
              source_model: "条件: 利用状況閲覧範囲判定, バリエーション: 利用者区分, NFR E.5.2.1"
              confidence: "high"
            - id: "LP-004"
              name: "トークン期限接近ログ"
              description: "受信したアクセストークンの残有効期間がしきい値以下の場合に WARN レベルで劣化兆候ログを出力する。しきい値は設定ファイルから読み込む"
              reason: "社外アクターが IdP 発行トークンで利用するため、期限切れ直前の失敗集中を検知したい。ただし運用上の必要性は弱い推論"
              source_model: "アクター: 利用者（社外）, NFR E.5.1.1"
              confidence: "low"
          rules:
            - id: "LR-001"
              name: "HTTP ステータス変換"
              description: "usecase から伝播した例外を HTTP ステータスに変換する（不変条件違反 = 409 / 422、本人限定違反 = 403、未存在 = 404、技術例外 = 500）。ログ出力はここでは行わない"
              reason: "エラーハンドリング伝播方針でログ出力の集約ポイントを usecase 層に置くため"
              source_model: "なし"
              confidence: "default"
            - id: "LR-002"
              name: "冪等キーの受付"
              description: "貸出登録・返却登録・返却通知送信・予約登録・予約取消の更新 API は Idempotency-Key ヘッダを必須とし、KVS で既処理を照合して同一キーには同一応答を返す"
              reason: "確認画面からの再送・ダブルサブミットによる状態遷移の重複を防ぐ"
              source_model: "画面: 書籍削除確認画面 / 返却通知送信確認画面, 状態: 書籍の状態, 貸出の状態, 予約の状態"
              confidence: "medium"
        - id: "L-backend-api-usecase"
          name: "ユースケース層"
          responsibility: "UC 単位のビジネスフロー制御。トランザクション境界、本人限定判定、監査ログ出力、エラーログの集約ポイント、通知メッセージの発行契機"
          allowed_dependencies:
            - "L-backend-api-domain"
            - "L-backend-api-repository"
          policies:
            - id: "LP-005"
              name: "越境状態遷移の単一トランザクション"
              description: "貸出登録・返却登録・予約取消のように書籍・貸出・予約の複数集約に波及する状態遷移は、1 つの usecase が 1 つの RDB トランザクション内で同期的に整合させる。集約ごとに repository を呼び、コミットは usecase が行う"
              reason: "3 状態モデルが同期波及し、不整合は窓口混乱と復旧作業の負担に直結する。1 館規模で同時更新競合は小さい"
              source_model: "状態: 書籍の状態, 貸出の状態, 予約の状態, 条件: 返却後の書籍状態判定 / 予約順位決定, NFR A.4.1.1, NFR C.3.3.1"
              confidence: "high"
            - id: "LP-006"
              name: "監査ログ（状態遷移とデータアクセス）"
              description: "状態遷移を伴う UC（貸出登録・返却登録・予約登録・予約取消・返却通知送信・書籍削除・利用者削除）と、利用者・貸出・予約・通知の参照 UC について、user_id・操作種別・対象エンティティ ID・遷移前後の状態・認可判定結果を監査ログに記録する。氏名・連絡先・本文などの値は記録しない"
              reason: "監査ログ Lv2（ログイン＋データアクセスログ）と本人限定参照の逸脱検知が定義されている"
              source_model: "状態: 書籍の状態, 貸出の状態, 予約の状態, 条件: 利用状況閲覧範囲判定, NFR E.7.1.1, NFR C.6.1.2"
              confidence: "high"
            - id: "LP-007"
              name: "本人限定判定の作り込み"
              description: "利用者区分が利用者の場合、貸出履歴・予約状況の参照と予約取消は対象データの利用者番号が認可コンテキストの user_id と一致する場合のみ許可する。司書は任意の利用者番号を指定できる。個人情報の正本である利用者・通知モジュールは判定を厳格側（不一致は 403 かつ監査ログ）に倒す"
              reason: "認可パターン A（RBAC + Backend 作り込み）を採用し、所有権ベース条件を usecase で実装する"
              source_model: "条件: 利用状況閲覧範囲判定, 情報: 利用者 / 通知, NFR E.5.2.1, NFR E.7.1.1"
              confidence: "high"
            - id: "LP-008"
              name: "通知メッセージの発行契機"
              description: "返却通知の送信要求は usecase が通知レコード（送信待ち）を同一トランザクションで作成し、コミット後に gateway 経由で MQ へ発行する。外部メール配信サービスの結果は待たず、送信結果の反映はワーカーの責務とする"
              reason: "外部サービス呼び出しを API 応答から切り離し、5 秒以内の応答目標と可用性を外部に依存させない"
              source_model: "UC: 返却通知を送信する, 情報: 通知（送信結果）, NFR B.2.1.1, NFR A.1.2.1"
              confidence: "medium"
            - id: "LP-009"
              name: "エラーログの集約ポイント"
              description: "domain / repository から伝播した例外はこの層で 1 回だけ ERROR または WARN（不変条件違反は WARN）で構造化ログに出力し、cause chain を context に含めて presentation へ再スローする"
              reason: "多重ログを防ぎ、UC 単位でエラーを一意に追跡できるようにする"
              source_model: "NFR C.1.3.1, NFR C.6.1.2"
              confidence: "medium"
          rules:
            - id: "LR-003"
              name: "モジュール間は公開インタフェース経由"
              description: "他 BC モジュールのデータが必要な場合は、その BC の公開インタフェース（コンテキストマップの OHS / Customer-Supplier に対応する usecase API）を呼び出す。他モジュールの repository / adapter を直接参照しない"
              reason: "モジュラモノリスの境界を守り、将来の分割余地を残す"
              source_model: "BC: BC-001〜BC-006, CM: CM-001〜CM-010, NFR F.2.2.1"
              confidence: "medium"
            - id: "LR-004"
              name: "業務パラメータはその時点の有効値を参照"
              description: "返却期限算出・リマインド対象判定に用いる貸出期間・リマインド日数は、usecase が repository から処理日時点の有効値を取得して domain に渡す。domain 層はパラメータを自ら取得しない"
              reason: "業務パラメータが適用開始日つきの設定データとして情報モデルに定義されている"
              source_model: "情報: 貸出期間 / リマインド日数, 条件: 返却期限算出 / リマインド対象判定"
              confidence: "high"
        - id: "L-backend-api-domain"
          name: "ドメイン層"
          responsibility: "ビジネスルール、エンティティ、値オブジェクト、状態遷移、不変条件の検証、ドメイン例外。BC ごとのモジュールに分割し、ワーカーと共有する"
          allowed_dependencies: []
          policies:
            - id: "LP-010"
              name: "状態遷移の整合性保証"
              description: "書籍の状態・貸出の状態・予約の状態の遷移はエンティティのメソッドとして実装し、許可されない遷移（例: 返却済みからの変更、在庫ありの書籍への予約）はドメイン例外とする。遷移表は状態.tsv と 1:1 で対応させる"
              reason: "3 つの状態モデルと 17 の遷移が定義され、UC をまたいで同じ遷移規則を使うため"
              source_model: "状態: 書籍の状態, 貸出の状態, 予約の状態, 条件: 貸出可否判定 / 予約可否判定 / 返却後の書籍状態判定"
              confidence: "high"
            - id: "LP-011"
              name: "ログ出力禁止"
              description: "domain 層は直接ログ出力を行わない。状態変化はドメインイベントの発行または戻り値で、異常は例外のスローで通知する"
              reason: "ログ出力の責務をレイヤー境界に集約し、domain を純粋なロジックに保つ"
              source_model: "なし"
              confidence: "high"
            - id: "LP-012"
              name: "バリエーションのストラテジー化"
              description: "検索条件種別（5 値）・通知種別（3 値）・集計期間種別（3 値）による処理の切り替えはストラテジーパターンで実装し、条件分岐の追加が既存コードの変更にならないようにする。媒体種別（紙・電子）は将来の電子書籍対応の拡張点として同様に扱う"
              reason: "バリエーションに応じて処理を切り替える条件が複数定義され、媒体種別は拡張起点と明示されている"
              source_model: "バリエーション: 検索条件種別 / 通知種別 / 集計期間種別 / 媒体種別, 条件: 書籍検索条件判定 / 集計期間判定 / 媒体種別判定"
              confidence: "medium"
          rules:
            - id: "LR-005"
              name: "不変条件違反はドメイン例外"
              description: "集約境界仮説の invariants（貸出中・予約待ちの書籍は削除不可、在庫ありの書籍には予約不可、返却期限は必須自動設定 等）は集約 root のメソッド内で検証し、違反は型付きドメイン例外としてスローする"
              reason: "ビジネスルールの違反を usecase / presentation で一意に扱えるようにする"
              source_model: "AG: AG-001〜AG-006, 条件: 貸出可否判定 / 予約可否判定 / 返却期限算出"
              confidence: "medium"
            - id: "LR-006"
              name: "集約 root 経由の更新"
              description: "エンティティの状態変更は集約 root（書籍 / 利用者 / 貸出 / 貸出ポリシー設定 / 予約 / 通知）のメソッド経由でのみ行い、属性の直接更新を禁止する"
              reason: "不変条件の検証点を root に集約する"
              source_model: "AG: AG-001〜AG-007"
              confidence: "medium"
        - id: "L-backend-api-repository"
          name: "リポジトリ層"
          responsibility: "domain のデータアクセス方法。集約 root と 1:1 で定義し、gateway の adapter を組み合わせて永続化・取得を行う。技術例外をドメイン例外にラップする"
          allowed_dependencies:
            - "L-backend-api-domain"
            - "L-backend-api-gateway"
          policies:
            - id: "LP-013"
              name: "楽観ロックによる同時更新制御"
              description: "状態モデルを持つ書籍・貸出・予約の保存時はバージョン列で楽観ロックを行い、競合は競合例外として usecase に伝える"
              reason: "窓口の貸出/返却登録と利用者の予約操作が同一書籍に同時に及ぶ可能性があり、悲観ロックは小規模には過剰"
              source_model: "情報: 書籍 / 貸出 / 予約, 状態: 書籍の状態, 貸出の状態, 予約の状態, NFR B.1.1.1"
              confidence: "medium"
          rules:
            - id: "LR-007"
              name: "Aggregate Root 対応"
              description: "repository は domain の集約 root と 1:1 で定義する。複数テーブルにアクセスする場合は複数の gateway/adapter を利用する"
              reason: "DDD の集約パターンに従い、データアクセスの責務を明確化"
              source_model: "AG: AG-001〜AG-007"
              confidence: "default"
            - id: "LR-008"
              name: "Event/Snapshot 併用パターン"
              description: "event_snapshot 型エンティティ（貸出・予約・通知が候補。確定は Part 3）の場合、repository.save(domain) は historyAdapter.insert + snapshotAdapter.upsert を実行する"
              reason: "イミュータブルデータモデルの永続化パターンを repository で隠蔽"
              source_model: "なし"
              confidence: "default"
            - id: "LR-009"
              name: "メソッド命名規約"
              description: "method 名は JPA に寄せる: save, findById, findAll, deleteById など"
              reason: "広く知られた命名規約に統一し、学習コストを低減"
              source_model: "なし"
              confidence: "default"
            - id: "LR-010"
              name: "技術例外のラップと再スロー"
              description: "gateway から受けた技術例外はログ出力せず、cause を保持したドメイン例外（永続化失敗・競合など）にラップして再スローする"
              reason: "多重ログの防止と、usecase が技術詳細に依存しないため"
              source_model: "なし"
              confidence: "default"
        - id: "L-backend-api-gateway"
          name: "ゲートウェイ層"
          responsibility: "Driven Side の入出力。RDB / KVS の adapter（datastore model と 1:1）と MQ 発行 client、SDK ラッパー。依存関係ログと劣化兆候ログを出力する"
          allowed_dependencies: []
          policies:
            - id: "LP-014"
              name: "MQ 発行の冪等性"
              description: "通知メッセージの発行は通知 ID を MessageId / 重複排除キーとして行い、再送しても同一通知が二重処理されないようにする"
              reason: "外部連携経路（MQ → ワーカー → メール配信サービス）の入口で冪等性を確保する"
              source_model: "外部システム: メール配信サービス, 情報: 通知, UC: 返却通知を送信する"
              confidence: "high"
            - id: "LP-015"
              name: "依存関係ログ"
              description: "RDB / KVS / MQ への呼び出しについて開始・終了・処理時間・成否を構造化ログで出力する。SQL 本文やバインド値は出力しない"
              reason: "アプリケーション監視の範囲に依存先との通信状況を含める"
              source_model: "NFR C.1.3.1, NFR C.6.1.2"
              confidence: "medium"
            - id: "LP-016"
              name: "劣化兆候ログ（リトライ・接続・プール）"
              description: "RDB / KVS / MQ 接続のリトライ発生、コネクションプール逼迫、DNS/TLS ハンドシェイク遅延を WARN レベルで出力し、degradation_type・current_value・threshold・action_taken を context に含める。しきい値は設定ファイルから読み込む"
              reason: "N+1 冗長の手動切替を判断できるよう、障害前の劣化を検知する"
              source_model: "NFR A.2.1.1, NFR C.3.1.1"
              confidence: "medium"
            - id: "LP-017"
              name: "参照系の Cache-Aside とキャッシュ劣化ログ"
              description: "書籍検索・書籍詳細・在庫状況一覧など参照系の結果を KVS に Cache-Aside で保持し、状態遷移時に該当書籍のキャッシュを無効化する。キャッシュミス率上昇を WARN レベルで出力する。更新系はキャッシュを経由しない"
              reason: "利用者向け画面の 5 秒以内応答と、返却通知直後のアクセス集中への備え"
              source_model: "UC: 書籍を検索する / 書籍詳細を参照する, NFR B.2.1.1, NFR B.1.2.1"
              confidence: "medium"
            - id: "LP-018"
              name: "楽観ロック競合ログ"
              description: "楽観ロック競合を WARN レベルで出力し、対象エンティティ ID と競合回数を context に含める"
              reason: "同一書籍への同時操作の頻度を把握し、ロック方式見直しの判断材料にする"
              source_model: "情報: 書籍 / 貸出 / 予約, 状態: 書籍の状態, 貸出の状態, 予約の状態"
              confidence: "medium"
          rules:
            - id: "LR-011"
              name: "Adapter の責務"
              description: "adapter は RDB テーブル / KVS キー空間などの datastore model と 1:1 で定義する。method 名は datastore の操作に寄せる: insert, update, delete, get, set など。ORM 利用時は自動生成コードの配置場所となる"
              reason: "datastore モデルとの対応を明確にし、変更影響範囲を限定する"
              source_model: "なし"
              confidence: "default"
            - id: "LR-012"
              name: "Client の責務"
              description: "client は datastore / MQ を操作する SDK のラッパー。接続設定・タイムアウト・リトライの共通ルールを一箇所に集約する"
              reason: "SDK の利用方法を一箇所に集約し、横断的な設定変更を容易にする"
              source_model: "なし"
              confidence: "default"
            - id: "LR-013"
              name: "パラメータ化クエリの強制"
              description: "DB アクセスは必ずパラメータ化クエリ（または ORM のバインド）で行い、文字列連結による SQL 組み立てを禁止する。検索条件種別ごとのクエリ切替も同様とする"
              reason: "利用者入力を検索条件に用いるためインジェクション対策が必須"
              source_model: "UC: 書籍を検索する, 条件: 書籍検索条件判定, NFR E.10.2.1"
              confidence: "medium"
      cross_layer_policies:
        - id: "CLP-001"
          name: "IF なし（直接依存）"
          description: "レイヤー間は直接依存とし、開発スピードを優先する。外部サービス API 変更や DB 製品乗り換え、チーム分割が必要になった時点で該当 gateway に IF を導入して凹型に移行する"
          reason: "新規構築・小規模で外部サービスはメール配信 1 つのみ。IF による疎結合化は現時点では過剰"
          source_model: "なし"
          confidence: "default"
        - id: "CLP-002"
          name: "エラーハンドリング伝播"
          description: "domain が発生源（ドメイン例外をスロー）、repository はラップして再スロー、usecase が集約ポイントとして 1 回だけログ出力し、presentation が HTTP ステータスに変換する。gateway は依存関係ログに記録後、技術例外としてスローする。cause chain を context に保持する"
          reason: "多重ログの防止とレイヤー責務の分離"
          source_model: "アクター: 司書 / 利用者"
          confidence: "default"
        - id: "CLP-003"
          name: "レイヤー別ログカテゴリ"
          description: "presentation = アクセスログ、usecase = 監査ログ + エラー集約、gateway = 依存関係ログ + 劣化兆候ログ、domain = 出力なし。全ログは JSON 構造化ログとし、timestamp（UTC）・level・trace_id・span_id・user_id・業務 ID（書籍 ID / 貸出 ID / 予約 ID / 通知 ID）を含める"
          reason: "アクセスログ＋操作ログ＋エラーログ＋監査ログの 4 種別とアプリケーション監視が定義されている"
          source_model: "NFR C.1.3.1, NFR C.6.1.2, NFR C.6.1.1"
          confidence: "medium"
        - id: "CLP-004"
          name: "ログ運用方針"
          description: "非同期ログ出力を原則とし、DEBUG/TRACE は本番無効をデフォルトとする。ログ出力先は stdout/stderr に統一し、ローテーションはサイズ + 時間ベースの併用とする。保持期間はアクセス / 診断ログ 6 ヶ月、監査ログは 6 ヶ月以上とする。動的ログレベル変更は障害検知 Lv2 のため必須としないが、設定ファイル再読込で切り替えられる構成を推奨する"
          reason: "ログ保管期間 6 ヶ月と監査ログ Lv2 が定義され、応答時間目標へのログ出力の影響を抑える必要がある"
          source_model: "NFR C.6.1.1, NFR E.7.1.1, NFR B.2.1.1, NFR C.3.1.1"
          confidence: "medium"
        - id: "CLP-005"
          name: "BC 単位のモジュール分割"
          description: "5 層は BC（蔵書 / 利用者 / 貸出 / 予約 / 通知 / 運営分析）ごとのモジュール内に持ち、モジュール間は usecase の公開インタフェースだけを依存点とする。domain / repository / gateway はワーカーと共有ライブラリとして同一リポジトリで管理する"
          reason: "モジュラモノリスの境界規律を実装レベルで担保し、ワーカーとの重複実装を避ける"
          source_model: "BC: BC-001〜BC-006, NFR F.2.2.1, NFR B.1.1.1"
          confidence: "medium"
      cross_layer_rules:
        - id: "CLR-001"
          name: "ログアンチパターン防止"
          description: "多重ログ禁止、catch 握り潰し禁止、機密情報マスキング必須、ループ内逐次ログ禁止（サマリログに置換）、構造化ログ強制、タイムスタンプは UTC 統一"
          reason: "ログ品質と運用コストの均衡"
          source_model: "なし"
          confidence: "default"
        - id: "CLR-002"
          name: "個人情報・認証情報のログ出力禁止"
          description: "氏名・メールアドレス・電話番号・住所・通知本文・アクセストークン・パスワードをどのレイヤーのログにも出力しない。識別には利用者番号・通知 ID などの ID のみを用いる"
          reason: "個人情報を含むデータの保管時暗号化とログ 6 ヶ月保管が定義され、ログが漏えい経路にならないようにする"
          source_model: "情報: 利用者 / 通知, NFR E.6.1.1, NFR C.6.1.1"
          confidence: "high"
        - id: "CLR-003"
          name: "trace_id / span_id の全レイヤー伝播"
          description: "OpenTelemetry 互換の trace_id / span_id を presentation で受け取り、usecase・repository・gateway の全ログと MQ メッセージ属性に含める"
          reason: "API Gateway からワーカー・外部連携まで 1 リクエストを横断追跡する"
          source_model: "NFR C.1.3.1, NFR C.6.1.2"
          confidence: "medium"
        - id: "CLR-004"
          name: "依存方向の静的検査"
          description: "allowed_dependencies に反する import（presentation → repository、domain → gateway、他モジュールの repository 参照 等）を lint / アーキテクチャテストで CI 時に検出する"
          reason: "IF なしの直接依存では依存方向の逸脱が起きやすいため機械的に防ぐ"
          source_model: "なし"
          confidence: "default"
      diagram_mermaid: |
        graph TD
          P[presentation<br/>REST ハンドラ / 入力検証 / アクセスログ] --> U[usecase<br/>トランザクション境界 / 本人限定判定 / 監査ログ]
          U --> D[domain<br/>状態遷移 / 不変条件 / ストラテジー]
          U --> R[repository<br/>集約 root 1:1 / 楽観ロック]
          R --> D
          R --> G[gateway<br/>RDB・KVS adapter / MQ client / 依存関係ログ]
    - tier_id: "tier-worker"
      layers:
        - id: "L-worker-presentation"
          name: "プレゼンテーション層（ジョブ / メッセージハンドラ）"
          responsibility: "Driver Side の入出力。CronJob の起動引数とジョブ実行 ID の受け取り、MQ メッセージのデシリアライズ、重複処理の検知、バッチ開始/終了サマリログとキュー劣化ログ"
          allowed_dependencies:
            - "L-worker-usecase"
          policies:
            - id: "LP-019"
              name: "ジョブ実行 ID / MessageId によるトレース起点"
              description: "CronJob はジョブ実行 ID を、MQ コンシューマはメッセージ属性の trace_id を trace_id として採用し、以降の全ログに含める。メッセージに trace_id が無ければ生成する"
              reason: "API 側で発行した返却通知とワーカー側の送信結果を 1 つのトレースで追跡する"
              source_model: "アクター: タイマー, UC: 返却通知を送信する, NFR C.1.3.1"
              confidence: "medium"
            - id: "LP-020"
              name: "バッチ開始・終了サマリログ"
              description: "日次バッチの開始・終了・対象件数・処理件数・失敗件数を INFO のサマリログとメトリクスで出力する。件ごとの逐次ログは出力しない"
              reason: "日次バッチの完了をアプリケーション層で監視し、未完了・失敗をアラート対象とする"
              source_model: "アクター: タイマー, UC: リマインド対象を抽出する / 延滞を判定する, NFR C.1.3.1, NFR C.3.1.1"
              confidence: "medium"
            - id: "LP-021"
              name: "キュー劣化ログ"
              description: "キュー深度超過・処理遅延・DLQ 到達を WARN レベルで出力し、degradation_type・current_value・threshold を context に含める。しきい値は設定ファイルから読み込む"
              reason: "バッチ起点の一括送信でキューが滞留した場合に当日送信の遅れを早期検知する"
              source_model: "BUC: 返却期限を通知するフロー / 延滞者に督促するフロー, NFR B.2.2.1, NFR C.3.1.1"
              confidence: "medium"
          rules:
            - id: "LR-014"
              name: "重複処理の検知"
              description: "MQ メッセージは MessageId（= 通知 ID）で、CronJob はジョブ実行 ID と対象日で既処理を KVS / 通知レコードから照合し、既処理は正常終了として読み飛ばす"
              reason: "at-least-once 配信と再実行で同一通知が二重送信されることを防ぐ"
              source_model: "情報: 通知, 条件: リマインド対象判定 / 延滞判定, NFR B.1.1.4"
              confidence: "high"
            - id: "LR-015"
              name: "ジョブ / メッセージ処理エラーへの変換"
              description: "usecase から伝播した例外は、CronJob ではジョブのチャンク失敗として記録して次チャンクへ進み、MQ ではリトライ可否を判定して再配信または DLQ へ送る。1 件の失敗でジョブ全体を停止しない"
              reason: "〜10 万件の走査を 8 時間枠で完了させ、部分失敗を再実行で回収できるようにする"
              source_model: "NFR B.2.2.1, NFR B.2.2.2"
              confidence: "medium"
        - id: "L-worker-usecase"
          name: "ユースケース層"
          responsibility: "バッチ・非同期処理のフロー制御。チャンク単位のトランザクション境界、監査ログ、エラー集約ポイント、送信結果の反映"
          allowed_dependencies:
            - "L-worker-domain"
            - "L-worker-repository"
          policies:
            - id: "LP-022"
              name: "抽出と送信の分離とチャンク単位トランザクション"
              description: "リマインド対象抽出・延滞判定は対象を通知レコード（送信待ち）として確定するまでをチャンク単位のトランザクションで行い、送信は別の usecase（MQ コンシューマ）が通知レコード単位で行う。処理済みは通知レコードの状態で判定し、再実行時は未処理分のみを扱う"
              reason: "途中失敗時の再実行可能性と 8 時間枠内の完了を両立する"
              source_model: "UC: リマインド対象を抽出する / リマインドを送信する / 延滞を判定する / 督促を送信する, NFR B.1.1.4, NFR B.2.2.1"
              confidence: "medium"
            - id: "LP-023"
              name: "監査ログ（バッチ起因の状態遷移）"
              description: "延滞判定による貸出中 → 延滞、返却通知送信による予約中 → 通知済みの遷移を、user_id = system（ジョブ実行 ID 付き）・対象 ID・遷移前後の状態で監査ログに記録する"
              reason: "タイマー起因の状態遷移も誰が何をしたかを追跡できるようにする"
              source_model: "状態: 貸出の状態, 予約の状態, アクター: タイマー, NFR E.7.1.1"
              confidence: "high"
            - id: "LP-024"
              name: "送信結果の反映"
              description: "外部連携アダプタから返った送信結果（成功 / 一時失敗 / 恒久失敗）を通知レコードに反映し、恒久失敗は司書が延滞一覧で確認できる状態にする"
              reason: "送信結果を通知記録に保持し、督促の送信状況を司書が確認する要件がある"
              source_model: "情報: 通知（送信結果）, UC: 延滞一覧を参照する, NFR C.1.3.1"
              confidence: "medium"
            - id: "LP-025"
              name: "エラーログの集約ポイント"
              description: "domain / repository / gateway から伝播した例外はこの層で 1 回だけ構造化ログに出力し、cause chain を含めて presentation へ再スローする"
              reason: "多重ログの防止"
              source_model: "NFR C.6.1.2"
              confidence: "default"
          rules:
            - id: "LR-016"
              name: "Backend API と同じ公開インタフェース規律"
              description: "他 BC のデータが必要な場合（利用者の連絡先取得・予約順位 1 位の特定など）は共有ライブラリ内の該当 BC の公開インタフェースを呼び、他 BC の repository を直接参照しない"
              reason: "ワーカーからもモジュール境界を守る"
              source_model: "CM: CM-003 / CM-006 / CM-007 / CM-008, NFR F.2.2.1"
              confidence: "medium"
        - id: "L-worker-domain"
          name: "ドメイン層（Backend API と共有）"
          responsibility: "Backend API と同一の domain モジュールを共有ライブラリとして利用する。リマインド対象判定・延滞判定・返却通知対象判定と貸出 / 予約の状態遷移を担う"
          allowed_dependencies: []
          policies:
            - id: "LP-026"
              name: "domain の共有"
              description: "ワーカー固有のドメインロジックを持たず、Backend API と同一の domain モジュール（貸出 / 予約 / 通知 BC）を参照する。判定ルールの二重実装を禁止する"
              reason: "延滞判定・リマインド対象判定は貸出の状態モデルと不可分であり、API 側の遷移規則と一致させる必要がある"
              source_model: "条件: リマインド対象判定 / 延滞判定 / 返却通知対象判定, 状態: 貸出の状態, 予約の状態"
              confidence: "high"
          rules:
            - id: "LR-017"
              name: "ログ出力禁止"
              description: "domain 層は直接ログ出力を行わない（Backend API と同一ルール）"
              reason: "ログ出力の責務をレイヤー境界に集約する"
              source_model: "なし"
              confidence: "high"
        - id: "L-worker-repository"
          name: "リポジトリ層（Backend API と共有）"
          responsibility: "Backend API と同一の repository を共有する。集約 root 単位の取得・保存に加え、バッチ向けにチャンク単位の対象抽出メソッドを提供する"
          allowed_dependencies:
            - "L-worker-domain"
            - "L-worker-gateway"
          policies: []
          rules:
            - id: "LR-018"
              name: "チャンク抽出メソッド"
              description: "バッチ向けの対象抽出は findLoansForReminder(asOf, chunk) のようにカーソル / ページ指定で提供し、全件をメモリに載せない"
              reason: "1 回あたり〜10 万件の走査をチャンク分割で処理する"
              source_model: "UC: リマインド対象を抽出する / 延滞を判定する, NFR B.1.1.4, NFR B.2.2.2"
              confidence: "medium"
        - id: "L-worker-gateway"
          name: "ゲートウェイ層"
          responsibility: "Backend API と共有する RDB / KVS adapter と MQ consumer client に加え、外部連携ティア（メール配信 ACL アダプタ）を呼び出す。依存関係ログと劣化兆候ログを出力する"
          allowed_dependencies: []
          policies:
            - id: "LP-027"
              name: "外部送信は ACL アダプタ経由"
              description: "メール配信サービスへの送信は tier-external-integration のアダプタ（通知語彙の入出力）を経由し、ワーカーの gateway から外部 SDK を直接呼ばない"
              reason: "外部サービス固有モデルを通知 BC の語彙に翻訳する責務を外部連携ティアに閉じ込める"
              source_model: "外部システム: メール配信サービス, BC: BC-005"
              confidence: "medium"
            - id: "LP-028"
              name: "依存関係ログと劣化兆候ログ"
              description: "RDB / KVS / MQ / 外部連携アダプタ呼び出しの開始・終了・処理時間・成否を依存関係ログに出力する。リトライ発生・サーキットブレーカー状態遷移・DNS/TLS 遅延・コネクションプール逼迫は WARN レベルで劣化兆候ログに出力し、しきい値は設定ファイルから読み込む"
              reason: "メール配信サービスの障害を送信失敗として早期に検知し、N+1 冗長の切替判断に使う"
              source_model: "外部システム: メール配信サービス, NFR C.1.3.1, NFR A.2.1.1"
              confidence: "medium"
          rules:
            - id: "LR-019"
              name: "外部送信の冪等性"
              description: "外部連携アダプタへの送信は通知 ID を冪等キーとして渡し、再試行時に同一通知が二重送信されないようにする"
              reason: "再試行による重複メールは利用者への迷惑メールとなる"
              source_model: "情報: 通知, 外部システム: メール配信サービス, NFR A.1.2.1"
              confidence: "high"
      cross_layer_policies:
        - id: "CLP-006"
          name: "IF なし（直接依存）"
          description: "Backend API と同じく直接依存で開始する。共有ライブラリの domain / repository / gateway をそのまま参照し、ワーカー固有の IF は設けない"
          reason: "共有ライブラリの再利用を優先し、抽象化は必要になった時点で導入する"
          source_model: "なし"
          confidence: "default"
        - id: "CLP-007"
          name: "エラーハンドリング伝播（ジョブ / メッセージ）"
          description: "usecase を集約ポイントとして 1 回だけログ出力し、presentation でジョブのチャンク失敗またはメッセージ処理エラー（再配信 / DLQ）に変換する。恒久失敗は通知レコードに記録して処理を継続する"
          reason: "部分失敗を再実行で回収し、バッチ全体の停止を避ける"
          source_model: "NFR B.2.2.1, NFR C.3.3.1"
          confidence: "default"
        - id: "CLP-008"
          name: "レイヤー別ログカテゴリ（バッチ / コンシューマ）"
          description: "presentation = ジョブ開始/終了サマリ + キュー劣化、usecase = 監査ログ + エラー集約、gateway = 依存関係ログ + 劣化兆候ログ、domain = 出力なし。全ログに trace_id（ジョブ実行 ID / MessageId）と通知 ID・貸出 ID・予約 ID を含める"
          reason: "日次バッチの完了と送信結果をアプリケーション層で監視する"
          source_model: "NFR C.1.3.1, NFR C.6.1.2"
          confidence: "medium"
        - id: "CLP-009"
          name: "ログ運用方針"
          description: "Backend API と同一（非同期出力、stdout/stderr、6 ヶ月保持、監査ログは 6 ヶ月以上、DEBUG は本番無効）"
          reason: "ティア間でログ運用を統一する"
          source_model: "NFR C.6.1.1, NFR E.7.1.1"
          confidence: "medium"
      cross_layer_rules:
        - id: "CLR-005"
          name: "ログアンチパターン防止"
          description: "多重ログ禁止、catch 握り潰し禁止、機密情報マスキング必須、ループ内逐次ログ禁止（N 件中 M 件失敗のサマリに置換）、構造化ログ強制、UTC 統一"
          reason: "〜10 万件のループを扱うバッチで大量ログを防ぐ"
          source_model: "NFR B.1.1.4"
          confidence: "default"
        - id: "CLR-006"
          name: "個人情報・認証情報のログ出力禁止"
          description: "送信先メールアドレス・件名・本文・氏名・外部サービス API キーをログに出力しない。通知 ID・利用者番号のみで識別する"
          reason: "通知レコードは個人情報を含み、ワーカーは送信本文を扱うため漏えい経路になりやすい"
          source_model: "情報: 通知 / 利用者, NFR E.6.1.1, NFR C.6.1.1"
          confidence: "high"
        - id: "CLR-007"
          name: "依存方向の静的検査"
          description: "Backend API と同一の lint / アーキテクチャテストを適用し、presentation → repository や他 BC の repository 直接参照を CI で検出する"
          reason: "共有ライブラリ経由で境界が曖昧になりやすい"
          source_model: "なし"
          confidence: "default"
      diagram_mermaid: |
        graph TD
          P[presentation<br/>CronJob ハンドラ / MQ コンシューマ / 重複検知] --> U[usecase<br/>チャンク処理 / 監査ログ / 送信結果反映]
          U --> D[domain<br/>Backend API と共有]
          U --> R[repository<br/>Backend API と共有 + チャンク抽出]
          R --> D
          R --> G[gateway<br/>RDB・KVS・MQ adapter / 外部連携アダプタ呼び出し]
    - tier_id: "tier-frontend-user"
      layers:
        - id: "L-frontend-user-view"
          name: "ビュー / コンポーネント層"
          responsibility: "利用者向け画面（蔵書検索・書籍詳細/在庫状況・予約申込/取消・マイ貸出履歴・マイ予約状況）の描画、ユーザー操作のハンドリング、画面内状態の保持、エラーの利用者向けメッセージ変換"
          allowed_dependencies:
            - "L-frontend-user-apiclient"
          policies:
            - id: "LP-029"
              name: "クライアント側バリデーションは補助"
              description: "検索条件・ISBN 形式などの入力チェックは操作性向上のためクライアント側でも行うが、正当性の最終判定は Backend API の検証結果に従う"
              reason: "API 境界での検証を正とし、フロントエンドの検証省略やバイパスを前提にする"
              source_model: "条件: 書籍検索条件判定, NFR E.10.2.1"
              confidence: "medium"
            - id: "LP-030"
              name: "本人データの画面内限定保持"
              description: "貸出履歴・予約状況・氏名などの本人データは画面表示のためのメモリ内状態にのみ保持し、localStorage 等へ永続化しない。画面遷移で不要になった状態は破棄する"
              reason: "貸出履歴は思想信条を推知しうる要配慮情報に準じ、端末側への残留を避ける"
              source_model: "情報: 利用者 / 貸出, UC: 貸出履歴を参照する, NFR E.6.1.1"
              confidence: "medium"
            - id: "LP-031"
              name: "利用者向けエラー表示"
              description: "api client が正規化したエラー（在庫ありの書籍には予約できない、他人の予約は取り消せない 等）を利用者向けの文言に変換して表示し、技術的詳細は表示しない"
              reason: "社外の一般利用者が操作するため"
              source_model: "アクター: 利用者（社外）, 条件: 予約可否判定 / 利用状況閲覧範囲判定"
              confidence: "default"
          rules:
            - id: "LR-020"
              name: "出力エスケープと CSP"
              description: "検索結果・書籍情報などの表示はフレームワーク標準のエスケープに従い、生 HTML の挿入を禁止する。Content Security Policy をフレームワーク標準設定で適用する"
              reason: "利用者入力を含むデータを表示する公開画面での XSS 対策"
              source_model: "UC: 書籍を検索する, NFR E.10.2.1"
              confidence: "medium"
            - id: "LR-021"
              name: "ダブルサブミット防止"
              description: "予約登録・予約取消は送信中にボタンを無効化し、api client が付与する冪等キーと組み合わせて重複登録を防ぐ"
              reason: "予約順位に影響する状態遷移の重複を防ぐ"
              source_model: "UC: 予約を登録する / 予約を取り消す, 状態: 予約の状態"
              confidence: "medium"
        - id: "L-frontend-user-apiclient"
          name: "API クライアント層"
          responsibility: "API Gateway 経由の Backend API 呼び出し、認証トークンの取得・保持・更新、trace_id と冪等キーの付与、HTTP エラーの正規化"
          allowed_dependencies: []
          policies:
            - id: "LP-032"
              name: "認証トークンの安全な保持"
              description: "IdP から取得したトークンはメモリ保持または HttpOnly / Secure Cookie で扱い、localStorage には保存しない。期限切れ時は再認証へ誘導する"
              reason: "本人限定情報を扱う公開画面でトークン窃取のリスクを下げる"
              source_model: "アクター: 利用者（社外）, NFR E.5.1.1, NFR E.6.1.1"
              confidence: "medium"
            - id: "LP-033"
              name: "trace_id と冪等キーの付与"
              description: "全リクエストに trace_id を発行して付与し、更新系（予約登録・取消）には操作ごとに生成した Idempotency-Key を付与する"
              reason: "横断トレーサビリティの起点と、再送による重複防止"
              source_model: "NFR C.1.3.1, 状態: 予約の状態"
              confidence: "medium"
          rules:
            - id: "LR-022"
              name: "API Gateway 経由のみ"
              description: "Backend API・データストアへの直接アクセスを禁止し、公開経路の API Gateway エンドポイントのみを呼び出す"
              reason: "セキュリティとデータ整合性の確保"
              source_model: "なし"
              confidence: "default"
            - id: "LR-023"
              name: "HTTP エラーの正規化"
              description: "HTTP ステータスと API のエラーコードをアプリケーション内の統一エラー型に変換して view へ返す。401 は再認証、403 は権限エラー、409 / 422 は業務エラーとして扱う"
              reason: "エラー変換の責務を view から分離する"
              source_model: "なし"
              confidence: "default"
      cross_layer_policies:
        - id: "CLP-010"
          name: "2 層構成（状態管理層なし）"
          description: "利用者向けは UC 6 件（検索・詳細・予約登録・予約取消・貸出履歴・予約状況）で画面間で共有する状態が認証状態程度のため、view / component → api client の 2 層とし独立した状態管理層は設けない。画面横断の状態が増えた時点で 3 層に拡張する"
          reason: "UC 数 20 未満で画面内状態で足りる"
          source_model: "BUC: 書籍を検索するフロー / 書籍を予約するフロー / 自分の利用状況を確認するフロー"
          confidence: "medium"
        - id: "CLP-011"
          name: "エラーハンドリング伝播（フロントエンド）"
          description: "api client が HTTP エラーを正規化して 1 回だけクライアントログ（PII なし）に記録し、view が利用者向けメッセージに変換する。未処理例外はグローバルハンドラで捕捉して汎用エラー画面を表示する"
          reason: "多重ログの防止と利用者体験の統一"
          source_model: "アクター: 利用者（社外）"
          confidence: "default"
      cross_layer_rules:
        - id: "CLR-008"
          name: "ブラウザログへの個人情報・トークン出力禁止"
          description: "コンソールログやエラー収集に氏名・連絡先・貸出履歴・アクセストークンを含めない"
          reason: "端末側で第三者に閲覧される経路を断つ"
          source_model: "情報: 利用者 / 貸出, NFR E.6.1.1"
          confidence: "high"
      diagram_mermaid: |
        graph TD
          V[view / component<br/>検索・予約・マイページ画面] --> A[api client<br/>トークン保持 / trace_id・冪等キー付与 / エラー正規化]
          A -->|HTTPS 公開経路| GW[(API Gateway)]
    - tier_id: "tier-frontend-staff"
      layers:
        - id: "L-frontend-staff-view"
          name: "ビュー / コンポーネント層"
          responsibility: "司書向け管理画面（蔵書・利用者管理、貸出/返却受付、返却通知送信、予約/延滞状況、窓口検索・照会、在庫状況/ランキング/期間別統計）の描画、ユーザー操作のハンドリング、確認ステップ、画面内状態の保持"
          allowed_dependencies:
            - "L-frontend-staff-apiclient"
          policies:
            - id: "LP-034"
              name: "状態変更操作の確認ステップ"
              description: "書籍削除・利用者削除・貸出登録・返却登録・返却通知送信は確認画面（または確認ダイアログ）を経由し、送信中はボタンを無効化する"
              reason: "RDRA に削除確認画面・返却通知送信確認画面が定義され、状態遷移を伴う操作の誤操作・重複を防ぐ"
              source_model: "画面: 書籍削除確認画面 / 利用者削除確認画面 / 返却通知送信確認画面, 状態: 書籍の状態, 貸出の状態, 予約の状態"
              confidence: "medium"
            - id: "LP-035"
              name: "窓口業務の最少操作"
              description: "貸出受付・返却受付は利用者番号と書籍 ID の入力から確認・完了まで最少のキーボード操作で完了できる画面とし、入力後に貸出可否・返却後の状態を即時表示する"
              reason: "貸出・返却は窓口のリアルタイム処理で、司書の手作業とミスの削減がシステムの目的"
              source_model: "BUC: 書籍を貸し出すフロー / 書籍を返却するフロー, 条件: 貸出可否判定 / 返却後の書籍状態判定, NFR A.4.1.2"
              confidence: "medium"
            - id: "LP-036"
              name: "集計画面の段階表示とページネーション"
              description: "在庫状況一覧・人気書籍ランキング・期間別貸出統計は集計条件の指定後に非同期で取得し、一覧はページネーションで表示する。10 秒以内の表示を目標とする"
              reason: "管理者向け集計画面のターンアラウンド 10 秒以内が定義されている"
              source_model: "BUC: 蔵書の利用状況を分析するフロー, 条件: 人気書籍ランキング判定, 在庫状況判定, 集計期間判定, NFR B.2.1.3"
              confidence: "medium"
          rules:
            - id: "LR-024"
              name: "出力エスケープと CSP"
              description: "利用者情報・書籍情報の表示はフレームワーク標準のエスケープに従い、生 HTML の挿入を禁止する。Content Security Policy を適用する"
              reason: "館内限定でも入力値を表示する画面での XSS 対策"
              source_model: "NFR E.10.2.1"
              confidence: "medium"
            - id: "LR-025"
              name: "個人情報の画面内限定保持"
              description: "利用者一覧・利用状況照会で取得した氏名・連絡先は画面表示のためのメモリ内状態にのみ保持し、永続化しない"
              reason: "個人情報の端末残留を避ける"
              source_model: "情報: 利用者, NFR E.6.1.1"
              confidence: "medium"
        - id: "L-frontend-staff-apiclient"
          name: "API クライアント層"
          responsibility: "館内経路の API Gateway 経由の Backend API 呼び出し、認証トークンの取得・保持・更新、trace_id と冪等キーの付与、HTTP エラーの正規化"
          allowed_dependencies: []
          policies:
            - id: "LP-037"
              name: "認証トークンの安全な保持"
              description: "IdP から取得したトークンはメモリ保持または HttpOnly / Secure Cookie で扱い、localStorage には保存しない。窓口端末は共用の可能性があるため、無操作タイムアウトで再認証を要求する"
              reason: "司書アカウントは全利用者の個人情報に到達できるため"
              source_model: "アクター: 司書（社内）, 情報: 利用者, NFR E.5.1.1, NFR E.7.1.1"
              confidence: "medium"
            - id: "LP-038"
              name: "trace_id と冪等キーの付与"
              description: "全リクエストに trace_id を発行して付与し、更新系（貸出登録・返却登録・返却通知送信・登録/編集/削除）には操作ごとに生成した Idempotency-Key を付与する"
              reason: "横断トレーサビリティの起点と、確認画面からの再送による重複防止"
              source_model: "NFR C.1.3.1, 画面: 返却通知送信確認画面"
              confidence: "medium"
          rules:
            - id: "LR-026"
              name: "API Gateway 経由のみ"
              description: "Backend API・データストアへの直接アクセスを禁止し、館内経路の API Gateway エンドポイントのみを呼び出す"
              reason: "セキュリティとデータ整合性の確保"
              source_model: "なし"
              confidence: "default"
            - id: "LR-027"
              name: "HTTP エラーの正規化"
              description: "HTTP ステータスと API のエラーコードを統一エラー型に変換して view へ返す。409 / 422 の業務エラー（貸出不可・削除不可 等）は理由コードを保持して画面に表示できるようにする"
              reason: "窓口で司書が利用者に理由を案内できるようにする"
              source_model: "条件: 貸出可否判定, UC: 貸出を登録する / 書籍を削除する"
              confidence: "default"
      cross_layer_policies:
        - id: "CLP-012"
          name: "2 層構成（状態管理層なし）"
          description: "司書向けは UC 18 件で 20 件未満のため view / component → api client の 2 層で開始する。窓口画面間で共有する状態（選択中の利用者・書籍）が増えた場合は状態管理層を追加して 3 層に拡張する"
          reason: "UC 数が判定境界に近く、拡張余地を残した保守的な選択"
          source_model: "BUC: 蔵書を管理するフロー / 利用者を管理するフロー / 書籍を貸し出すフロー / 書籍を返却するフロー / 延滞者に督促するフロー / 蔵書の利用状況を分析するフロー"
          confidence: "medium"
        - id: "CLP-013"
          name: "エラーハンドリング伝播（フロントエンド）"
          description: "api client が HTTP エラーを正規化して 1 回だけクライアントログ（PII なし）に記録し、view が司書向けメッセージ（理由コード付き）に変換する。未処理例外はグローバルハンドラで捕捉する"
          reason: "多重ログの防止と窓口対応の統一"
          source_model: "アクター: 司書（社内）"
          confidence: "default"
      cross_layer_rules:
        - id: "CLR-009"
          name: "ブラウザログへの個人情報・トークン出力禁止"
          description: "コンソールログやエラー収集に氏名・連絡先・通知本文・アクセストークンを含めない"
          reason: "共用の可能性がある窓口端末での漏えい経路を断つ"
          source_model: "情報: 利用者 / 通知, NFR E.6.1.1"
          confidence: "high"
      diagram_mermaid: |
        graph TD
          V[view / component<br/>管理・窓口・分析画面 / 確認ステップ] --> A[api client<br/>トークン保持 / trace_id・冪等キー付与 / エラー正規化]
          A -->|HTTPS 館内経路| GW[(API Gateway)]
    - tier_id: "tier-external-integration"
      layers:
        - id: "L-external-integration-adapter"
          name: "ACL アダプタ層"
          responsibility: "通知コンテキストの語彙（通知 ID・送信先・件名・本文・送信結果）とメール配信サービスの API モデルの相互翻訳。Retry + Circuit Breaker + Timeout の適用、依存関係ログと劣化兆候ログの出力"
          allowed_dependencies:
            - "L-external-integration-client"
          policies:
            - id: "LP-039"
              name: "ACL によるモデル翻訳"
              description: "入力は通知 BC の送信要求（通知 ID・通知種別・送信先・件名・本文）、出力は送信結果（成功 / 一時失敗 / 恒久失敗 + 外部メッセージ ID）に限定し、メール配信サービス固有の型・エラーコードを呼び出し側へ露出しない"
              reason: "外部システムは通知系 1 つで Generic サブドメインとして隔離し、サービス差し替えの影響を本ティアに閉じ込める"
              source_model: "外部システム: メール配信サービス, BC: BC-005, 情報: 通知（送信結果）"
              confidence: "medium"
            - id: "LP-040"
              name: "Retry + Circuit Breaker + Timeout"
              description: "送信呼び出しにタイムアウトを設定し、一時障害（5xx・タイムアウト・接続失敗）は指数バックオフ + Jitter で再試行、継続障害はサーキットブレーカーで遮断して一時失敗を返す。Timeout はサーキットブレーカーの閾値時間より短くし、各しきい値は設定ファイルから読み込む"
              reason: "外部サービス障害をワーカーへ連鎖させず、サービス切替 60 分未満の可用性目標を守る"
              source_model: "外部システム: メール配信サービス, NFR A.1.2.1, NFR A.2.1.1"
              confidence: "medium"
            - id: "LP-041"
              name: "依存関係ログと劣化兆候ログ"
              description: "外部呼び出しの開始・終了・処理時間・HTTP ステータス・外部メッセージ ID を依存関係ログに出力する。リトライ発生・サーキットブレーカー状態遷移・DNS/TLS ハンドシェイク遅延は WARN レベルで劣化兆候ログに出力し、degradation_type・current_value・threshold・action_taken を context に含める"
              reason: "送信結果の失敗率とサーキットブレーカーの Open 状態を監視対象とする"
              source_model: "情報: 通知（送信結果）, NFR C.1.3.1, NFR C.3.1.1, NFR A.2.1.1"
              confidence: "medium"
          rules:
            - id: "LR-028"
              name: "再試行対象の限定と冪等キー"
              description: "認証エラー・宛先不正などの 4xx 系は再試行せず恒久失敗として返す。再試行は通知 ID を冪等キー（外部サービスが対応する場合は冪等ヘッダ）として行う"
              reason: "恒久障害の再試行は無駄であり、重複送信は利用者への迷惑メールとなる"
              source_model: "情報: 通知, NFR A.1.2.1"
              confidence: "default"
            - id: "LR-029"
              name: "アダプタでの例外変換"
              description: "client の技術例外は依存関係ログに記録した後、送信結果（一時失敗 / 恒久失敗）に変換して返し、例外のまま呼び出し側へ伝播させない"
              reason: "ワーカーが送信結果を通知レコードに反映する設計と整合させる"
              source_model: "情報: 通知（送信結果）"
              confidence: "default"
        - id: "L-external-integration-client"
          name: "外部 SDK クライアント層"
          responsibility: "メール配信サービスの HTTPS API / SMTPS 接続の SDK ラッパー。TLS 設定、認証情報の注入、タイムアウト設定の一元化"
          allowed_dependencies: []
          policies:
            - id: "LP-042"
              name: "暗号化通信の強制"
              description: "メール配信サービスとの通信は HTTPS（TLS1.2 以上）または SMTPS に限定し、平文プロトコルへのフォールバックを行わない"
              reason: "外部システムとの通信を含む全通信暗号化が定義されている"
              source_model: "外部システム: メール配信サービス, NFR E.6.1.2"
              confidence: "high"
          rules:
            - id: "LR-030"
              name: "認証情報の秘匿"
              description: "API キー・SMTP 認証情報はシークレット管理機構から実行時に注入し、コード・設定ファイル・ログに含めない"
              reason: "認証情報の保管時暗号化が定義されている"
              source_model: "NFR E.6.1.1"
              confidence: "default"
            - id: "LR-031"
              name: "接続設定の外部化"
              description: "エンドポイント・タイムアウト・コネクションプールサイズは設定ファイル / 環境変数から読み込み、コードにハードコードしない"
              reason: "環境ごとの切替と運用中のチューニングを容易にする"
              source_model: "なし"
              confidence: "default"
      cross_layer_policies:
        - id: "CLP-014"
          name: "ワーカーの gateway から利用するライブラリとして配置"
          description: "外部連携ティアは独立プロセスではなく、通知 BC のゲートウェイ実装としてワーカーと同一デプロイ単位に同梱するライブラリとする。Backend API からは直接参照しない（送信は MQ 経由でワーカーに委ねる）"
          reason: "外部連携はメール送信 1 種のみで独立プロセス化の根拠がなく、呼び出し元がワーカーに限られる"
          source_model: "外部システム: メール配信サービス, UC: 返却通知を送信する / リマインドを送信する / 督促を送信する, NFR B.1.1.1"
          confidence: "medium"
        - id: "CLP-015"
          name: "エラーハンドリング（結果型で返す）"
          description: "本ティア内では client の技術例外を adapter が捕捉して依存関係ログに記録し、送信結果の型に変換して返す。呼び出し側（ワーカー usecase）は結果型で成否を判定する"
          reason: "外部障害を通常のフロー（送信結果の記録）として扱い、例外による制御を避ける"
          source_model: "情報: 通知（送信結果）"
          confidence: "default"
      cross_layer_rules:
        - id: "CLR-010"
          name: "送信先・本文のログ出力禁止"
          description: "送信先メールアドレス・件名・本文をどのログにも出力しない。識別には通知 ID と外部メッセージ ID のみを用いる"
          reason: "通知は個人情報を含み、外部通信の記録が漏えい経路になりやすい"
          source_model: "情報: 通知, NFR E.6.1.1, NFR C.6.1.1"
          confidence: "high"
      diagram_mermaid: |
        graph TD
          WG[ワーカー gateway 層] --> AD[adapter<br/>ACL 翻訳 / Retry・CB・Timeout / 依存関係ログ]
          AD --> CL[client<br/>HTTPS・SMTPS SDK ラッパー / TLS1.2+ / 認証情報注入]
          CL -->|HTTPS / SMTPS| MAIL[メール配信サービス]
```

## data_architecture.entities

```yaml
  entities:
    - id: "E-001"
      name: "書籍"
      source_info: "情報: 書籍"
      model_type: "event_snapshot"
      attributes:
        - name: "book_id"
          type: "string"
          description: "書籍ID"
          nullable: false
          primary_key: true
        - name: "title"
          type: "string"
          description: "タイトル"
          nullable: false
          primary_key: false
        - name: "author"
          type: "string"
          description: "著者"
          nullable: false
          primary_key: false
        - name: "isbn"
          type: "string"
          description: "ISBN（移行時に重複・欠損を名寄せする。NFR D.4.1.3）"
          nullable: true
          primary_key: false
        - name: "publisher"
          type: "string"
          description: "出版社"
          nullable: true
          primary_key: false
        - name: "genre_id"
          type: "string"
          description: "ジャンルID（E-002 への参照）"
          nullable: false
          primary_key: false
        - name: "media_type"
          type: "string"
          description: "媒体種別（enum: 紙・電子。初期リリースは紙のみ貸出・予約対象）"
          nullable: false
          primary_key: false
        - name: "current_status"
          type: "string"
          description: "書籍の状態（enum: 在庫あり・貸出中・予約待ち）。スナップショットのキャッシュ的ステータス。遷移はイベント（登録・貸出・返却・予約取消・削除）で記録する"
          nullable: false
          primary_key: false
        - name: "version"
          type: "integer"
          description: "楽観ロック用バージョン"
          nullable: false
          primary_key: false
        - name: "updated_at"
          type: "datetime"
          description: "スナップショット最終更新日時。情報.tsv の登録日・更新日は登録イベント / 最新イベントの occurred_at で管理する"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-002"
          type: "N:1"
          description: "書籍はジャンルに属する（ジャンルは複数書籍から参照されるマスタ）"
        - target_entity: "E-004"
          type: "1:N"
          description: "書籍は複数の貸出記録を持つ"
        - target_entity: "E-007"
          type: "1:N"
          description: "書籍は複数の予約を持つ（受付順に予約順位を付与）"
        - target_entity: "E-009"
          type: "1:N"
          description: "書籍ごとに集計期間別の貸出統計を持つ"
    - id: "E-002"
      name: "ジャンル"
      source_info: "情報: ジャンル"
      model_type: "resource_mutable"
      attributes:
        - name: "genre_id"
          type: "string"
          description: "ジャンルID"
          nullable: false
          primary_key: true
        - name: "genre_name"
          type: "string"
          description: "ジャンル名（文学・社会科学・自然科学・技術・芸術・歴史・児童書・その他）"
          nullable: false
          primary_key: false
        - name: "description"
          type: "text"
          description: "説明"
          nullable: true
          primary_key: false
      relationships:
        - target_entity: "E-001"
          type: "1:N"
          description: "ジャンルは複数の書籍を分類する"
    - id: "E-003"
      name: "利用者"
      source_info: "情報: 利用者"
      model_type: "event_snapshot"
      attributes:
        - name: "user_number"
          type: "string"
          description: "利用者番号（司書が登録時に付与する一意の識別子）"
          nullable: false
          primary_key: true
        - name: "name"
          type: "string"
          description: "氏名（個人情報。保管時暗号化対象 NFR E.6.1.1、テスト環境マスキング対象 NFR E.6.2.1）"
          nullable: false
          primary_key: false
        - name: "email"
          type: "string"
          description: "メールアドレス（通知の送信先。移行時に欠損を補完する NFR D.4.1.3。個人情報）"
          nullable: false
          primary_key: false
        - name: "phone"
          type: "string"
          description: "電話番号（個人情報）"
          nullable: true
          primary_key: false
        - name: "address"
          type: "string"
          description: "住所（個人情報）"
          nullable: true
          primary_key: false
        - name: "user_type"
          type: "string"
          description: "利用者区分（enum: 司書・利用者）。RBAC のロール源泉（NFR E.5.2.1）"
          nullable: false
          primary_key: false
        - name: "version"
          type: "integer"
          description: "楽観ロック用バージョン"
          nullable: false
          primary_key: false
        - name: "updated_at"
          type: "datetime"
          description: "スナップショット最終更新日時。登録日・更新日は登録 / 属性変更イベントの occurred_at で管理する"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-004"
          type: "1:N"
          description: "利用者は複数の貸出を持つ"
        - target_entity: "E-007"
          type: "1:N"
          description: "利用者は複数の予約を持つ"
        - target_entity: "E-008"
          type: "1:N"
          description: "利用者は複数の通知の送信先になる"
        - target_entity: "E-903"
          type: "1:1"
          description: "利用者は 1 件の認証情報を持つ（派生エンティティ。NFR E.5.1.1）"
    - id: "E-004"
      name: "貸出"
      source_info: "情報: 貸出"
      model_type: "event_snapshot"
      attributes:
        - name: "loan_id"
          type: "string"
          description: "貸出ID"
          nullable: false
          primary_key: true
        - name: "book_id"
          type: "string"
          description: "書籍ID（E-001 への参照）"
          nullable: false
          primary_key: false
        - name: "user_number"
          type: "string"
          description: "利用者番号（E-003 への参照。貸出履歴は要配慮情報に準じる NFR E.1.2.1 / E.6.1.1）"
          nullable: false
          primary_key: false
        - name: "loaned_on"
          type: "date"
          description: "貸出日（貸出登録イベントの発生日。INSERT 時に確定）"
          nullable: false
          primary_key: false
        - name: "due_date"
          type: "date"
          description: "返却期限（貸出日 + 貸出期間で自動設定。条件: 返却期限算出）"
          nullable: false
          primary_key: false
        - name: "current_status"
          type: "string"
          description: "貸出の状態（enum: 貸出中・延滞・返却済み）。返却日（情報.tsv）は nullable 日時のため排除し、返却登録イベントの occurred_at で管理する"
          nullable: false
          primary_key: false
        - name: "recorded_by"
          type: "string"
          description: "記録した司書（利用者区分=司書の利用者番号。E-003 への参照）"
          nullable: false
          primary_key: false
        - name: "version"
          type: "integer"
          description: "楽観ロック用バージョン"
          nullable: false
          primary_key: false
        - name: "updated_at"
          type: "datetime"
          description: "スナップショット最終更新日時"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-001"
          type: "N:1"
          description: "貸出は 1 冊の書籍に紐づく"
        - target_entity: "E-003"
          type: "N:1"
          description: "貸出は 1 人の利用者に紐づく（記録した司書も E-003 を参照）"
        - target_entity: "E-008"
          type: "1:N"
          description: "貸出はリマインド・督促の通知を複数持つ"
        - target_entity: "E-009"
          type: "1:N"
          description: "貸出記録は貸出統計の集計元（FK ではなく派生関係）"
        - target_entity: "E-005"
          type: "N:1"
          description: "貸出日時点で有効な貸出期間を返却期限算出に適用する（世代参照）"
        - target_entity: "E-006"
          type: "N:1"
          description: "判定日時点で有効なリマインド日数をリマインド対象判定に適用する（世代参照）"
    - id: "E-005"
      name: "貸出期間"
      source_info: "情報: 貸出期間"
      model_type: "resource_scd2"
      attributes:
        - name: "loan_period_id"
          type: "string"
          description: "貸出期間設定ID（世代ごとに採番）"
          nullable: false
          primary_key: true
        - name: "loan_days"
          type: "integer"
          description: "貸出期間（日数）"
          nullable: false
          primary_key: false
        - name: "valid_from"
          type: "date"
          description: "適用開始日"
          nullable: false
          primary_key: false
        - name: "valid_to"
          type: "date"
          description: "適用終了日（現行世代は NULL）"
          nullable: true
          primary_key: false
        - name: "updated_at"
          type: "datetime"
          description: "更新日時"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-004"
          type: "1:N"
          description: "適用期間内に登録された貸出の返却期限算出に用いる"
    - id: "E-006"
      name: "リマインド日数"
      source_info: "情報: リマインド日数"
      model_type: "resource_scd2"
      attributes:
        - name: "remind_days_id"
          type: "string"
          description: "リマインド日数設定ID（世代ごとに採番）"
          nullable: false
          primary_key: true
        - name: "remind_days"
          type: "integer"
          description: "リマインド日数（返却期限の何日前か）"
          nullable: false
          primary_key: false
        - name: "valid_from"
          type: "date"
          description: "適用開始日"
          nullable: false
          primary_key: false
        - name: "valid_to"
          type: "date"
          description: "適用終了日（現行世代は NULL）"
          nullable: true
          primary_key: false
        - name: "updated_at"
          type: "datetime"
          description: "更新日時"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-004"
          type: "1:N"
          description: "日次バッチのリマインド対象判定で貸出に適用する"
    - id: "E-007"
      name: "予約"
      source_info: "情報: 予約"
      model_type: "event_snapshot"
      attributes:
        - name: "reservation_id"
          type: "string"
          description: "予約ID"
          nullable: false
          primary_key: true
        - name: "book_id"
          type: "string"
          description: "書籍ID（E-001 への参照）"
          nullable: false
          primary_key: false
        - name: "user_number"
          type: "string"
          description: "利用者番号（E-003 への参照）"
          nullable: false
          primary_key: false
        - name: "accepted_at"
          type: "datetime"
          description: "受付日時（予約登録イベントの発生日時。予約順位の決定基準）"
          nullable: false
          primary_key: false
        - name: "queue_position"
          type: "integer"
          description: "予約順位（同一書籍内の受付順。取消時に繰り上げる。条件: 予約順位決定）"
          nullable: false
          primary_key: false
        - name: "current_status"
          type: "string"
          description: "予約の状態（enum: 予約中・通知済み・取消・終了）。取消日時（情報.tsv）は nullable 日時のため排除し、取消イベントの occurred_at で管理する"
          nullable: false
          primary_key: false
        - name: "version"
          type: "integer"
          description: "楽観ロック用バージョン"
          nullable: false
          primary_key: false
        - name: "updated_at"
          type: "datetime"
          description: "スナップショット最終更新日時"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-001"
          type: "N:1"
          description: "予約は 1 冊の書籍に紐づく"
        - target_entity: "E-003"
          type: "N:1"
          description: "予約は 1 人の利用者に紐づく"
        - target_entity: "E-008"
          type: "1:N"
          description: "予約は返却通知を持つ（取消・繰り上げで複数回送られうる）"
    - id: "E-008"
      name: "通知"
      source_info: "情報: 通知"
      model_type: "event"
      attributes:
        - name: "notification_id"
          type: "string"
          description: "通知ID"
          nullable: false
          primary_key: true
        - name: "user_number"
          type: "string"
          description: "利用者番号（E-003 への参照）"
          nullable: false
          primary_key: false
        - name: "notification_type"
          type: "string"
          description: "通知種別（enum: 返却通知・リマインド・督促）"
          nullable: false
          primary_key: false
        - name: "recipient_email"
          type: "string"
          description: "送信先メールアドレス（送信時点の値のコピー。個人情報。NFR E.6.1.1）"
          nullable: false
          primary_key: false
        - name: "subject"
          type: "string"
          description: "件名"
          nullable: false
          primary_key: false
        - name: "body"
          type: "text"
          description: "本文"
          nullable: false
          primary_key: false
        - name: "sent_at"
          type: "datetime"
          description: "送信日時（イベント発生日時 occurred_at）"
          nullable: false
          primary_key: false
        - name: "send_result"
          type: "string"
          description: "送信結果（enum: 成功・失敗。メール配信サービスの応答を ACL で翻訳した値）"
          nullable: false
          primary_key: false
        - name: "target_loan_id"
          type: "string"
          description: "対象貸出ID（リマインド・督促のとき。E-004 への参照。返却通知では NULL）"
          nullable: true
          primary_key: false
        - name: "target_reservation_id"
          type: "string"
          description: "対象予約ID（返却通知のとき。E-007 への参照。リマインド・督促では NULL）"
          nullable: true
          primary_key: false
      relationships:
        - target_entity: "E-003"
          type: "N:1"
          description: "通知は 1 人の利用者に送信される"
        - target_entity: "E-004"
          type: "N:1"
          description: "リマインド・督促は対象貸出に紐づく"
        - target_entity: "E-007"
          type: "N:1"
          description: "返却通知は対象予約に紐づく"
    - id: "E-009"
      name: "貸出統計"
      source_info: "情報: 貸出統計"
      model_type: "resource_mutable"
      attributes:
        - name: "stat_id"
          type: "string"
          description: "集計ID"
          nullable: false
          primary_key: true
        - name: "period_type"
          type: "string"
          description: "集計期間種別（enum: 日・月・年）"
          nullable: false
          primary_key: false
        - name: "period_start"
          type: "date"
          description: "集計対象期間 開始日"
          nullable: false
          primary_key: false
        - name: "period_end"
          type: "date"
          description: "集計対象期間 終了日"
          nullable: false
          primary_key: false
        - name: "book_id"
          type: "string"
          description: "書籍ID（E-001 への参照）"
          nullable: false
          primary_key: false
        - name: "loan_count"
          type: "integer"
          description: "貸出回数（書籍ごと。人気書籍ランキングの基準）"
          nullable: false
          primary_key: false
        - name: "loan_total"
          type: "integer"
          description: "貸出件数（集計期間内の合計）"
          nullable: false
          primary_key: false
        - name: "ranking"
          type: "integer"
          description: "ランキング順位"
          nullable: false
          primary_key: false
        - name: "aggregated_at"
          type: "datetime"
          description: "集計日時（再集計のたびに更新）"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-001"
          type: "N:1"
          description: "貸出統計は書籍ごとに集計する"
        - target_entity: "E-004"
          type: "N:1"
          description: "貸出記録を集計した派生データ（Materialized View。FK ではない）"
    - id: "E-901"
      name: "セッション"
      source_info: "情報: なし（派生。アクター: 利用者（社外）/ 司書、NFR E.5.1.1 認証方式、NFR E.7.1.1 監査ログ）"
      model_type: "resource_mutable"
      attributes:
        - name: "session_id"
          type: "string"
          description: "セッションID"
          nullable: false
          primary_key: true
        - name: "user_number"
          type: "string"
          description: "ログイン利用者の利用者番号（E-003 への参照）"
          nullable: false
          primary_key: false
        - name: "role"
          type: "string"
          description: "ロール（利用者区分のコピー: 司書・利用者。RBAC 判定用）"
          nullable: false
          primary_key: false
        - name: "issued_at"
          type: "datetime"
          description: "発行日時"
          nullable: false
          primary_key: false
        - name: "expires_at"
          type: "datetime"
          description: "有効期限（TTL で失効）"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-003"
          type: "N:1"
          description: "セッションはログイン中の利用者に紐づく"
    - id: "E-902"
      name: "監査ログ"
      source_info: "情報: なし（派生。NFR E.7.1.1 監査ログ Lv2: ログイン/ログアウト + データアクセスログ、条件: 利用状況閲覧範囲判定）"
      model_type: "event"
      attributes:
        - name: "audit_id"
          type: "string"
          description: "監査ログID"
          nullable: false
          primary_key: true
        - name: "occurred_at"
          type: "datetime"
          description: "発生日時"
          nullable: false
          primary_key: false
        - name: "actor_user_number"
          type: "string"
          description: "操作者の利用者番号（バッチはタイマーの固定 ID）"
          nullable: false
          primary_key: false
        - name: "action_type"
          type: "string"
          description: "操作種別（enum: ログイン・ログアウト・ログイン失敗・データ参照・データ更新）"
          nullable: false
          primary_key: false
        - name: "target_entity"
          type: "string"
          description: "対象エンティティ（E-xxx）"
          nullable: false
          primary_key: false
        - name: "target_id"
          type: "string"
          description: "対象レコード ID（利用状況閲覧範囲判定の検証に使う）"
          nullable: false
          primary_key: false
        - name: "result"
          type: "string"
          description: "結果（enum: 成功・拒否・失敗）"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-003"
          type: "N:1"
          description: "監査ログは操作者（利用者）に紐づく"
    - id: "E-903"
      name: "認証情報"
      source_info: "情報: なし（派生。NFR E.5.1.1 ID/パスワード認証 + パスワードポリシー、NFR E.7.2.1 ログイン失敗の連続検知とアカウントロック、NFR E.6.1.1 認証情報の暗号化）"
      model_type: "resource_mutable"
      attributes:
        - name: "user_number"
          type: "string"
          description: "利用者番号（E-003 と 1:1）"
          nullable: false
          primary_key: true
        - name: "password_hash"
          type: "string"
          description: "パスワードハッシュ（平文保持禁止。ソルト付きハッシュ）"
          nullable: false
          primary_key: false
        - name: "password_updated_at"
          type: "datetime"
          description: "パスワード最終更新日時（有効期限ポリシーの判定基準）"
          nullable: false
          primary_key: false
        - name: "failed_attempts"
          type: "integer"
          description: "連続ログイン失敗回数"
          nullable: false
          primary_key: false
        - name: "locked_until"
          type: "datetime"
          description: "アカウントロック解除日時（未ロックは NULL）"
          nullable: true
          primary_key: false
      relationships:
        - target_entity: "E-003"
          type: "1:1"
          description: "認証情報は利用者と 1:1"
```

## 追加転写元: `docs/nfr/latest/nfr-grade.yaml`

- 転写元: `docs/nfr/latest/nfr-grade.yaml`
- source_sha256: `f352e424419f352fb0a55e65541b02a9f420d7d6b9dec9d2a0f3b5de39d04780`
- 生成: `extractSections.js`（原文転写。要約・言い換えなし）

### 転写済みセクションのチェックリスト

| セクション | 状態 |
|---|---|
| `categories[id=A]` | 転写済み |
| `categories[id=B]` | 転写済み |
| `categories[id=E]` | 転写済み |

`not_applicable` = 元ファイルにセクション自体が存在しない（フォールバック対象外。元ファイルを読みに行かない）。

### categories[id=A]

```yaml
  - id: "A"
    name: "可用性"
    subcategories:
      - id: "A.1"
        name: "継続性"
        items:
          - id: "A.1.1"
            name: "運用スケジュール"
            important: true
            metrics:
              - id: "A.1.1.1"
                name: "運用時間（通常）"
                important: true
                grade: 3
                grade_description: "1時間程度の停止（9時〜翌8時）"
                reason: "BUC「自分の利用状況を確認するフロー」「書籍を検索するフロー」「書籍を予約するフロー」で社外の利用者が Web 画面から任意の時間に操作し、アクター「タイマー」の日次バッチ（リマインド・延滞判定）が定時起動するため、窓口時間を超える稼働が必要。プリインタビュー「24/7、DR は 24h 許容」を採用"
                source_model: "BUC: 自分の利用状況を確認するフロー / 書籍を検索するフロー / 返却期限を通知するフロー、アクター: タイマー"
                confidence: "medium"
              - id: "A.1.1.2"
                name: "運用時間（特定日）"
                important: false
                grade: 0
                grade_description: "規定なし"
                reason: "モデルシステム2のデフォルト値を適用（RDRA に休館日・特定日の稼働要件の記述なし）"
                source_model: ""
                confidence: "default"
              - id: "A.1.1.3"
                name: "計画停止の有無"
                important: true
                grade: 3
                grade_description: "不定期に計画停止あり（事前通知3日前）"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
          - id: "A.1.2"
            name: "サービス切替時間"
            important: true
            metrics:
              - id: "A.1.2.1"
                name: "サービス切替時間"
                important: true
                grade: 3
                grade_description: "60分未満（コールドスタンバイ）"
                reason: "モデルシステム2のデフォルト値を適用（A.1.1.1 の 1 時間程度の停止許容と整合）"
                source_model: ""
                confidence: "default"
      - id: "A.2"
        name: "耐障害性"
        items:
          - id: "A.2.1"
            name: "サーバ"
            important: true
            metrics:
              - id: "A.2.1.1"
                name: "サーバ内の冗長化"
                important: true
                grade: 3
                grade_description: "N+1冗長（手動切替）"
                reason: "モデルシステム2のデフォルト値を適用（デプロイ環境未定のためクラウド補正は未適用）"
                source_model: ""
                confidence: "default"
          - id: "A.2.2"
            name: "端末"
            important: false
            metrics:
              - id: "A.2.2.1"
                name: "端末の冗長化"
                important: false
                grade: 1
                grade_description: "冗長化なし"
                reason: "モデルシステム2のデフォルト値を適用（司書の窓口端末は汎用 PC で代替可能）"
                source_model: ""
                confidence: "default"
          - id: "A.2.3"
            name: "ネットワーク機器"
            important: true
            metrics:
              - id: "A.2.3.1"
                name: "ネットワーク機器の冗長化"
                important: true
                grade: 2
                grade_description: "一部機器の冗長化"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
          - id: "A.2.4"
            name: "ネットワーク回線"
            important: false
            metrics:
              - id: "A.2.4.1"
                name: "回線の冗長化"
                important: false
                grade: 2
                grade_description: "一部回線の冗長化"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
          - id: "A.2.5"
            name: "ストレージ"
            important: true
            metrics:
              - id: "A.2.5.1"
                name: "ストレージの冗長化"
                important: true
                grade: 2
                grade_description: "RAID5（パリティ）"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
          - id: "A.2.6"
            name: "建物・電源"
            important: true
            metrics:
              - id: "A.2.6.1"
                name: "建物の耐震・免震"
                important: false
                grade: 2
                grade_description: "耐震構造"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
              - id: "A.2.6.2"
                name: "電源の冗長化"
                important: true
                grade: 2
                grade_description: "UPS（無停電電源装置）"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
      - id: "A.3"
        name: "災害対策"
        items:
          - id: "A.3.1"
            name: "災害対策"
            important: true
            metrics:
              - id: "A.3.1.1"
                name: "災害対策の範囲"
                important: true
                grade: 1
                grade_description: "バックアップを遠隔地に保管"
                reason: "プリインタビュー「DR は RPO/RTO 24h 許容」を採用。1 館運用で被災時は窓口の手作業で代替できるため待機拠点を設けず遠隔地バックアップに留める（M2 標準 Lv2 から引き下げ）"
                source_model: "システム概要: 1館の図書館を対象"
                confidence: "medium"
              - id: "A.3.1.2"
                name: "業務継続の要否"
                important: true
                grade: 1
                grade_description: "業務継続要（24時間以内に復旧）"
                reason: "貸出・返却・予約の窓口業務は 1 日程度なら紙台帳で代替可能だが、返却期限リマインド・督促の自動送信が止まるため 24 時間以内の復旧を要する"
                source_model: "BUC: 返却期限を通知するフロー / 延滞者に督促するフロー"
                confidence: "medium"
      - id: "A.4"
        name: "回復性"
        items:
          - id: "A.4.1"
            name: "目標復旧水準"
            important: true
            metrics:
              - id: "A.4.1.1"
                name: "RPO（目標復旧地点）"
                important: true
                grade: 2
                grade_description: "数時間前まで"
                reason: "状態モデル「書籍の状態」「貸出の状態」「予約の状態」の 3 種で貸出中・予約中の進行中取引を管理しており、当日の貸出・予約記録の消失は窓口混乱を招く。金銭取引はないためデータ損失ゼロ（Lv4）までは不要"
                source_model: "状態: 書籍の状態 / 貸出の状態 / 予約の状態"
                confidence: "medium"
              - id: "A.4.1.2"
                name: "RTO（目標復旧時間）"
                important: true
                grade: 3
                grade_description: "2時間以内"
                reason: "貸出・返却は窓口のリアルタイム処理であり、開館時間中の長時間停止は窓口業務に直結する。M2 標準を適用"
                source_model: "BUC: 書籍を貸し出すフロー / 書籍を返却するフロー"
                confidence: "medium"
              - id: "A.4.1.3"
                name: "RLO（目標復旧レベル）"
                important: false
                grade: 2
                grade_description: "平常時の80%の処理能力"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
```

### categories[id=B]

```yaml
  - id: "B"
    name: "性能・拡張性"
    subcategories:
      - id: "B.1"
        name: "業務処理量"
        items:
          - id: "B.1.1"
            name: "通常時の業務量"
            important: true
            metrics:
              - id: "B.1.1.1"
                name: "同時アクセス数"
                important: true
                grade: 1
                grade_description: "〜100"
                reason: "プリインタビュー「〜1,000 ユーザー」を採用。司書は数名、社外の利用者の Web 照会も 1 館の登録利用者に限られるため同時 100 未満（M2 標準 Lv3 から引き下げ）"
                source_model: "アクター: 司書 / 利用者、システム概要: 1館の図書館を対象"
                confidence: "medium"
              - id: "B.1.1.2"
                name: "データ量"
                important: false
                grade: 1
                grade_description: "〜100万件/年（蔵書数万件＋貸出・予約・通知の年間明細を含めて総容量 100GB 未満）"
                reason: "プリインタビュー「〜100万件/年」を採用。情報は 8 エンティティで、明細系は貸出・予約・通知の 3 つに限られる"
                source_model: "情報: 書籍 / 貸出 / 予約 / 通知"
                confidence: "medium"
              - id: "B.1.1.3"
                name: "オンラインリクエスト件数"
                important: true
                grade: 2
                grade_description: "〜10,000件/日"
                reason: "登録利用者〜1,000 人の検索・予約・利用状況照会と司書の窓口操作（貸出・返却・蔵書管理）を合算しても 1 日 1 万件未満と推定"
                source_model: "BUC: 書籍を検索するフロー / 書籍を貸し出すフロー / 自分の利用状況を確認するフロー"
                confidence: "medium"
              - id: "B.1.1.4"
                name: "バッチ処理件数"
                important: false
                grade: 1
                grade_description: "1回あたり〜10万件（貸出中の全貸出をリマインド・延滞判定で日次走査）"
                reason: "アクター「タイマー」の日次バッチが UC「リマインド対象を抽出する」「延滞を判定する」で貸出中の貸出を走査する。貸出件数は蔵書数を超えないため 10 万件未満と推定するが、蔵書規模の記述がなく弱い推論"
                source_model: "アクター: タイマー、UC: リマインド対象を抽出する / 延滞を判定する"
                confidence: "low"
          - id: "B.1.2"
            name: "ピーク時の業務量"
            important: true
            metrics:
              - id: "B.1.2.1"
                name: "ピーク時同時アクセス数"
                important: true
                grade: 2
                grade_description: "通常時の2倍"
                reason: "モデルシステム2のデフォルト値を適用（プリインタビュー「10〜100 rps」の範囲内。返却通知メール直後の予約者アクセス集中を想定）"
                source_model: ""
                confidence: "default"
              - id: "B.1.2.2"
                name: "ピーク時データ量"
                important: false
                grade: 1
                grade_description: "通常時の2倍（新刊入荷日・長期休暇前でも 1 日あたり数千件の明細追加に留まる）"
                reason: "貸出・予約・通知の明細が 1 日に数千件を超える業務は RDRA にないが、季節変動の記述もないため弱い推論"
                source_model: "情報: 貸出 / 予約 / 通知"
                confidence: "low"
      - id: "B.2"
        name: "性能目標値"
        items:
          - id: "B.2.1"
            name: "オンライン"
            important: true
            metrics:
              - id: "B.2.1.1"
                name: "レスポンスタイム"
                important: true
                grade: 3
                grade_description: "5秒以内"
                reason: "アクター「利用者」（社外）向けの蔵書検索画面・予約画面・利用状況画面が中心のため、一般利用者向け画面操作の基準 5 秒以内を適用"
                source_model: "アクター: 利用者、UC: 書籍を検索する / 予約を登録する / 貸出履歴を参照する"
                confidence: "medium"
              - id: "B.2.1.2"
                name: "スループット"
                important: true
                grade: 2
                grade_description: "〜50 TPS"
                reason: "プリインタビュー「10〜100 rps」を採用。同時アクセス〜100・1 日 1 万件の規模では 50 TPS で十分"
                source_model: "アクター: 司書 / 利用者"
                confidence: "medium"
              - id: "B.2.1.3"
                name: "ターンアラウンドタイム"
                important: false
                grade: 2
                grade_description: "10秒以内（在庫状況一覧・人気書籍ランキング・期間別貸出統計の集計要求から表示まで）"
                reason: "BUC「蔵書の利用状況を分析するフロー」の集計 UC は司書向け内部操作のため、管理者向け基準 10 秒以内を適用"
                source_model: "BUC: 蔵書の利用状況を分析するフロー、条件: 人気書籍ランキング判定 / 集計期間判定"
                confidence: "medium"
          - id: "B.2.2"
            name: "バッチ"
            important: true
            metrics:
              - id: "B.2.2.1"
                name: "バッチ処理時間"
                important: true
                grade: 2
                grade_description: "8時間以内"
                reason: "モデルシステム2のデフォルト値を適用（日次バッチは夜間〜早朝の 8 時間枠で完了すればリマインド・督促の当日送信に間に合う）"
                source_model: "アクター: タイマー"
                confidence: "default"
              - id: "B.2.2.2"
                name: "バッチ処理量"
                important: false
                grade: 1
                grade_description: "1回あたり〜10万件（貸出中の貸出走査＋通知レコード生成）"
                reason: "UC「リマインド対象を抽出する」「延滞を判定する」の対象は貸出中の貸出に限られるが、蔵書規模が RDRA に無いため弱い推論"
                source_model: "UC: リマインド対象を抽出する / 延滞を判定する、情報: 通知"
                confidence: "low"
      - id: "B.3"
        name: "リソース拡張性"
        items:
          - id: "B.3.1"
            name: "CPU"
            important: true
            metrics:
              - id: "B.3.1.1"
                name: "CPU拡張性"
                important: true
                grade: 2
                grade_description: "スケールアウト（サーバ追加）"
                reason: "アクター「利用者」が社外の一般ユーザーで Web 公開するため、利用者増に備えてスケールアウト可能な構成とする"
                source_model: "アクター: 利用者（社外・受益者）"
                confidence: "medium"
          - id: "B.3.2"
            name: "メモリ"
            important: false
            metrics:
              - id: "B.3.2.1"
                name: "メモリ拡張性"
                important: false
                grade: 1
                grade_description: "スケールアップ（メモリ増設・インスタンスタイプ変更）"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
          - id: "B.3.3"
            name: "ストレージ"
            important: false
            metrics:
              - id: "B.3.3.1"
                name: "ストレージ拡張性"
                important: false
                grade: 2
                grade_description: "オンライン拡張可能（無停止でボリューム追加）"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
          - id: "B.3.4"
            name: "ネットワーク"
            important: false
            metrics:
              - id: "B.3.4.1"
                name: "ネットワーク拡張性"
                important: false
                grade: 1
                grade_description: "帯域増強は計画停止を伴う"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
      - id: "B.4"
        name: "性能品質保証"
        items:
          - id: "B.4.1"
            name: "性能テスト"
            important: true
            metrics:
              - id: "B.4.1.1"
                name: "性能テスト"
                important: true
                grade: 3
                grade_description: "負荷テスト（ピーク時想定）"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
```

### categories[id=E]

```yaml
  - id: "E"
    name: "セキュリティ"
    subcategories:
      - id: "E.1"
        name: "前提条件・制約条件"
        items:
          - id: "E.1.1"
            name: "セキュリティポリシー"
            important: true
            metrics:
              - id: "E.1.1.1"
                name: "セキュリティポリシー"
                important: true
                grade: 2
                grade_description: "組織のセキュリティポリシーに準拠"
                reason: "情報「利用者」に氏名・連絡先の個人情報を保持し社外の利用者に公開するため、簡易ガイドライン（Lv1）では不足。図書館を運営する組織のポリシーに準拠する"
                source_model: "情報: 利用者（氏名・連絡先）、アクター: 利用者（社外）"
                confidence: "medium"
          - id: "E.1.2"
            name: "セキュリティ関連法規"
            important: false
            metrics:
              - id: "E.1.2.1"
                name: "準拠すべき法規・基準"
                important: false
                grade: 2
                grade_description: "個人情報保護法・不正アクセス禁止法に準拠（貸出履歴は思想信条を推知しうるためプライバシー配慮が特に必要）"
                reason: "情報「利用者」の氏名・メールアドレス・電話番号・住所は個人情報であり、UC「貸出履歴を参照する」の履歴は要配慮情報に準じる"
                source_model: "情報: 利用者 / 貸出、UC: 貸出履歴を参照する"
                confidence: "high"
      - id: "E.2"
        name: "セキュリティリスク分析"
        items:
          - id: "E.2.1"
            name: "リスク分析"
            important: true
            metrics:
              - id: "E.2.1.1"
                name: "セキュリティリスク分析"
                important: true
                grade: 2
                grade_description: "リスク分析（脅威・脆弱性評価）"
                reason: "個人情報を保持し Web 公開するシステムのため、簡易チェックリストでは不足。M2 標準を適用"
                source_model: "情報: 利用者、アクター: 利用者（社外）"
                confidence: "medium"
      - id: "E.3"
        name: "セキュリティ診断"
        items:
          - id: "E.3.1"
            name: "セキュリティ診断"
            important: true
            metrics:
              - id: "E.3.1.1"
                name: "セキュリティ診断"
                important: true
                grade: 1
                grade_description: "ツールによる自動診断"
                reason: "社外公開の Web 画面があるため診断なし（Lv0）は不可だが、1 館・小規模で予算制約が想定されるため手動診断（M2 標準 Lv2）から引き下げた弱い推論"
                source_model: "アクター: 利用者（社外）"
                confidence: "low"
      - id: "E.4"
        name: "セキュリティリスク管理"
        items:
          - id: "E.4.1"
            name: "リスク管理"
            important: false
            metrics:
              - id: "E.4.1.1"
                name: "リスク管理プロセス"
                important: false
                grade: 1
                grade_description: "年1回のリスク棚卸しと、利用ミドルウェアの脆弱性情報の定期確認"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
      - id: "E.5"
        name: "アクセス・利用制限"
        items:
          - id: "E.5.1"
            name: "認証"
            important: true
            metrics:
              - id: "E.5.1.1"
                name: "認証方式"
                important: true
                grade: 2
                grade_description: "ID/パスワード認証＋パスワードポリシー（複雑性・有効期限）"
                reason: "アクターは司書・利用者・タイマーの 3 種で、条件「利用状況閲覧範囲判定」により本人限定の情報を Web で参照するためパスワードポリシー付き認証を要する。外部 IdP 連携は RDRA になく MFA（M2 標準 Lv3）は過剰と判断（todo DIST-002 の認証方式仮採用と整合）"
                source_model: "アクター: 司書 / 利用者 / タイマー、条件: 利用状況閲覧範囲判定"
                confidence: "medium"
          - id: "E.5.2"
            name: "アクセス制御"
            important: true
            metrics:
              - id: "E.5.2.1"
                name: "アクセス制御"
                important: true
                grade: 2
                grade_description: "ロールベースアクセス制御（RBAC）"
                reason: "バリエーション「利用者区分（司書・利用者）」と条件「利用状況閲覧範囲判定」で役割別に操作範囲を切り替えることが明示されている"
                source_model: "バリエーション: 利用者区分、条件: 利用状況閲覧範囲判定"
                confidence: "high"
          - id: "E.5.3"
            name: "利用制限"
            important: false
            metrics:
              - id: "E.5.3.1"
                name: "利用制限"
                important: false
                grade: 1
                grade_description: "司書向け管理機能（蔵書・利用者管理、貸出・返却登録）は館内ネットワークからのみ利用可、利用者向け検索・予約・照会はインターネットへ公開"
                reason: "アクター「司書」は社内・提供者、「利用者」は社外・受益者と社内外が区別されているため、機能ごとに接続元を分ける"
                source_model: "アクター: 司書（社内）/ 利用者（社外）"
                confidence: "medium"
      - id: "E.6"
        name: "データ秘匿"
        items:
          - id: "E.6.1"
            name: "暗号化"
            important: true
            metrics:
              - id: "E.6.1.1"
                name: "データ暗号化（保管時）"
                important: true
                grade: 1
                grade_description: "機密データのみ暗号化（利用者の氏名・連絡先、認証情報、貸出履歴）"
                reason: "情報「利用者」に氏名・メールアドレス・電話番号・住所の個人情報が含まれる。クレジット情報等はなく全データ暗号化（Lv2）までは不要"
                source_model: "情報: 利用者（氏名・連絡先）"
                confidence: "high"
              - id: "E.6.1.2"
                name: "データ暗号化（通信時）"
                important: true
                grade: 2
                grade_description: "全通信暗号化（内部通信を含む）"
                reason: "外部システム「メール配信サービス」との通信と社外の利用者からの Web アクセスがあり、M1/M2 とも Lv2 が標準"
                source_model: "外部システム: メール配信サービス、アクター: 利用者（社外）"
                confidence: "high"
          - id: "E.6.2"
            name: "データマスキング"
            important: false
            metrics:
              - id: "E.6.2.1"
                name: "データマスキング"
                important: false
                grade: 1
                grade_description: "テスト環境・開発環境では利用者の氏名・連絡先を匿名化データへ置換する"
                reason: "情報「利用者」の個人情報をテスト環境へそのまま複製しないための措置"
                source_model: "情報: 利用者（氏名・連絡先）"
                confidence: "medium"
      - id: "E.7"
        name: "不正追跡・監視"
        items:
          - id: "E.7.1"
            name: "監査ログ"
            important: true
            metrics:
              - id: "E.7.1.1"
                name: "監査ログ"
                important: true
                grade: 2
                grade_description: "ログイン/ログアウト＋データアクセスログ"
                reason: "社外の利用者と管理操作を行う司書が存在し、条件「利用状況閲覧範囲判定」の本人限定参照を検証するためデータアクセスログが必要。金銭取引がないため改ざん検知（Lv3）までは不要"
                source_model: "アクター: 司書 / 利用者、条件: 利用状況閲覧範囲判定"
                confidence: "high"
          - id: "E.7.2"
            name: "不正監視"
            important: false
            metrics:
              - id: "E.7.2.1"
                name: "不正監視"
                important: false
                grade: 1
                grade_description: "ログイン失敗の連続検知とアカウントロック"
                reason: "利用者番号とパスワードによる Web ログインが前提（todo DIST-002）のため、総当たり攻撃への基本対策を置く"
                source_model: "アクター: 利用者（社外）"
                confidence: "medium"
      - id: "E.8"
        name: "ネットワーク対策"
        items:
          - id: "E.8.1"
            name: "ファイアウォール"
            important: true
            metrics:
              - id: "E.8.1.1"
                name: "ファイアウォール"
                important: true
                grade: 2
                grade_description: "ステートフルインスペクション"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
          - id: "E.8.2"
            name: "IDS/IPS"
            important: false
            metrics:
              - id: "E.8.2.1"
                name: "IDS/IPS"
                important: false
                grade: 1
                grade_description: "IDS による検知のみ（自動遮断は行わない）"
                reason: "社外公開があるため検知は必要だが、小規模のため IPS 運用まで求めない弱い推論"
                source_model: "アクター: 利用者（社外）"
                confidence: "low"
          - id: "E.8.3"
            name: "ネットワーク分離"
            important: false
            metrics:
              - id: "E.8.3.1"
                name: "ネットワーク分離"
                important: false
                grade: 2
                grade_description: "DMZ（Web層）と内部セグメント（DB層）を分離し、個人情報を保持する DB は外部から直接到達不可とする"
                reason: "情報「利用者」の個人情報を保持する DB を社外の利用者から直接到達させない"
                source_model: "情報: 利用者、アクター: 利用者（社外）"
                confidence: "medium"
      - id: "E.9"
        name: "マルウェア対策"
        items:
          - id: "E.9.1"
            name: "マルウェア対策"
            important: true
            metrics:
              - id: "E.9.1.1"
                name: "マルウェア対策"
                important: true
                grade: 2
                grade_description: "ウイルス対策ソフト導入＋定義ファイル自動更新＋定期スキャン"
                reason: "モデルシステム2のデフォルト値を適用"
                source_model: ""
                confidence: "default"
      - id: "E.10"
        name: "Web対策"
        items:
          - id: "E.10.1"
            name: "WAF"
            important: true
            metrics:
              - id: "E.10.1.1"
                name: "WAF"
                important: true
                grade: 1
                grade_description: "基本的な WAF ルール適用（マネージドルールセットのデフォルト適用）"
                reason: "利用者向け検索・予約画面を社外へ公開するため WAF なし（M1 標準 Lv0）は避けるが、カスタムルール運用（M2 標準 Lv2）は小規模には過剰と推定した弱い推論"
                source_model: "アクター: 利用者（社外）、UC: 書籍を検索する / 予約を登録する"
                confidence: "low"
          - id: "E.10.2"
            name: "Webアプリケーション対策"
            important: false
            metrics:
              - id: "E.10.2.1"
                name: "Webアプリケーション対策"
                important: false
                grade: 2
                grade_description: "XSS/SQLインジェクション/CSRF 対策をフレームワーク標準機能とコーディング規約で担保し、リリース前に自動診断を実施"
                reason: "UC「書籍を検索する」は利用者入力（キーワード・ISBN 等）を検索条件に用いるため、インジェクション対策が必須"
                source_model: "UC: 書籍を検索する、条件: 書籍検索条件判定"
                confidence: "medium"
      - id: "E.11"
        name: "セキュリティインシデント対応"
        items:
          - id: "E.11.1"
            name: "インシデント対応"
            important: true
            metrics:
              - id: "E.11.1.1"
                name: "インシデント対応計画"
                important: true
                grade: 2
                grade_description: "インシデント対応手順書＋定期訓練"
                reason: "個人情報漏えい時は個人情報保護法に基づく報告義務があるため、連絡体制のみ（Lv1）では不足"
                source_model: "情報: 利用者（氏名・連絡先）"
                confidence: "medium"
```

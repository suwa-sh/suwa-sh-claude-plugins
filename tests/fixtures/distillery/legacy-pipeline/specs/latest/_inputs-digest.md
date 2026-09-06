design_available: true
event_id: 20260902_205713_spec_generation

# arch ダイジェスト

- 転写元: `docs/arch/latest/arch-design.yaml`
- source_sha256: `46834e61c919f9cd983aae0b6e149c7cc5b7ac1e448018bbd37c400fb295a321`
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
    - "TypeScript"
  frameworks:
    - "SPA フレームワーク（コンポーネント指向 / ルーティング内蔵）"
    - "サーバサイド Web フレームワーク（レイヤードアーキテクチャ対応 / DI 可能）"
    - "OpenAPI 準拠の API 定義とコード生成"
    - "RDB マイグレーションツール"
  constraints:
    - "モノレポ構成（利用者ポータル / 司書ポータル / 共有コンポーネントパッケージ / バックエンド API / ワーカーを単一リポジトリで管理）"
    - "モジュラモノリス（BC-001〜BC-006 をバックエンド API 内のモジュールとして分離。BC-007 は tier-external-gateway に実装）"
    - "ベンダーニュートラルなテクノロジー選定（具体的なクラウドサービス名は dist-infrastructure ステージで確定）"
    - "認証は外部マネージド IdP に委譲し、認可は RBAC + バックエンド作り込み（認可サービスは導入しない）"
    - "日本語のみ（i18n 対応は行わないが、日付・数値の書式はロケール API 経由で記述する）"
    - "司書向け機能は館内ネットワークからのみアクセス可能（NFR E.5.3.1）"
```

## domain_architecture

```yaml
domain_architecture:
  subdomains:
    - id: "SD-001"
      name: "蔵書貸出・予約"
      type: "core"
      investment_policy: "最優先で深いモデリングと継続的リファクタリングに投資。チーム最強の人材を配置"
      related_buc_ids:
        - "BUC-004"
        - "BUC-005"
        - "BUC-006"
        - "BUC-010"
        - "BUC-011"
      reason: "システム概要が「貸出・返却・予約を Web 画面から行えるようにする」ことを本システムの目的として明示しており、貸出可否判定・返却期限自動設定・予約順位/取置きという業務ルールの密度が最も高い。図書館サービスの価値の中心であり、外部調達で置き換えられない。ただしシステム概要に「競争優位」「差別化」の明示的キーワードは無いため経営判断の確認が必要"
      source_model: "システム概要: 貸出・返却・予約の一元管理, BUC: 書籍を貸し出すフロー/書籍を返却するフロー/書籍を予約するフロー/貸出履歴を確認するフロー/予約状況を確認するフロー, 条件: 貸出可否条件/予約可否条件/予約順位決定条件"
      confidence: "medium"
    - id: "SD-002"
      name: "蔵書目録"
      type: "supporting"
      investment_policy: "good enough な品質で安定運用。標準的なフレームワーク採用"
      related_buc_ids:
        - "BUC-001"
        - "BUC-003"
      reason: "書籍マスタの登録・編集・削除と検索は貸出・予約業務の前提となる基盤だが、それ自体は差別化要因ではない。資料種別による将来の電子書籍対応の拡張点を持つため、標準的な CRUD + 検索で十分"
      source_model: "BUC: 蔵書を管理するフロー/書籍を検索するフロー, 情報: 書籍, 条件: 書籍検索条件/蔵書削除可否条件/資料種別利用可否条件"
      confidence: "medium"
    - id: "SD-003"
      name: "利用者管理"
      type: "supporting"
      investment_policy: "good enough な品質で安定運用。標準的なフレームワーク採用"
      related_buc_ids:
        - "BUC-002"
      reason: "利用者の登録・編集・削除とアカウント役割管理は貸出・予約の前提条件（利用者登録ポリシー）を支える業務。中核業務を支援するが差別化要因ではない"
      source_model: "BUC: 利用者を管理するフロー, 情報: 利用者/利用者アカウント, 条件: 利用者削除可否条件/個人情報参照可否条件"
      confidence: "medium"
    - id: "SD-004"
      name: "通知配信"
      type: "generic"
      investment_policy: "外部 SaaS / ライブラリ採用、自作回避。コスト効率優先"
      related_buc_ids:
        - "BUC-007"
        - "BUC-008"
        - "BUC-009"
      reason: "取置き案内・返却期限リマインド・延滞督促のメール送信は外部システム「メール配信サービス」の機能カテゴリ（メール）と一致する汎用機能。送信基盤は自作せず外部サービスを利用する。ただし通知対象の判定条件（取置き通知対象条件・リマインド通知対象条件・督促通知対象条件）は業務ルールであり、この点は要確認"
      source_model: "外部システム: メール配信サービス, BUC: 予約者へ通知するフロー/返却期限をリマインドするフロー/延滞を督促するフロー, 情報: 通知"
      confidence: "high"
    - id: "SD-005"
      name: "蔵書分析"
      type: "supporting"
      investment_policy: "good enough な品質で安定運用。標準的なフレームワーク採用"
      related_buc_ids:
        - "BUC-012"
        - "BUC-013"
      reason: "在庫状況・人気書籍ランキング・期間別貸出統計は司書の選書・運用改善を支援する派生情報であり、貸出業務の実績から導出される。中核業務を支援するが差別化要因ではない"
      source_model: "BUC: 在庫状況を把握するフロー/貸出統計を把握するフロー, 情報: 統計レポート, 条件: 在庫状況集計条件/貸出統計集計条件"
      confidence: "medium"
  bounded_contexts:
    - id: "BC-001"
      name: "蔵書コンテキスト"
      ubiquitous_language:
        - term: "書籍"
          definition: "図書館が所蔵する資料の目録上の1件。書籍ID で一意に識別し、タイトル・著者・ISBN・出版社・ジャンル・資料種別を持つ。貸出コンテキストでの「貸出対象物」、分析コンテキストでの「集計軸」とは関心が異なる"
        - term: "書籍状態"
          definition: "蔵書1冊の在庫状況（在庫あり／貸出中／予約待ち）。貸出可否判定・検索結果の在庫表示・在庫集計の基準となる、蔵書コンテキストが唯一の更新責任を持つ状態"
        - term: "資料種別"
          definition: "紙書籍／電子書籍の区分。初期リリースでは紙書籍のみ有効で、将来の電子書籍対応に備えた拡張点"
        - term: "除籍"
          definition: "蔵書から書籍を外すこと。在庫ありかつ有効な予約が無い場合に限り許可される"
      related_subdomain_id: "SD-002"
      owned_entity_ids:
        - "E-001"
      owned_buc_ids:
        - "BUC-001"
        - "BUC-003"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「蔵書管理」に対応。書籍と書籍状態の更新責任を単一の境界に閉じることで、貸出・予約・分析から在庫の解釈が分岐するのを防ぐ。主アクターは司書（登録・編集・削除）と利用者（検索・在庫照会）"
      source_model: "情報: 書籍（コンテキスト=蔵書管理）, 状態: 書籍状態, BUC: 蔵書を管理するフロー/書籍を検索するフロー, 条件: 蔵書削除可否条件/書籍検索条件/返却後状態決定条件"
      confidence: "medium"
    - id: "BC-002"
      name: "利用者コンテキスト"
      ubiquitous_language:
        - term: "利用者"
          definition: "図書館の利用登録を行った人。利用者番号で一意に識別し、氏名・連絡先・利用者区分を持つ。貸出コンテキストでの「貸出責任者」、通知コンテキストでの「宛先」とは関心が異なる"
        - term: "利用者アカウント"
          definition: "ログイン済み操作者の識別単位。役割（司書／利用者）と有効フラグを持ち、本人限定参照の判定に使う"
        - term: "利用者状態"
          definition: "登録済み／取引進行中の区分。進行中の貸出・予約がある間は取引進行中となり、退会（削除）できない"
        - term: "利用者区分"
          definition: "一般／学生／団体。貸出可能冊数や貸出期間などの利用条件を決める属性"
      related_subdomain_id: "SD-003"
      owned_entity_ids:
        - "E-002"
        - "E-003"
        - "E-901"
      owned_buc_ids:
        - "BUC-002"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「利用者管理」に対応。個人情報（氏名・メールアドレス）と認証情報（ログインID・役割）を単一の境界に集約し、他コンテキストからは利用者番号での参照に限定してデータ感度を局所化する"
      source_model: "情報: 利用者/利用者アカウント（コンテキスト=利用者管理）, 状態: 利用者状態, BUC: 利用者を管理するフロー, アクター: 司書/利用者, 条件: 利用者削除可否条件/個人情報参照可否条件"
      confidence: "medium"
    - id: "BC-003"
      name: "貸出コンテキスト"
      ubiquitous_language:
        - term: "貸出"
          definition: "どの利用者にどの書籍をいつ貸したかの記録1件。貸出ID で一意に識別し、返却期限と返却日を持つ"
        - term: "返却期限"
          definition: "貸出日に利用者区分に対応する貸出期間区分の日数を加算して自動設定される期日。リマインド・督促の判定基準"
        - term: "延滞"
          definition: "返却期限を超過した貸出の状態。督促メールの送信対象となり、返却登録で解消する"
        - term: "貸出履歴"
          definition: "返却済みとなった過去の貸出。利用者本人の照会対象であり、貸出統計の集計対象として保持される"
      related_subdomain_id: "SD-001"
      owned_entity_ids:
        - "E-004"
      owned_buc_ids:
        - "BUC-004"
        - "BUC-005"
        - "BUC-010"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「貸出管理」に対応。貸出状態（貸出中／延滞／返却済み）が予約状態・書籍状態と独立したライフサイクルを持ち、貸出・返却・履歴照会の UC 群が同一エンティティに閉じる"
      source_model: "情報: 貸出（コンテキスト=貸出管理）, 状態: 貸出状態, BUC: 書籍を貸し出すフロー/書籍を返却するフロー/貸出履歴を確認するフロー, 条件: 貸出可否条件/返却期限設定条件"
      confidence: "medium"
    - id: "BC-004"
      name: "予約コンテキスト"
      ubiquitous_language:
        - term: "予約"
          definition: "貸出中の書籍に対する利用者の順番待ちの申込1件。予約ID で一意に識別し、申込日時・予約順位・取置き状況を持つ"
        - term: "予約順位"
          definition: "同一書籍への予約を申込日時の昇順で並べた順番。貸出済み／キャンセルの予約は対象から外し、後続を繰り上げる"
        - term: "取置き"
          definition: "予約順1位の利用者のために返却された書籍を確保している状態。取置き期限までに来館がなければキャンセルし次順位へ引き継ぐ"
      related_subdomain_id: "SD-001"
      owned_entity_ids:
        - "E-005"
      owned_buc_ids:
        - "BUC-006"
        - "BUC-011"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「予約管理」に対応。予約順位の決定と取置きの引き継ぎという固有の業務ルールを持ち、状態.tsv でも予約状態が独立したライフサイクル（予約中／取置き中／貸出済み／キャンセル）を形成する"
      source_model: "情報: 予約（コンテキスト=予約管理）, 状態: 予約状態, BUC: 書籍を予約するフロー/予約状況を確認するフロー, 条件: 予約可否条件/重複予約禁止条件/予約順位決定条件/取置き中書籍貸出条件"
      confidence: "medium"
    - id: "BC-005"
      name: "通知コンテキスト"
      ubiquitous_language:
        - term: "通知"
          definition: "取置き案内・返却期限リマインド・延滞督促のメール送信1件の記録。送信待ち／送信済み／送信失敗で送信進行を管理し、重複送信防止と未達追跡に使う"
        - term: "通知種別"
          definition: "取置き案内／返却期限リマインド／延滞督促。送信の契機と文面を使い分ける区分"
        - term: "通知タイミング区分"
          definition: "期限前リマインド／期限当日／期限超過督促。いつ送るかの判定基準となる区分"
        - term: "宛先"
          definition: "通知の送信先メールアドレス。利用者コンテキストの連絡先を送信時点で解決した値"
      related_subdomain_id: "SD-004"
      owned_entity_ids:
        - "E-006"
        - "E-902"
      owned_buc_ids:
        - "BUC-007"
        - "BUC-008"
        - "BUC-009"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「通知管理」に対応。通知状態が送信の進行のみを扱い、貸出・予約のライフサイクルから独立している。タイマー駆動（返却期限接近判定日次タイマー／返却期限超過判定日次タイマー）で起動する非同期領域として境界を切る"
      source_model: "情報: 通知（コンテキスト=通知管理）, 状態: 通知状態, BUC: 予約者へ通知するフロー/返却期限をリマインドするフロー/延滞を督促するフロー, 外部システム: メール配信サービス, 条件: 取置き通知対象条件/リマインド通知対象条件/督促通知対象条件"
      confidence: "medium"
    - id: "BC-006"
      name: "蔵書分析コンテキスト"
      ubiquitous_language:
        - term: "統計レポート"
          definition: "在庫状況・人気書籍ランキング・期間別貸出統計の集計結果1件。集計中／作成済み／実績なしで作成進行を管理する"
        - term: "集計期間区分"
          definition: "日次／月次／年次。貸出実績とランキングを同一粒度で比較するための期間単位"
        - term: "在庫状況区分"
          definition: "分析文脈における書籍状態の集計軸（在庫あり／貸出中／予約待ち）。蔵書コンテキストの「書籍状態」を読み取り専用に射影したもの"
      related_subdomain_id: "SD-005"
      owned_entity_ids:
        - "E-007"
      owned_buc_ids:
        - "BUC-012"
        - "BUC-013"
      team_ownership: null
      reason: "情報.tsv のコンテキスト「分析管理」に対応。書籍と貸出の実績を読み取り専用に集計する派生情報の領域であり、更新責任を持たないため独立した BC として読み取りモデルを分離できる"
      source_model: "情報: 統計レポート（コンテキスト=分析管理）, 状態: 統計レポート状態, BUC: 在庫状況を把握するフロー/貸出統計を把握するフロー, 条件: 在庫状況集計条件/貸出統計集計条件"
      confidence: "medium"
    - id: "BC-007"
      name: "メール配信コンテキスト"
      ubiquitous_language:
        - term: "メール送信依頼"
          definition: "外部メール配信サービスへ渡す送信要求。宛先アドレスと本文を持つ、外部サービス側の語彙"
        - term: "配信結果"
          definition: "外部メール配信サービスが返す送信可否。通知コンテキストの送信済み／送信失敗へ翻訳される"
      related_subdomain_id: "SD-004"
      owned_entity_ids: []
      owned_buc_ids: []
      team_ownership: null
      reason: "外部システム「メール配信サービス」を独立 BC として明示し、コンテキストマップ上で統合パターン（ACL）を宣言するためのプレースホルダ。自システムのエンティティ・BUC は所有しない"
      source_model: "外部システム: メール配信サービス, BUC: 予約者へ通知するフロー/返却期限をリマインドするフロー/延滞を督促するフロー（イベント: 取置き案内メール送信依頼/返却期限リマインドメール送信依頼/延滞督促メール送信依頼）"
      confidence: "medium"
  context_map:
    - id: "CM-001"
      from_bc_id: "BC-003"
      to_bc_id: "BC-001"
      pattern: "ohs"
      direction: "downstream"
      translator_description: "蔵書コンテキストが「在庫状況照会」「貸出時の在庫あり→貸出中への状態変更」「返却時の状態更新」を公開インタフェースとして提供し、貸出コンテキストはそれを利用する。書籍状態の更新責任は蔵書側に残す"
      integration_events: []
      reason: "蔵書コンテキストは貸出・予約・分析の3つの下流を持つため、上流に OHS + Published Language を置いて在庫参照/更新の契約を一本化する"
      source_model: "状態: 書籍状態（貸出を登録する→貸出中）, 条件: 貸出可否条件/返却後状態決定条件, BUC: 書籍を貸し出すフロー/書籍を返却するフロー"
      confidence: "medium"
    - id: "CM-002"
      from_bc_id: "BC-004"
      to_bc_id: "BC-001"
      pattern: "ohs"
      direction: "downstream"
      translator_description: "予約コンテキストが蔵書コンテキストの公開インタフェースで書籍状態を参照して予約可否（貸出中のみ受付）を判定し、取置き成立時に予約待ちへの状態変更を依頼する"
      integration_events: []
      reason: "同じ蔵書コンテキストの公開契約を予約側も利用する。下流が複数のため OHS + Published Language を維持する"
      source_model: "条件: 予約可否条件/返却後状態決定条件, 状態: 書籍状態（予約待ち）, BUC: 書籍を予約するフロー"
      confidence: "medium"
    - id: "CM-003"
      from_bc_id: "BC-003"
      to_bc_id: "BC-004"
      pattern: "customer_supplier"
      direction: "downstream"
      translator_description: "返却受付時に貸出コンテキストが予約コンテキストへ「対象書籍に有効な予約があるか」を問い合わせ、取置き中の予約に対する貸出成立を通知する。予約順位の解釈は予約側に閉じ、貸出側は可否と対象利用者番号のみ受け取る"
      integration_events: []
      reason: "返却時取置き優先ポリシーと取置き中書籍貸出条件で貸出と予約が双方向に関わるが、順位ロジックの所有者は予約側であるため貸出を顧客、予約を供給者とする Customer-Supplier とする"
      source_model: "条件: 返却後状態決定条件/取置き中書籍貸出条件, 状態: 予約状態（取置き中→貸出済み）, BUC: 書籍を返却するフロー/書籍を貸し出すフロー"
      confidence: "medium"
    - id: "CM-004"
      from_bc_id: "BC-003"
      to_bc_id: "BC-002"
      pattern: "ohs"
      direction: "downstream"
      translator_description: "利用者コンテキストが「利用者番号による貸出対象利用者の特定」「利用者区分の提供」を公開インタフェースとして提供する。貸出コンテキストは利用者番号のみを保持し、氏名・連絡先は保持しない"
      integration_events: []
      reason: "利用者コンテキストは貸出・予約・通知の3つの下流を持つ。個人情報を上流に閉じ込め、下流には識別子と利用条件だけを渡すため OHS とする"
      source_model: "情報: 利用者/貸出（利用者番号）, 条件: 貸出可否条件/返却期限設定条件（利用者区分）, BUC: 書籍を貸し出すフロー"
      confidence: "medium"
    - id: "CM-005"
      from_bc_id: "BC-004"
      to_bc_id: "BC-002"
      pattern: "ohs"
      direction: "downstream"
      translator_description: "予約コンテキストが利用者コンテキストの公開インタフェースで登録済み利用者を確認し、予約に利用者番号のみを保持する"
      integration_events: []
      reason: "利用者登録ポリシーにより予約は登録済み利用者に限定される。個人情報の局所化のため CM-004 と同じ OHS 契約を利用する"
      source_model: "情報: 利用者/予約（利用者番号）, 状態: 利用者状態（予約を登録する→取引進行中）, BUC: 書籍を予約するフロー"
      confidence: "medium"
    - id: "CM-006"
      from_bc_id: "BC-005"
      to_bc_id: "BC-003"
      pattern: "customer_supplier"
      direction: "downstream"
      translator_description: "通知コンテキストが貸出コンテキストから「返却期限接近の貸出」「延滞対象の貸出」を取得し、通知1件へ翻訳する。延滞への状態遷移そのものは貸出コンテキストが行う"
      integration_events: []
      reason: "リマインド・督促の対象抽出は貸出データに依存するが、通知の送信進行は通知側に閉じる。通知が顧客、貸出が供給者"
      source_model: "条件: リマインド通知対象条件/督促通知対象条件, 状態: 貸出状態（貸出中／延滞）, BUC: 返却期限をリマインドするフロー/延滞を督促するフロー"
      confidence: "medium"
    - id: "CM-007"
      from_bc_id: "BC-005"
      to_bc_id: "BC-004"
      pattern: "customer_supplier"
      direction: "downstream"
      translator_description: "通知コンテキストが予約コンテキストから「予約順1位かつ予約中の予約」を取得して取置き案内を送信し、送信成功を予約側へ返して取置き中への遷移を促す"
      integration_events: []
      reason: "取置き通知対象条件は予約順位ロジックに依存するため、判定の所有者は予約側。通知は対象を受け取って送信のみ担う"
      source_model: "条件: 取置き通知対象条件/予約順位決定条件, 状態: 予約状態（予約中→取置き中）, BUC: 予約者へ通知するフロー"
      confidence: "medium"
    - id: "CM-008"
      from_bc_id: "BC-005"
      to_bc_id: "BC-002"
      pattern: "ohs"
      direction: "downstream"
      translator_description: "通知コンテキストが利用者コンテキストの公開インタフェースで宛先メールアドレスを解決し、通知レコードには送信時点の宛先を記録する"
      integration_events: []
      reason: "連絡先は個人情報であり利用者コンテキストが唯一の正データを持つ。下流には送信時点の宛先のみを渡す"
      source_model: "情報: 利用者（連絡先）/通知（宛先メールアドレス）, BUC: 予約者へ通知するフロー/返却期限をリマインドするフロー/延滞を督促するフロー"
      confidence: "medium"
    - id: "CM-009"
      from_bc_id: "BC-006"
      to_bc_id: "BC-001"
      pattern: "ohs"
      direction: "downstream"
      translator_description: "蔵書分析コンテキストが蔵書コンテキストの公開インタフェースから書籍と書籍状態を読み取り専用で取得し、在庫状況区分という集計軸へ射影する"
      integration_events: []
      reason: "分析は更新責任を持たない読み取り専用の下流。上流の公開契約をそのまま利用する"
      source_model: "条件: 在庫状況集計条件, 情報: 書籍/統計レポート, BUC: 在庫状況を把握するフロー"
      confidence: "medium"
    - id: "CM-010"
      from_bc_id: "BC-006"
      to_bc_id: "BC-003"
      pattern: "ohs"
      direction: "downstream"
      translator_description: "蔵書分析コンテキストが貸出コンテキストの公開インタフェースから返却済みを含む貸出実績を読み取り専用で取得し、貸出件数・書籍別貸出回数へ集計する"
      integration_events: []
      reason: "貸出統計は貸出実績の派生情報。更新責任を持たない読み取り専用の下流として OHS を利用する"
      source_model: "条件: 貸出統計集計条件, 状態: 貸出状態（返却済みを集計対象として保持）, BUC: 貸出統計を把握するフロー"
      confidence: "medium"
    - id: "CM-011"
      from_bc_id: "BC-005"
      to_bc_id: "BC-007"
      pattern: "acl"
      direction: "downstream"
      translator_description: "通知コンテキストが外部メール配信サービスの API モデル（メール送信依頼・配信結果）を ACL で隔離し、自身の通知状態（送信待ち／送信済み／送信失敗）へ翻訳する。外部障害時の再送は通知側の送信失敗→送信待ちの遷移として表現する"
      integration_events: []
      reason: "外部システム連携であり、外部 API のモデル変更が通知の業務モデルへ波及しないよう ACL で隔離する。送信失敗の再送・未達追跡という自ドメインの関心を外部モデルから守る"
      source_model: "外部システム: メール配信サービス, 状態: 通知状態（送信失敗→送信待ち）, BUC: 予約者へ通知するフロー/返却期限をリマインドするフロー/延滞を督促するフロー"
      confidence: "high"
  aggregate_hypotheses:
    - id: "AG-001"
      bounded_context_id: "BC-001"
      root_entity_id: "E-001"
      member_entity_ids: []
      invariants:
        - "書籍状態が「在庫あり」であり、かつ予約状態が「予約中」「取置き中」の予約が存在しない場合に限り削除を許可する"
        - "資料種別が「紙書籍」の蔵書のみ初期リリースで登録・貸出の対象とし、「電子書籍」は登録しない"
        - "返却受付時に有効な予約（予約中）が存在する場合は書籍状態を「予約待ち」とし、存在しない場合は「在庫あり」とする"
      note: "仮説。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 書籍, 状態: 書籍状態, 条件: 蔵書削除可否条件/資料種別利用可否条件/返却後状態決定条件"
      confidence: "low"
    - id: "AG-002"
      bounded_context_id: "BC-002"
      root_entity_id: "E-002"
      member_entity_ids:
        - "E-003"
      invariants:
        - "貸出状態が「貸出中」「延滞」の貸出、および予約状態が「予約中」「取置き中」の予約が存在しない場合に限り利用者を削除できる"
        - "貸出・予約は登録済み利用者に限定する"
        - "貸出履歴・予約状況の照会はログイン中の利用者本人に紐づくもののみを対象とする"
      note: "仮説。最終確定は dist-spec または ddd-tactical-implementation で行う。利用者アカウントを別集約に分離する案もある（認証情報のライフサイクルが利用者と異なる場合）"
      source_model: "情報: 利用者/利用者アカウント, 状態: 利用者状態, 条件: 利用者削除可否条件/個人情報参照可否条件"
      confidence: "low"
    - id: "AG-003"
      bounded_context_id: "BC-003"
      root_entity_id: "E-004"
      member_entity_ids: []
      invariants:
        - "書籍状態が「在庫あり」であり、かつ貸出先が登録済みで利用可能な利用者であるときに限り貸出を許可する"
        - "貸出記録の作成時に、貸出日を起点として利用者区分に対応する貸出期間区分の日数を加算した日を返却期限として自動設定する"
        - "貸出状態が「返却済み」になった時点で督促を停止し、以降の状態遷移を行わない"
      note: "仮説。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 貸出, 状態: 貸出状態, 条件: 貸出可否条件/返却期限設定条件/督促通知対象条件"
      confidence: "low"
    - id: "AG-004"
      bounded_context_id: "BC-004"
      root_entity_id: "E-005"
      member_entity_ids: []
      invariants:
        - "書籍状態が「貸出中」の書籍に対してのみ予約を受け付ける"
        - "同一利用者が同一書籍に対して「予約中」または「取置き中」の予約を既に持つ場合、再度の予約申込を受け付けない"
        - "同一書籍への予約は申込日時の昇順で順位を付与し、「貸出済み」「キャンセル」の予約は順位対象から除外して後続を繰り上げる"
        - "予約状態が「取置き中」の書籍は、取置き対象である予約順1位の利用者に対してのみ貸出を許可する"
      note: "仮説。最終確定は dist-spec または ddd-tactical-implementation で行う。同一書籍の予約列全体を1集約（書籍単位の予約待ち行列）とする案は強整合と競合の観点で要検討"
      source_model: "情報: 予約, 状態: 予約状態, 条件: 予約可否条件/重複予約禁止条件/予約順位決定条件/取置き中書籍貸出条件"
      confidence: "low"
    - id: "AG-005"
      bounded_context_id: "BC-005"
      root_entity_id: "E-006"
      member_entity_ids: []
      invariants:
        - "メール配信サービスへの送信が成功した通知は送信済みとし、同一対象への重複送信を抑止する"
        - "書籍状態が「予約待ち」となった書籍について、予約順1位かつ予約中の予約1件のみを取置き通知の対象とする"
        - "貸出状態が「返却済み」の貸出はリマインド・督促の対象外とする"
      note: "仮説。最終確定は dist-spec または ddd-tactical-implementation で行う"
      source_model: "情報: 通知, 状態: 通知状態, 条件: 取置き通知対象条件/リマインド通知対象条件/督促通知対象条件"
      confidence: "low"
    - id: "AG-006"
      bounded_context_id: "BC-006"
      root_entity_id: "E-007"
      member_entity_ids: []
      invariants:
        - "蔵書全件を書籍状態（在庫あり／貸出中／予約待ち）で区分し、区分ごとの件数と書籍一覧を集計する"
        - "対象期間に貸出実績が存在しない場合は「実績なし」として扱い、作成済みとしない"
      note: "仮説。最終確定は dist-spec または ddd-tactical-implementation で行う。集計明細は書籍と貸出から導出する読み取りモデルであり、集約として保持するか都度算出するかは Part 3（データ）と要調整"
      source_model: "情報: 統計レポート, 状態: 統計レポート状態, 条件: 在庫状況集計条件/貸出統計集計条件"
      confidence: "low"
  diagram_mermaid: |
    graph LR
      BC1["蔵書コンテキスト"]
      BC2["利用者コンテキスト"]
      BC3["貸出コンテキスト"]
      BC4["予約コンテキスト"]
      BC5["通知コンテキスト"]
      BC6["蔵書分析コンテキスト"]
      BC7["メール配信コンテキスト"]
      BC3 -->|OHS+PL| BC1
      BC4 -->|OHS+PL| BC1
      BC3 -->|Customer-Supplier| BC4
      BC3 -->|OHS+PL| BC2
      BC4 -->|OHS+PL| BC2
      BC5 -->|Customer-Supplier| BC3
      BC5 -->|Customer-Supplier| BC4
      BC5 -->|OHS+PL| BC2
      BC6 -->|OHS+PL| BC1
      BC6 -->|OHS+PL| BC3
      BC5 -->|ACL| BC7
```

## system_architecture.tiers

```yaml
  tiers:
    - id: "tier-frontend-patron"
      name: "利用者ポータル"
      description: "図書館利用者向けの Web UI。書籍検索・在庫状況照会・予約申込/取消・自分の貸出内容/返却期限/貸出履歴/予約状況/取置き状況の照会を提供する。インターネットへ公開する"
      technology_candidates:
        - "SPA"
        - "CDN"
      policies:
        - id: "SP-001"
          name: "マルチデバイス対応"
          description: "PC とタブレットを主対象としたレスポンシブ UI を提供し、主要ブラウザ 3 種（最新版）で動作させる。スマートフォン対応の要否は別途確認する"
          reason: "利用者照会は PC/タブレットからの利用が想定され、NFR で対応ブラウザ 2-3 種が定義されている"
          source_model: "アクター: 利用者, NFR F.1.1.1, NFR F.1.1.2, NFR F.1.1.3"
          confidence: "medium"
        - id: "SP-002"
          name: "アクセシビリティ準拠"
          description: "JIS X 8341-3:2016 レベル AA 準拠を目標として、意味的な HTML・キーボード操作・コントラスト比を設計要件に含める"
          reason: "公共図書館の利用者向け画面としてアクセシビリティ目標が NFR で明示されている"
          source_model: "NFR F.3.1.2"
          confidence: "high"
        - id: "SP-003"
          name: "静的コンテンツの CDN 配信"
          description: "HTML/CSS/JS 等の静的アセットを CDN から配信し、アプリケーションサーバの負荷とレスポンスタイムを削減する（Static Content Hosting パターン）"
          reason: "レスポンスタイム 5 秒以内の目標と 100Mbps 帯域の制約下で、画面主体のアプリの配信コストを下げるため"
          source_model: "NFR B.2.1.1, NFR F.1.2.2"
          confidence: "medium"
        - id: "SP-004"
          name: "本人限定参照の UI 制約"
          description: "貸出履歴・予約状況・取置き状況の画面はログイン中の利用者本人に紐づくデータのみを表示し、他利用者のデータへ到達する導線を持たない"
          reason: "条件「個人情報参照可否条件」が自分の〜を照会する系 10 UC に適用され、貸出履歴は読書傾向という機微情報であるため"
          source_model: "条件: 個人情報参照可否条件, NFR E.1.2.1"
          confidence: "high"
      rules:
        - id: "SR-001"
          name: "API 経由のデータアクセス"
          description: "フロントエンドからデータストアへの直接アクセスを禁止し、必ず API Gateway 経由で Backend API を呼び出す"
          reason: "セキュリティとデータ整合性の確保"
          source_model: "なし"
          confidence: "default"
        - id: "SR-002"
          name: "冪等キーの付与と二重送信防止"
          description: "予約申込・予約取消などの状態変更リクエストごとに冪等キー（UUID）を生成して X-Idempotency-Key ヘッダに付与し、送信ボタンの二度押し防止 UI 制御を併用する"
          reason: "社外アクターがインターネット経由で予約という状態変更操作を行うため、リトライによる重複登録リスクがある"
          source_model: "アクター: 利用者（社外）, BUC: 書籍を予約するフロー"
          confidence: "high"
        - id: "SR-003"
          name: "trace_id の生成と伝播"
          description: "リクエストごとに trace_id を生成し、W3C Trace Context ヘッダで後続ティアへ伝播する"
          reason: "アプリケーション監視とアクセスログ・操作ログの横断検索を成立させるため"
          source_model: "NFR C.1.3.1, NFR C.6.1.2"
          confidence: "medium"
        - id: "SR-004"
          name: "日本語単一ロケール"
          description: "表示テキストは日本語のみとし i18n リソースバンドルは導入しない。日付・数値の書式はロケール API 経由で記述し、将来の多言語化の拡張点だけ残す"
          reason: "RDRA に多言語・海外・グローバルのシグナルがなく、1 館運用が前提であるため"
          source_model: "システム概要: まずは 1 館での運用を想定, バリエーション: 言語バリエーションなし"
          confidence: "high"
    - id: "tier-frontend-staff"
      name: "司書ポータル"
      description: "司書向けの Web UI。蔵書/利用者の登録・編集・削除、窓口での貸出・返却・予約取消、延滞照会、在庫状況・貸出統計レポート参照を提供する。館内ネットワークからのみ利用する"
      technology_candidates:
        - "SPA"
      policies:
        - id: "SP-005"
          name: "館内ネットワーク限定公開"
          description: "司書向け管理機能は館内ネットワークからのみ到達可能とし、インターネットからは公開しない"
          reason: "NFR の利用制限で司書向け管理機能を館内ネットワーク限定と定義しているため"
          source_model: "NFR E.5.3.1, NFR E.8.3.1"
          confidence: "high"
        - id: "SP-006"
          name: "窓口業務優先の操作設計"
          description: "貸出・返却・予約取消の窓口オペレーションを最小操作数で完了できる高密度 UI とし、レポート参照は別導線に分ける"
          reason: "司書は窓口で利用者を待たせながら貸出・返却を処理するため操作効率が要件になる"
          source_model: "アクター: 司書, BUC: 書籍を貸し出すフロー / 書籍を返却するフロー"
          confidence: "medium"
        - id: "SP-007"
          name: "PC 単一デバイス最適化"
          description: "司書窓口の対応デバイスを PC に限定し、レスポンシブ対応の優先度を下げる"
          reason: "NFR の対応デバイスで司書窓口が PC と定義されているため"
          source_model: "NFR F.1.1.1, NFR F.1.1.3"
          confidence: "medium"
      rules:
        - id: "SR-005"
          name: "司書ロールの検証"
          description: "司書ポータルの全画面は司書ロールを持つトークンでのみ操作可能とし、利用者ロールのトークンでは到達できない"
          reason: "ロールベースアクセス制御で司書機能と利用者機能を分離するため"
          source_model: "情報: 利用者アカウント（役割）, NFR E.5.2.1"
          confidence: "high"
        - id: "SR-006"
          name: "個人情報表示の最小化"
          description: "画面に表示する利用者の氏名・連絡先を業務上必要な範囲に限定し、ブラウザのローカルストレージへ個人情報を永続化しない"
          reason: "個人情報保護法準拠と、貸出履歴が思想信条を推知しうるというプライバシー配慮の要求があるため"
          source_model: "NFR E.1.2.1, NFR E.6.2.1"
          confidence: "high"
    - id: "tier-api-gateway"
      name: "API Gateway"
      description: "2 ポータルからのリクエストを受け、TLS 終端・WAF・IP 制限・トークン検証・粗粒度 RBAC・レート制限を集約する境界ティア（Gatekeeper / Gateway Offloading パターン）"
      technology_candidates:
        - "API Gateway"
        - "リバースプロキシ"
        - "WAF"
      policies:
        - id: "SP-008"
          name: "セキュリティオフロード"
          description: "TLS 終端・WAF マネージドルールセット適用・IP 制限・IdP 発行トークンの検証・ロールによる粗粒度 RBAC を Gateway に集約し、Backend API から横断的関心事を外す"
          reason: "WAF・アクセス制御・利用制限・全通信暗号化の要求を 1 箇所で満たすため"
          source_model: "NFR E.10.1.1, NFR E.5.2.1, NFR E.5.3.1, NFR E.6.1.2"
          confidence: "high"
        - id: "SP-009"
          name: "ポータル別の経路分離"
          description: "利用者ポータル経路（インターネット公開・DMZ）と司書ポータル経路（館内ネットワーク限定）をリスナーレベルで分離し、司書向け API を外部から到達不可にする"
          reason: "利用制限とネットワーク分離の要求により、司書向け管理機能と利用者向け照会の露出面を分ける必要があるため"
          source_model: "NFR E.5.3.1, NFR E.8.3.1, アクター: 司書（社内）/ 利用者（社外）"
          confidence: "high"
        - id: "SP-010"
          name: "レート制限"
          description: "IP 単位・アカウント単位のレート制限を適用し、ログイン試行の連続失敗と照会 API の過剰呼び出しを抑止する"
          reason: "ログイン失敗の連続検知とアカウントロックという不正監視要件を境界で補完するため"
          source_model: "NFR E.7.2.1, NFR B.1.2.1"
          confidence: "medium"
      rules:
        - id: "SR-007"
          name: "認可責務の分界"
          description: "Gateway はロールによる粗粒度判定（司書 / 利用者）までを担当し、リソース所有者判定（本人限定参照）と状態ベース判定は Backend API の Domain 層が行う"
          reason: "本人限定参照は貸出・予約という業務データの所有関係に依存し、Gateway が持つ属性だけでは判定できないため"
          source_model: "条件: 個人情報参照可否条件, NFR E.5.2.1"
          confidence: "high"
        - id: "SR-008"
          name: "タイムアウト階層の最上位"
          description: "Gateway のタイムアウトを Backend API より長く設定し、レスポンスタイム目標 5 秒から逆算した上限値を段階的に定義する（Gateway > Backend API > 外部連携）"
          reason: "リソースの無限占有を防ぎつつ、正常リクエストを Gateway で切断しないため"
          source_model: "NFR B.2.1.1, NFR B.2.1.2"
          confidence: "medium"
        - id: "SR-009"
          name: "アクセスログの全件出力"
          description: "全リクエストのアクセスログ（trace_id, user_id, 経路, ステータス, 応答時間）を構造化ログとして出力し、監査ログ基盤へ転送する"
          reason: "アクセスログ + 操作ログ + 監査ログの出力とデータアクセスログの取得が要求されているため"
          source_model: "NFR E.7.1.1, NFR C.6.1.2"
          confidence: "high"
    - id: "tier-idp"
      name: "IdP（アイデンティティプロバイダー）"
      description: "司書・利用者の認証、トークン発行、パスワードポリシー適用、アカウントロック、パスワードリセットを担う独立ティア。API Gateway はこのティアが発行したトークンを検証する"
      technology_candidates:
        - "IdP"
      policies:
        - id: "SP-011"
          name: "認証の IdP 委譲"
          description: "OAuth2/OIDC に準拠した IdP へ認証処理を委譲し、アプリケーションは認証ロジックを保持しない（Federated Identity パターン）"
          reason: "社外アクターである利用者がインターネット経由でログインするため、標準プロトコル準拠の認証基盤が必要"
          source_model: "アクター: 利用者（社外・受益者）, NFR E.5.1.1"
          confidence: "high"
        - id: "SP-012"
          name: "パスワードポリシーとアカウントロック"
          description: "複雑性・有効期限を含むパスワードポリシーを IdP で強制し、ログイン失敗の連続検知でアカウントをロックする"
          reason: "認証方式が ID/パスワード＋パスワードポリシーで、不正監視としてログイン失敗の連続検知とアカウントロックが要求されているため"
          source_model: "NFR E.5.1.1, NFR E.7.2.1"
          confidence: "high"
        - id: "SP-013"
          name: "認証情報と業務ロールの分界"
          description: "ログイン ID・パスワード・有効フラグ等の認証情報は IdP が正データとして保持し、業務上の役割（司書 / 利用者）はトークンのクレームとして伝達したうえで利用者コンテキストが業務属性を保持する"
          reason: "情報「利用者アカウント」がログインID・役割・有効フラグを持つため、IdP との責務重複を明示的に切り分ける必要がある"
          source_model: "情報: 利用者アカウント, NFR E.5.1.1"
          confidence: "medium"
      rules:
        - id: "SR-010"
          name: "トークンライフサイクル管理"
          description: "アクセストークンは短命とし、リフレッシュトークンで更新する。ログアウト時とアカウント無効化時はリフレッシュトークンを失効させる"
          reason: "セッションハイジャック防止と、利用者削除・アカウント無効化の即時反映のため"
          source_model: "NFR E.5.1.1, NFR E.7.1.1"
          confidence: "medium"
        - id: "SR-011"
          name: "認証イベントの監査ログ"
          description: "ログイン成功・失敗・ログアウト・パスワード変更・アカウントロックを監査ログとして出力し、6 ヶ月間保管する"
          reason: "監査ログとしてログイン/ログアウトとデータアクセスログの取得が要求され、ログ保管期間が 6 ヶ月と定義されているため"
          source_model: "NFR E.7.1.1, NFR C.6.1.1"
          confidence: "high"
        - id: "SR-012"
          name: "IdP 障害時の切替"
          description: "IdP の障害時はコールドスタンバイ構成から 60 分未満で切替可能とし、切替手順を復旧手順書に含める"
          reason: "認証が全機能の前提になるため、サービス切替時間 60 分未満の要求を IdP にも適用する"
          source_model: "NFR A.1.2.1, NFR A.2.1.1"
          confidence: "medium"
    - id: "tier-backend-api"
      name: "バックエンド API"
      description: "6 つの境界づけられたコンテキスト（蔵書・利用者・貸出・予約・通知・蔵書分析）をモジュールとして内包するモジュラモノリスの API ティア。窓口業務と Web 照会の全 UC を処理する"
      technology_candidates:
        - "CaaS(k8s)"
        - "FaaS"
      policies:
        - id: "SP-014"
          name: "モジュラモノリス構成"
          description: "自前の 6 BC（BC-001 蔵書 / BC-002 利用者 / BC-003 貸出 / BC-004 予約 / BC-005 通知 / BC-006 蔵書分析）を単一デプロイ単位の中のモジュールとして分割し、モジュール間はコンテキストマップの公開契約経由で連携する"
          reason: "BC は 6 個あるがアクター 2 種・同時アクセス 100 以下・1 館運用の規模であり、マイクロサービス分割の運用コストが見合わない。一方でコンテキスト分割されたモジュラ構成が拡張性要件として明示されている"
          source_model: "BC: BC-001〜BC-006, NFR F.2.2.1, NFR B.1.1.1"
          confidence: "medium"
        - id: "SP-015"
          name: "水平スケールアウト"
          description: "ステートレスな API インスタンスを LB 配下に N+1 で配置し、ピーク時（通常時の 2 倍）にインスタンス追加で対応する"
          reason: "サーバ内の冗長化が N+1、CPU 拡張性がスケールアウト、ピーク時同時アクセス数が通常時の 2 倍と定義されているため"
          source_model: "NFR A.2.1.1, NFR B.3.1.1, NFR B.1.1.3, NFR B.1.2.1"
          confidence: "medium"
        - id: "SP-016"
          name: "リソース所有者ベース認可の Domain 層強制"
          description: "貸出・予約・利用者情報・取置き状況の照会は、トークンの利用者番号と対象データの利用者番号の一致を Domain 層で必ず検証する。ロールによる粗粒度判定だけに依存しない"
          reason: "個人情報参照可否条件が本人限定参照を要求し、貸出履歴・予約状況は個人情報かつ読書傾向という高感度データであるため、RBAC 単独では不足する"
          source_model: "条件: 個人情報参照可否条件, 情報: 利用者/貸出/予約, NFR E.5.2.1, NFR E.1.2.1"
          confidence: "high"
        - id: "SP-017"
          name: "在庫整合のトランザクション境界"
          description: "貸出登録・返却登録・予約登録/取消と、それに伴う書籍状態・予約順位の更新を単一の RDB トランザクション内で完結させる"
          reason: "貸出可否条件・予約順位決定条件・返却後状態決定条件が書籍状態と予約状態の同時整合を要求し、進行中取引の消失が窓口業務と矛盾するため"
          source_model: "条件: 貸出可否条件 / 予約順位決定条件 / 返却後状態決定条件, NFR A.4.1.1"
          confidence: "high"
        - id: "SP-018"
          name: "レポート集計の分離"
          description: "在庫状況・人気書籍ランキング・期間別貸出統計の集計処理を照会系 API から切り離し、長時間化する集計は Worker ティアへ委譲して結果を参照する形にする"
          reason: "ターンアラウンドタイム 10 秒以内・レスポンスタイム 5 秒以内の目標があり、蔵書全件走査を同期処理に含めると目標を超過するため"
          source_model: "BUC: 在庫状況を把握するフロー / 貸出統計を把握するフロー, NFR B.2.1.1, NFR B.2.1.3"
          confidence: "medium"
      rules:
        - id: "SR-013"
          name: "冪等キーによる重複検知"
          description: "状態変更操作（貸出登録・返却登録・予約登録/取消・利用者登録）で受け取った冪等キーを KVS に記録し、重複リクエストには前回レスポンスを返却する"
          reason: "社外アクターのリトライと窓口での二重操作による重複登録を防止するため"
          source_model: "アクター: 利用者（社外）, BUC: 書籍を貸し出すフロー / 書籍を予約するフロー"
          confidence: "high"
        - id: "SR-014"
          name: "モジュール間の直接参照禁止"
          description: "モジュール間で他モジュールのテーブルを直接参照せず、コンテキストマップ（CM-001〜CM-010）で定義した公開契約（OHS+PL / Customer-Supplier）経由でのみアクセスする"
          reason: "BC 境界を実装レベルで維持し、将来のサービス分割を可能にするため"
          source_model: "コンテキストマップ: CM-001〜CM-010, NFR F.2.2.1"
          confidence: "medium"
        - id: "SR-015"
          name: "ヘルスチェックエンドポイント"
          description: "プロセス生存確認（shallow）と RDB/KVS/MQ 接続確認（deep）の 2 種のヘルスチェックエンドポイントを公開し、LB の振り分け判定と監視に用いる"
          reason: "N+1 冗長構成の切替判定と、サーバ＋ネットワーク＋アプリケーション監視の要求を満たすため"
          source_model: "NFR A.2.1.1, NFR C.1.3.1, NFR C.1.3.3"
          confidence: "medium"
        - id: "SR-016"
          name: "Web アプリケーション脆弱性対策"
          description: "XSS / SQL インジェクション / CSRF 対策をフレームワーク標準機能とコーディング規約で担保し、リリース前にツールによる自動診断を実施する"
          reason: "Web アプリケーション対策と自動セキュリティ診断が要求されているため"
          source_model: "NFR E.10.2.1, NFR E.3.1.1"
          confidence: "high"
        - id: "SR-017"
          name: "ログへの個人情報非出力"
          description: "氏名・メールアドレス・パスワードをログ本文に出力せず、利用者番号などの識別子のみを context に記録する"
          reason: "機密データの暗号化とデータマスキング、個人情報保護法準拠の要求があるため"
          source_model: "NFR E.6.1.1, NFR E.6.2.1, NFR C.6.1.2"
          confidence: "high"
    - id: "tier-worker"
      name: "バックエンドワーカー"
      description: "日次タイマー起点のバッチ処理（返却期限接近判定・期限超過判定）と、MQ を消費する非同期処理（取置き案内・リマインド・督促メールの送信、レポート集計）を担うティア"
      technology_candidates:
        - "CronJob(k8s)"
        - "FaaS"
      policies:
        - id: "SP-019"
          name: "日次タイマージョブ"
          description: "返却期限接近の貸出判定と期限超過の貸出の延滞遷移を日次タイマーで実行し、対象貸出から通知送信要求を生成する"
          reason: "BUC にタイマー起動のアクティビティが 2 件あり、貸出状態の延滞遷移がタイマー契機で発生するため"
          source_model: "BUC: 返却期限をリマインドするフロー / 延滞を督促するフロー, 状態: 貸出状態（貸出中→延滞）"
          confidence: "high"
        - id: "SP-020"
          name: "通知送信の非同期消費"
          description: "取置き案内・返却期限リマインド・延滞督促のメール送信を MQ から消費して処理し、コンシューマー数の増減でスループットを調整する（Competing Consumers パターン）"
          reason: "外部イベントとして 3 種のメール送信依頼があり、バッチ処理量が 1 回あたり最大 10 万件と定義されているため"
          source_model: "BUC: 予約者へ通知するフロー / 返却期限をリマインドするフロー / 延滞を督促するフロー, NFR B.1.1.4, NFR B.2.2.2"
          confidence: "medium"
        - id: "SP-021"
          name: "バッチ実行計画"
          description: "日次バッチの実行時間を 8 時間以内に収め、深夜の計画停止枠（1 時〜4 時）およびバックアップ取得時間帯と競合しない時間帯に配置する"
          reason: "バッチ処理時間が 8 時間以内、バックアップ時間帯と計画停止枠が深夜 1〜4 時と定義されているため"
          source_model: "NFR B.2.2.1, NFR C.1.1.2, NFR C.1.1.3"
          confidence: "medium"
        - id: "SP-032"
          name: "中断許容インフラの優先適用"
          description: "冪等消費・重複実行検知（SR-018）が保証された非同期処理（通知送信の MQ コンシューマー、日次バッチ）に対し、中断許容インフラ（プリエンプティブル/スポットインスタンス相当）をコスト最適化のため優先的に適用する。中断時は再配信・再実行の仕組みで安全に回復できることを前提とする"
          reason: "インフラ設計（MCL product-design）の結果に基づく: product-cost-hints.yaml の spot_candidates で worker_consumer / worker_scheduled が中断許容ワークロードとして特定され、SR-018 の冪等性が前提条件として明記されたため"
          source_model: "infra: product-cost-hints.yaml → spot_candidates"
          confidence: "medium"
      rules:
        - id: "SR-018"
          name: "重複実行・重複消費の検知"
          description: "CronJob はジョブ実行 ID で重複実行を検知し、MQ コンシューマーはメッセージ ID で重複メッセージを検知して、同一通知の二重送信を防止する"
          reason: "情報「通知」の説明に重複送信防止と未達の追跡が明示されているため"
          source_model: "情報: 通知（重複送信防止）, 状態: 通知状態"
          confidence: "high"
        - id: "SR-019"
          name: "非同期処理のトレーサビリティ"
          description: "CronJob はジョブ実行ごとに新規 trace_id を発行し、MQ メッセージには trace_id と parent span_id を伝播する。ティア入口で新たな span_id を発行する"
          reason: "非同期処理を含む全ティア横断のトレーサビリティを確保するため"
          source_model: "NFR C.1.3.1, NFR C.6.1.2"
          confidence: "medium"
        - id: "SR-020"
          name: "リトライ上限と DLQ 退避"
          description: "メール送信の再試行上限を超えたメッセージは DLQ へ退避し、通知状態を「送信失敗」として記録したうえでアラートを通知する"
          reason: "情報「通知」が送信失敗状態を持ち未達の追跡に使われること、および監視ツールによる障害検知とアラート通知が要求されていること"
          source_model: "状態: 通知状態（送信失敗）, NFR C.3.1.1, NFR C.3.2.1"
          confidence: "high"
        - id: "SR-021"
          name: "劣化兆候の WARN ログ"
          description: "キュー深度・リトライ率・ジョブ実行時間の増加を WARN レベルの劣化兆候ログとして出力し、しきい値は外部設定化する"
          reason: "アプリケーション監視とバッチ処理時間の目標超過を早期検知するため"
          source_model: "NFR C.1.3.1, NFR C.3.1.1, NFR B.2.2.1"
          confidence: "medium"
    - id: "tier-messaging"
      name: "メッセージング"
      description: "通知送信要求とレポート集計要求のバッファとなる MQ ティア。DLQ を併設し、Backend API / Worker がプロデューサー、Worker がコンシューマーとなる"
      technology_candidates:
        - "MQ"
      policies:
        - id: "SP-022"
          name: "キューによる負荷平準化"
          description: "通知送信要求をキューに投入して同期処理から切り離し、日次バッチが生成する大量の通知をワーカーのペースで処理する（Queue-Based Load Leveling パターン）"
          reason: "日次バッチが貸出全件を走査して通知レコードを生成する一方、メール配信サービスの応答は同期的に待てないため"
          source_model: "BUC: 返却期限をリマインドするフロー / 延滞を督促するフロー, NFR B.1.1.4, NFR B.1.2.1"
          confidence: "medium"
        - id: "SP-023"
          name: "至少一回配信と冪等消費"
          description: "メッセージ配信は at-least-once を前提とし、コンシューマー側の冪等消費で重複を吸収する。厳密な順序保証は要求しない"
          reason: "通知は宛先・種別ごとに独立しており順序依存がなく、未達の防止が順序保証より優先されるため"
          source_model: "情報: 通知, 状態: 通知状態"
          confidence: "medium"
      rules:
        - id: "SR-022"
          name: "DLQ の監視と再処理"
          description: "DLQ のメッセージ滞留を監視対象とし、手順書に基づく手動再処理の運用手順を整備する"
          reason: "障害復旧方式が手順書に基づく手動復旧と定義されているため"
          source_model: "NFR C.3.3.1, NFR C.3.1.1"
          confidence: "medium"
        - id: "SR-023"
          name: "メッセージへの個人情報非格納"
          description: "メッセージ本文には通知 ID・利用者番号・対象貸出 ID/予約 ID の参照のみを載せ、氏名・メールアドレスなどの個人情報を格納しない"
          reason: "機密データの暗号化対象に利用者の氏名・連絡先が含まれ、保持箇所を最小化する必要があるため"
          source_model: "NFR E.6.1.1, NFR E.6.2.1"
          confidence: "high"
    - id: "tier-datastore"
      name: "データストア"
      description: "業務データの正データを保持する RDB、冪等キー・セッション・参照キャッシュを保持する KVS、バックアップと静的コンテンツを保持する Object Storage で構成する"
      technology_candidates:
        - "RDB"
        - "KVS"
        - "Object Storage"
      policies:
        - id: "SP-024"
          name: "RDB を正データとする"
          description: "書籍・利用者・利用者アカウント・貸出・予約・通知・統計レポートの 7 エンティティの正データを RDB に保持し、参照整合性とトランザクション整合性を DB で担保する"
          reason: "貸出可否・予約順位・削除可否といった条件がエンティティ間の同時整合を要求し、データ量は総容量 100GB 未満で単一 RDB に収まるため"
          source_model: "情報: 書籍/利用者/利用者アカウント/貸出/予約/通知/統計レポート, 条件: 貸出可否条件, NFR B.1.1.2"
          confidence: "high"
        - id: "SP-025"
          name: "KVS の用途限定"
          description: "KVS は冪等キー管理・セッション管理・参照系キャッシュに限定して用い、業務データの正データを保持しない"
          reason: "レスポンスタイム目標の達成と冪等性実現に必要だが、正データの二重化はデータ整合性リスクを生むため"
          source_model: "NFR B.2.1.1, NFR B.2.1.2, NFR A.4.1.1"
          confidence: "medium"
        - id: "SP-026"
          name: "書籍検索は RDB の全文索引で実現"
          description: "キーワード・タイトル・著者・ISBN・ジャンルの 5 検索軸を RDB の全文索引と複合索引で実現し、専用の検索エンジンは導入しない"
          reason: "蔵書は数万件・総容量 100GB 未満・同時アクセス 100 以下で、レスポンスタイム 5 秒以内の目標を RDB 索引で満たせる規模であるため"
          source_model: "条件: 書籍検索条件, バリエーション: 検索条件種別, NFR B.1.1.1, NFR B.1.1.2, NFR B.2.1.1"
          confidence: "medium"
        - id: "SP-027"
          name: "バックアップと遠隔地保管"
          description: "日次のフル＋差分バックアップを深夜枠（1 時〜4 時）に取得し 7 世代を保持する。バックアップは Object Storage 経由で遠隔地に保管する"
          reason: "バックアップ方式がフル＋差分（日次）、世代管理が 7 世代、災害対策がバックアップの遠隔地保管と定義されているため"
          source_model: "NFR C.1.2.1, NFR C.1.2.2, NFR C.1.2.3, NFR C.1.1.2, NFR A.3.1.1"
          confidence: "high"
        - id: "SP-028"
          name: "内部セグメント配置"
          description: "個人情報を保持する RDB を内部セグメントに配置し、DMZ の Web 層からのみ到達可能として外部から直接到達できない構成にする"
          reason: "DMZ と内部セグメントの分離、および個人情報を保持する DB の外部到達禁止が要求されているため"
          source_model: "NFR E.8.3.1, NFR E.8.1.1"
          confidence: "high"
      rules:
        - id: "SR-024"
          name: "機密データの保管時暗号化"
          description: "利用者の氏名・連絡先、利用者アカウントのパスワード、貸出履歴を保管時暗号化の対象とする"
          reason: "機密データのみ暗号化という方針で対象が明示されているため"
          source_model: "NFR E.6.1.1, NFR E.1.2.1"
          confidence: "high"
        - id: "SR-025"
          name: "冪等キーの一意制約"
          description: "状態変更を伴うテーブルの冪等キー列に UNIQUE 制約を設定し、競合時は UPSERT で重複挿入を防止する"
          reason: "アプリケーション層の重複検知が競合した場合の最終防衛線として必要"
          source_model: "アクター: 利用者（社外）, BUC: 書籍を貸し出すフロー"
          confidence: "high"
        - id: "SR-026"
          name: "RPO を満たすログ退避"
          description: "トランザクションログを定期的に退避し、日次フルバックアップと組み合わせて数時間前までの復旧（RPO）を可能にする"
          reason: "RPO が数時間前までと定義され、日次バックアップのみでは進行中の貸出・予約・通知が失われるため"
          source_model: "NFR A.4.1.1, NFR A.4.1.2, NFR C.1.2.1"
          confidence: "high"
        - id: "SR-027"
          name: "非本番環境の匿名化データ"
          description: "テスト環境・開発環境には利用者の氏名・連絡先を匿名化したデータのみを配置する"
          reason: "データマスキングでテスト環境・開発環境の匿名化が要求され、簡易テスト環境と開発環境 1 面が定義されているため"
          source_model: "NFR E.6.2.1, NFR C.4.1.1, NFR C.4.2.1"
          confidence: "high"
        - id: "SR-028"
          name: "オンライン拡張可能なストレージ"
          description: "ストレージは無停止でボリューム追加できる構成とし、冗長化はパリティ方式以上を適用する"
          reason: "ストレージ拡張性がオンライン拡張可能、ストレージの冗長化が RAID5 相当と定義されているため"
          source_model: "NFR B.3.3.1, NFR A.2.5.1"
          confidence: "medium"
    - id: "tier-external-gateway"
      name: "外部連携"
      description: "外部システム「メール配信サービス」との連携を担うアダプタティア。ACL として外部 API モデルを通知コンテキストのモデルへ翻訳する（BC-007 の実装先）"
      technology_candidates:
        - "ACL アダプタ"
      policies:
        - id: "SP-029"
          name: "ACL によるドメインモデル保護"
          description: "メール配信サービスの送信依頼・配信結果モデルをアダプタで隔離し、通知コンテキストの通知状態（送信待ち / 送信済み / 送信失敗）へ翻訳する。外部のデータ形式を Domain 層へ持ち込まない"
          reason: "外部システムのモデルが自システムの通知モデルと異なり、コンテキストマップで ACL が定義されているため"
          source_model: "外部システム: メール配信サービス, コンテキストマップ: CM-011"
          confidence: "high"
        - id: "SP-030"
          name: "外部連携の回復性スタック"
          description: "Timeout + Retry（指数バックオフ + Jitter）+ Circuit Breaker を組み合わせ、メール配信サービスの障害が通知処理全体へ波及しないようにする"
          reason: "唯一の外部依存であり、その障害時も貸出・返却・予約の主業務を継続する必要があるため"
          source_model: "外部システム: メール配信サービス, NFR A.1.2.1, NFR A.4.1.2"
          confidence: "medium"
      rules:
        - id: "SR-029"
          name: "恒久エラーの非リトライ"
          description: "宛先不正・認証エラー等の 4xx 系恒久エラーはリトライせず、通知状態を「送信失敗」として即座に記録する"
          reason: "恒久的な障害での再試行は無駄なレイテンシと負荷を生み、未達の追跡を遅らせるため"
          source_model: "状態: 通知状態（送信失敗）, 情報: 通知"
          confidence: "high"
        - id: "SR-030"
          name: "外部通信の暗号化"
          description: "メール配信サービスとの通信は SMTPS または HTTPS（TLS1.2 以上）で行い、平文通信を禁止する"
          reason: "全通信暗号化（内部通信を含む）と、通信プロトコルとして HTTPS / SMTPS が定義されているため"
          source_model: "NFR E.6.1.2, NFR F.1.2.1"
          confidence: "high"
        - id: "SR-031"
          name: "依存関係ログの出力"
          description: "外部呼び出しごとに宛先種別・応答時間・結果コードを依存関係ログとして出力し、メールアドレスはマスクする"
          reason: "アプリケーション監視の範囲に外部依存を含め、かつ個人情報をログへ残さないため"
          source_model: "NFR C.1.3.1, NFR E.6.2.1, 外部システム: メール配信サービス"
          confidence: "medium"
```

## app_architecture.tier_layers

```yaml
  tier_layers:
    - tier_id: "tier-backend-api"
      layers:
        - id: "L-backend-api-presentation"
          name: "プレゼンテーション層"
          responsibility: "Driver Side の入出力。HTTP リクエスト/レスポンスの変換、入力バリデーション、認証コンテキストの確立、アクセスログの出力"
          allowed_dependencies:
            - "L-backend-api-usecase"
          policies:
            - id: "LP-001"
              name: "入力バリデーション"
              description: "API 境界で全入力を検証する。必須項目・型・桁・書式（ISBN、メールアドレス、日付）と、バリエーション値（資料種別・ジャンル・検索条件種別・利用者区分・貸出期間区分・通知種別・レポート種別・集計期間区分）の許容値チェックを行う。業務判断を伴う判定（貸出可否・予約可否・削除可否）は domain 層に委ね、presentation では行わない"
              reason: "外部入力の安全性を境界で確保し、XSS/SQL インジェクション対策をフレームワーク標準機能と組み合わせて担保するため"
              source_model: "条件: 書籍検索条件, 資料種別利用可否条件, 返却期限設定条件, バリエーション: 9 区分, NFR E.10.2.1"
              confidence: "high"
            - id: "LP-002"
              name: "アクセスログ"
              description: "HTTP リクエスト/レスポンスのメタデータ（メソッド・パス・ステータス・処理時間）を構造化ログで出力する。2xx/3xx は INFO、4xx は WARN、5xx は ERROR とする。trace_id を受領（未設定なら発行）し span を開始して後続レイヤーへ伝播する"
              reason: "アプリケーション監視（NFR C.1.3.1 Lv3）とログ種別のアクセスログ要件（NFR C.6.1.2 Lv3）を満たすため"
              source_model: "アクター: 利用者（社外）, NFR C.1.3.1, NFR C.6.1.2"
              confidence: "medium"
            - id: "LP-003"
              name: "認証コンテキストの確立"
              description: "API Gateway で検証済みのトークンから user_id・役割（司書／利用者）・利用者番号を取り出して認証コンテキストを組み立て、usecase 層へ引数として渡す。presentation 層では役割による粗粒度の到達可否のみを判定し、本人限定参照の判定は行わない"
              reason: "所有者ベースの認可判定を domain 層に集約する方針（CTP-002 / SP-016）を守りつつ、認証情報の取り出しを 1 箇所に閉じるため"
              source_model: "情報: 利用者アカウント（役割）, 条件: 個人情報参照可否条件, NFR E.5.2.1"
              confidence: "medium"
            - id: "LP-004"
              name: "トークン期限ログ"
              description: "受領したトークンの残存有効期間がしきい値（デフォルト 5 分）を下回った場合に WARN レベルの構造化ログを出力し、degradation_type / current_value / threshold を context に含める。しきい値は設定ファイルから読み込む"
              reason: "IdP 委譲構成でトークン期限切れによる操作中断を事前に検知するため。RDRA に明示の要求がないため弱い根拠にとどまる"
              source_model: "アクター: 利用者（社外）, NFR E.5.1.1"
              confidence: "low"
          rules:
            - id: "LR-001"
              name: "DTO とドメインモデルの分離"
              description: "presentation 層の DTO は API 契約に従って定義し、domain のエンティティ・値オブジェクトをそのまま公開しない。変換は presentation 層で行う"
              reason: "API 契約とドメインモデルの変更を独立させ、内部モデルの変更が外部契約へ波及しないようにするため"
              source_model: "なし"
              confidence: "default"
            - id: "LR-002"
              name: "HTTP ステータス変換"
              description: "usecase から伝播した例外を HTTP ステータスへ変換する（業務ルール違反は 409/422、認可違反は 403、対象なしは 404、技術例外は 500）。変換時にログは出力しない（集約ポイントは usecase 層）"
              reason: "エラーハンドリング伝播方針に従い多重ログを防止するため"
              source_model: "なし"
              confidence: "default"
            - id: "LR-003"
              name: "レスポンスの PII 最小化"
              description: "一覧・検索レスポンスに氏名・連絡先を含めるのは司書ロール向け API のみとし、利用者向け API は本人の情報のみを返す"
              reason: "貸出履歴が思想信条を推知しうる機微情報であり、個人情報保護法への準拠が求められるため"
              source_model: "条件: 個人情報参照可否条件, NFR E.1.2.1, NFR E.6.1.1"
              confidence: "high"
        - id: "L-backend-api-usecase"
          name: "ユースケース層"
          responsibility: "ビジネスフロー制御、トランザクション境界の設定、冪等キー検証、監査ログの出力、例外の集約キャッチ"
          allowed_dependencies:
            - "L-backend-api-domain"
            - "L-backend-api-repository"
          policies:
            - id: "LP-005"
              name: "トランザクション境界"
              description: "貸出登録・返却登録・予約登録・予約取消は、貸出/予約エンティティの更新と書籍状態・利用者状態・予約順位の更新を単一トランザクションで確定する。通知レコードの生成とメール送信要求の MQ 発行はトランザクション外（コミット後）に行い、送信失敗は通知状態で追跡する"
              reason: "在庫（書籍状態）と取引（貸出・予約）の整合が業務の前提であり、条件「貸出可否条件」「返却後状態決定条件」「予約順位決定条件」が跨るエンティティ更新を含むため"
              source_model: "条件: 貸出可否条件, 返却後状態決定条件, 予約順位決定条件, 状態: 書籍状態, 貸出状態, 予約状態, 利用者状態"
              confidence: "medium"
            - id: "LP-006"
              name: "監査ログ"
              description: "状態遷移を伴うビジネスイベント（貸出登録・返却登録・延滞遷移・予約登録/取消/取置き・書籍と利用者の登録/編集/削除・本人限定参照の照会）を「誰が・いつ・何を・どうしたか」の構造化ログで INFO 記録する。context に user_id・役割・業務エンティティ ID（書籍ID / 貸出ID / 予約ID / 利用者番号）を含める"
              reason: "ログイン/ログアウト＋データアクセスログの監査要件と、本人限定参照の逸脱を事後追跡する要件を満たすため"
              source_model: "状態: 書籍状態, 貸出状態, 予約状態, 利用者状態, 通知状態, 条件: 個人情報参照可否条件, NFR E.7.1.1, NFR C.6.1.2"
              confidence: "high"
            - id: "LP-007"
              name: "冪等キー検証"
              description: "登録・更新系 UC（貸出登録・返却登録・予約登録/取消・書籍/利用者の登録）はクライアントが付与した冪等キーを KVS で検証し、既処理なら前回結果を返す。KVS で検知できない競合は RDB の一意制約で最終防御する"
              reason: "窓口業務での二重送信と、重複予約禁止条件の取りこぼしを防ぐため（CTP-006 の 4 層防御の usecase 分担）"
              source_model: "条件: 重複予約禁止条件, 予約可否条件, 状態: 通知状態（重複送信防止）, NFR B.2.1.2"
              confidence: "medium"
            - id: "LP-008"
              name: "Command / Query の分離（軽量 CQRS）"
              description: "usecase を Command（登録・更新・削除、19 UC）と Query（検索・照会・レポート参照、22 UC）に分離する。Command は domain の集約経由で不変条件を強制し、Query は domain を経由せず repository の読み取り専用 finder を直接利用して DTO を組み立てる。データストアは単一のまま分離しない"
              reason: "照会系が全 UC の半数超を占め読み取り負荷が優位である一方、同時アクセス〜100・50 TPS と小規模で別データストアを持つ CQRS はオーバースペックであるため、usecase 層内の分離に留める"
              source_model: "BUC: 41 UC（照会系 22 / 更新系 19）, NFR B.1.1.1, NFR B.1.2.1, NFR B.2.1.1, NFR B.2.1.3"
              confidence: "medium"
          rules:
            - id: "LR-004"
              name: "UC と usecase クラスの 1:1 対応"
              description: "RDRA の UC 1 件に対して usecase クラス 1 件を定義し、クラス名を UC 名に対応させる。UC を跨る処理は usecase から別 usecase を呼ばず、domain サービスまたは repository の再利用で表現する"
              reason: "RDRA の UC と実装のトレーサビリティを維持し、仕様変更時の影響範囲を特定しやすくするため"
              source_model: "BUC: 41 UC"
              confidence: "medium"
            - id: "LR-005"
              name: "例外の集約キャッチ"
              description: "domain 例外と repository がラップしたドメイン例外を usecase 層で集約キャッチし、ここで 1 回だけエラーログを出力する。cause chain 全体を context に含めてから presentation へ再スローする"
              reason: "多重ログを防止し、エラーの発生源から集約ポイントまでの因果を 1 レコードで追跡できるようにするため"
              source_model: "NFR C.6.1.2, NFR C.1.3.1"
              confidence: "high"
        - id: "L-backend-api-domain"
          name: "ドメイン層"
          responsibility: "ビジネスルール、エンティティ、値オブジェクト、状態遷移、不変条件の強制、所有者ベースの認可判定。ログ出力は行わない"
          allowed_dependencies: []
          policies:
            - id: "LP-009"
              name: "状態遷移の整合性保証"
              description: "書籍状態・貸出状態・予約状態・利用者状態・通知状態・統計レポート状態の 6 状態モデルについて、許可された遷移のみをドメインモデル内で実行する。許可外の遷移要求はドメイン例外をスローし、状態を変更しない"
              reason: "状態.tsv に 6 状態モデル・46 遷移が定義され、状態に依存する業務判定（貸出可否・予約可否・削除可否・通知対象）が多数存在するため"
              source_model: "状態: 書籍状態, 貸出状態, 予約状態, 利用者状態, 通知状態, 統計レポート状態"
              confidence: "high"
            - id: "LP-010"
              name: "ログ出力禁止"
              description: "domain 層は直接ログ出力を行わない。状態変化はドメインイベントの発行で、ルール違反はドメイン例外のスローで通知し、ログ出力の責務は usecase 層（監査ログ・エラーログ）に委ねる"
              reason: "ドメインロジックをログ基盤から独立させ、多重ログとテスト容易性の低下を防ぐため"
              source_model: "なし"
              confidence: "high"
            - id: "LP-011"
              name: "所有者ベースの認可判定"
              description: "貸出履歴・予約状況・取置き状況・利用者情報の照会は、認証コンテキストの利用者番号と対象エンティティの利用者番号が一致する場合のみ許可する。取置き中書籍の貸出は予約順 1 位の利用者に限定する。不一致時は認可違反のドメイン例外をスローする"
              reason: "API Gateway の粗粒度 RBAC では本人限定参照を担保できず、条件「個人情報参照可否条件」「取置き中書籍貸出条件」がリソース所有者の判定を要求するため（CTP-002 / SP-016 / SR-007）"
              source_model: "条件: 個人情報参照可否条件, 取置き中書籍貸出条件, 情報: 利用者アカウント, NFR E.5.2.1, NFR E.1.2.1"
              confidence: "high"
          rules:
            - id: "LR-006"
              name: "不変条件の集約ルートでの強制"
              description: "集約仮説 AG-001〜AG-006 の invariants を集約ルートのメソッドで強制する。集約をまたぐ判定（貸出可否・削除可否・返却後状態決定・取置き通知対象）はドメインサービスとして定義し、usecase から呼び出す"
              reason: "17 件の条件が複数エンティティの状態に跨っており、エンティティ単体では不変条件を保てないため"
              source_model: "条件: 17 件, 集約仮説: AG-001〜AG-006"
              confidence: "medium"
            - id: "LR-007"
              name: "バリエーションのストラテジー化"
              description: "利用者区分 × 貸出期間区分から返却期限日数を決める算出ロジック、通知タイミング区分からリマインド/督促の基準日数を決めるロジック、集計期間区分による集計粒度をストラテジーとして分離し、区分値の追加をコード分岐の追加なしに扱えるようにする"
              reason: "バリエーション.tsv に 9 区分があり、うち貸出期間区分・利用者区分・通知タイミング区分・集計期間区分は業務ルールの適用単位として条件から参照されているため"
              source_model: "バリエーション: 利用者区分, 貸出期間区分, 通知タイミング区分, 集計期間区分, 条件: 返却期限設定条件, リマインド通知対象条件, 督促通知対象条件"
              confidence: "medium"
            - id: "LR-008"
              name: "資料種別の拡張点の隔離"
              description: "資料種別（紙書籍／電子書籍）の利用可否判定を単一のドメインポリシーオブジェクトに閉じ、初期リリースでは電子書籍を登録・貸出の対象外とする。将来の電子書籍対応時の変更点をこのオブジェクトに限定する"
              reason: "システム概要に「将来の電子書籍対応に備えて蔵書を資料種別で区別できるモデルとする」と明記され、条件「資料種別利用可否条件」が拡張点として定義されているため"
              source_model: "条件: 資料種別利用可否条件, バリエーション: 資料種別, システム概要"
              confidence: "medium"
        - id: "L-backend-api-repository"
          name: "リポジトリ層"
          responsibility: "domain のデータアクセス方法。aggregate root と 1:1 で定義し、gateway/adapter を利用して永続化・取得を行う。技術例外をドメイン例外へラップする"
          allowed_dependencies:
            - "L-backend-api-domain"
            - "L-backend-api-gateway"
          policies: []
          rules:
            - id: "LR-009"
              name: "Aggregate Root 対応"
              description: "repository は domain の aggregate root と 1:1 で定義する（書籍・利用者・貸出・予約・通知・統計レポートの 6 種）。複数テーブルにアクセスする場合は複数の gateway/adapter を利用する"
              reason: "DDD の集約パターンに従い、データアクセスの責務を明確化するため"
              source_model: "集約仮説: AG-001〜AG-006"
              confidence: "default"
            - id: "LR-010"
              name: "メソッド命名規約"
              description: "method 名は JPA に寄せる: save, findById, findAll, deleteById など。Query 側の読み取り専用検索は findBy... 形式の finder として同一 repository 内に定義する"
              reason: "広く知られた命名規約に統一し、学習コストを低減するため"
              source_model: "なし"
              confidence: "default"
            - id: "LR-011"
              name: "技術例外のラップ"
              description: "gateway から伝播した技術例外をドメイン例外へラップし、cause に元例外を保持したまま再スローする。repository 層ではログを出力しない"
              reason: "エラーハンドリング伝播方針に従い、中間レイヤーでの多重ログを防止するため"
              source_model: "なし"
              confidence: "default"
            - id: "LR-012"
              name: "楽観ロックによる競合制御"
              description: "状態モデルを持つエンティティ（書籍・貸出・予約・利用者・通知）は更新時にバージョン列で楽観ロックを行い、競合時は OptimisticLockException を送出する。予約順位の繰り上げなど順序が意味を持つ更新は対象書籍単位で直列化する"
              reason: "窓口の貸出/返却と利用者の予約申込/取消が同一書籍に同時到達しうるため。悲観ロックはスループット 50 TPS の規模では過剰"
              source_model: "情報: 書籍, 貸出, 予約, 利用者, 通知（状態モデルあり）, 条件: 予約順位決定条件, NFR B.2.1.2"
              confidence: "medium"
        - id: "L-backend-api-gateway"
          name: "ゲートウェイ層"
          responsibility: "Driven Side の入出力。adapter（datastore model と 1:1）と client（SDK ラッパー）で構成し、RDB / KVS / Object Storage / MQ へのアクセスと依存関係ログ・劣化兆候ログを担う"
          allowed_dependencies: []
          policies:
            - id: "LP-012"
              name: "依存関係ログ"
              description: "RDB / KVS / MQ / Object Storage への呼び出しの開始・終了、処理時間、成否を構造化ログで INFO 出力する。SQL クエリとリクエスト/レスポンス本文は DEBUG とし、本番環境では無効をデフォルトとする"
              reason: "アプリケーション監視（NFR C.1.3.1 Lv3）で外部依存の遅延・失敗を切り分けられるようにするため"
              source_model: "外部システム: メール配信サービス, NFR C.1.3.1, NFR C.6.1.2"
              confidence: "medium"
            - id: "LP-013"
              name: "劣化兆候ログ"
              description: "リトライ発生・サーキットブレーカーの状態遷移・コネクションプール逼迫（デフォルト 80%）・DNS/TLS ハンドシェイク遅延を WARN レベルの構造化ログで出力する。degradation_type / current_value / threshold / action_taken を context に含め、しきい値は設定ファイルから読み込む"
              reason: "N+1 冗長（手動切替）の構成では劣化の早期検知が切替判断の起点になるため"
              source_model: "外部システム: メール配信サービス, NFR A.2.1.1, NFR C.1.3.1"
              confidence: "medium"
            - id: "LP-014"
              name: "キャッシュ劣化ログ"
              description: "KVS のキャッシュミス率上昇（デフォルト 50%）とコネクションプール逼迫を WARN レベルで出力する。しきい値は設定ファイルから読み込む"
              reason: "レスポンスタイム 5 秒以内の目標を KVS キャッシュ前提で満たす構成のため、キャッシュ効率の劣化を検知する必要があるため"
              source_model: "NFR B.2.1.1, NFR C.1.3.1"
              confidence: "medium"
            - id: "LP-015"
              name: "楽観ロック競合ログ"
              description: "楽観ロック競合（OptimisticLockException）をリトライ成功分も含め WARN レベルで出力し、対象エンティティ ID と競合回数を context に含める"
              reason: "同一書籍への貸出・返却・予約が競合する頻度を運用で把握し、直列化範囲の見直し判断に使うため"
              source_model: "情報: 書籍, 貸出, 予約（状態モデルあり）, NFR C.1.3.1"
              confidence: "medium"
            - id: "LP-016"
              name: "冪等性の保証"
              description: "MQ へのメッセージ発行にはメッセージ ID（通知 ID を利用）を付与し、再送時も同一 ID を用いて重複消費を検知可能にする。KVS の冪等キー登録は SET-if-not-exists 相当の原子操作で行う"
              reason: "外部のメール配信サービス連携を含む非同期経路で at-least-once 配信を前提とし、重複送信を抑止する必要があるため"
              source_model: "外部システム: メール配信サービス, 状態: 通知状態（重複送信防止）"
              confidence: "high"
          rules:
            - id: "LR-013"
              name: "Adapter の責務"
              description: "adapter は RDB テーブル等の datastore model と 1:1 で定義する。method 名は datastore の操作に寄せる: insert, update, delete など。ORM 利用時は自動生成コードの配置場所となる"
              reason: "datastore モデルとの対応を明確にし、変更影響範囲を限定するため"
              source_model: "なし"
              confidence: "default"
            - id: "LR-014"
              name: "Client の責務"
              description: "client は datastore を操作する SDK のラッパー。外部ライブラリの使い方に共通ルールがある場合や SDK が提供されていない場合に作成する"
              reason: "SDK の利用方法を一箇所に集約し、横断的な設定変更を容易にするため"
              source_model: "なし"
              confidence: "default"
            - id: "LR-015"
              name: "検索クエリの adapter 集約"
              description: "書籍検索（キーワード／タイトル／著者／ISBN／ジャンルの 5 軸）の全文索引・複合索引アクセスを単一の検索 adapter に集約し、検索条件種別ごとのクエリ生成をこの adapter 内に閉じる"
              reason: "将来的に専用検索エンジンへ切り替える場合の変更範囲を 1 adapter に限定するため"
              source_model: "条件: 書籍検索条件, 在庫状況集計条件, バリエーション: 検索条件種別, NFR B.2.1.1"
              confidence: "medium"
            - id: "LR-016"
              name: "機密データの暗号化適用点"
              description: "利用者の氏名・連絡先、貸出履歴の保管時暗号化はストレージ機能または adapter 層で適用し、domain / usecase 層は平文モデルのみを扱う。パスワードは Backend API では保持しない（IdP 管理）"
              reason: "暗号化の適用漏れを防ぎつつ、ドメインロジックを暗号化の実装詳細から独立させるため"
              source_model: "NFR E.6.1.1, NFR E.1.2.1"
              confidence: "medium"
      cross_layer_policies:
        - id: "CLP-001"
          name: "IF なし（直接依存）"
          description: "レイヤー間は直接依存とし、開発スピードを優先する。usecase は repository を、repository は gateway を直接利用する。外部サービス API の変更頻発・データストア製品の乗り換え・チーム分割のいずれかが発生した時点で凹型（IF 導入）へ移行する"
          reason: "利用するデータストア製品は当面乗り換えず、開発チームもレイヤー分割しない前提が成り立つため。新規構築で IF による疎結合化は過剰"
          source_model: "なし"
          confidence: "default"
        - id: "CLP-002"
          name: "エラーハンドリング伝播"
          description: "domain がドメイン例外の発生源、repository は技術例外をドメイン例外へラップして再スロー（ログなし）、usecase が集約ポイントで 1 回だけログ出力、presentation は HTTP ステータスへ変換のみ、gateway は外部通信エラーを依存関係ログに記録後に技術例外としてスローする。cause chain を context に保持する"
          reason: "多重ログを防止しつつ、発生源から集約ポイントまでの因果を 1 レコードで追跡できるようにするため"
          source_model: "アクター: 利用者（社外）, NFR C.6.1.2"
          confidence: "default"
        - id: "CLP-003"
          name: "レイヤー別ログカテゴリ"
          description: "presentation はアクセスログ（主責務）、usecase は監査ログ（主責務）と診断ログ、gateway は依存関係ログ（主責務）と診断ログを出力し、domain と repository は直接ログ出力を行わない"
          reason: "ログ種別 4 種（アクセス／操作／エラー／監査）の要件をレイヤー責務に写像し、出力ポイントをレイヤー境界に集約するため"
          source_model: "NFR C.6.1.2, NFR C.1.3.1, NFR E.7.1.1"
          confidence: "medium"
        - id: "CLP-004"
          name: "ログ運用方針"
          description: "非同期ログ出力を原則とする。DEBUG/TRACE は本番環境で無効をデフォルトとする。ログローテーションはサイズ（100MB）＋時間（日次）の併用とし、しきい値は設定ファイルで調整可能とする。保持期間は 6 ヶ月（監査ログは最長）。出力先は stdout/stderr に統一する。動的ログレベル変更は障害検知が Lv2（監視ツール検知）のため必須としない"
          reason: "ログ保管期間 6 ヶ月・ログ種別 4 種の要件と、レスポンスタイム 5 秒以内への影響回避を両立させるため"
          source_model: "NFR C.6.1.1, NFR C.6.1.2, NFR E.7.1.1, NFR B.2.1.1, NFR B.1.1.3, NFR C.3.1.1"
          confidence: "medium"
        - id: "CLP-005"
          name: "ログアンチパターン防止"
          description: "多重ログ禁止、catch 握り潰し禁止、機密情報（パスワード・トークン・氏名・メールアドレス）のマスキング必須、ループ内逐次ログ禁止（サマリログに集約）、構造化ログ強制、タイムスタンプは UTC 統一とする"
          reason: "運用時のログ量とノイズを抑え、個人情報のログ経由漏洩を防ぐため"
          source_model: "NFR E.1.2.1, NFR E.6.1.1"
          confidence: "default"
        - id: "CLP-006"
          name: "BC モジュール境界とレイヤーの直交"
          description: "モジュラモノリスとして BC-001 蔵書 / BC-002 利用者 / BC-003 貸出 / BC-004 予約 / BC-005 通知 / BC-006 分析の 6 モジュールに分割し、各モジュール内に presentation〜gateway の 5 層を持つ。モジュール間の呼び出しは各モジュールが公開する契約（コンテキストマップ CM-001〜CM-010 の OHS+PL / Customer-Supplier）経由に限定し、他モジュールの domain / repository / gateway を直接参照しない"
          reason: "NFR F.2.2.1 Lv2 がコンテキスト分割されたモジュラ構成を求めており、BC 境界をコード構造で維持する必要があるため"
          source_model: "BC: BC-001〜BC-006, CM-001〜CM-010, NFR F.2.2.1"
          confidence: "medium"
      cross_layer_rules:
        - id: "CLR-001"
          name: "依存方向の静的検査"
          description: "presentation → usecase → (domain, repository) → gateway の依存方向と、モジュール間の直接参照禁止を静的解析ルールとして CI に組み込み、違反をビルド失敗とする"
          reason: "モジュラモノリスの境界維持がコードレビュー頼みになる弱点を、機械的な検査で補うため"
          source_model: "BC: BC-001〜BC-006, NFR F.2.2.1"
          confidence: "medium"
        - id: "CLR-002"
          name: "モジュール間の直接データアクセス禁止"
          description: "他モジュールが所有するテーブルへ adapter から直接アクセスしない。参照が必要な場合は所有モジュールの公開契約を呼び出す。分析モジュール（BC-006）の集計だけは読み取り専用ビューの参照を例外として許可する"
          reason: "データベース共有によるモジュール境界の侵食を防ぎつつ、読み取り専用の集計では結合コストを許容するため"
          source_model: "CM-009, CM-010, BC-006"
          confidence: "medium"
        - id: "CLR-003"
          name: "認証コンテキストの明示的伝播"
          description: "user_id・役割・利用者番号を含む認証コンテキストは presentation から usecase、usecase から domain へ引数として明示的に渡す。スレッドローカル等の暗黙のグローバル状態で受け渡さない"
          reason: "所有者ベースの認可判定を domain 層で行う方針の前提であり、非同期処理（Worker）でも同じモデルを再利用できるようにするため"
          source_model: "条件: 個人情報参照可否条件, NFR E.5.2.1"
          confidence: "high"
        - id: "CLR-004"
          name: "構造化ログの必須フィールド"
          description: "全レイヤーのログに timestamp（ISO 8601 / UTC）・level・trace_id・span_id・service・message（静的テキスト）・context を含める。動的値は message ではなく context に分離する。span はティア単位で発行し、レイヤー内では切らない"
          reason: "分散トレーシング（CTP-004）と業務単位の横断検索を成立させるため"
          source_model: "NFR C.1.3.1, NFR C.6.1.2"
          confidence: "medium"
      diagram_mermaid: |
        graph TD
          P["presentation<br/>HTTP変換 / 入力検証 / アクセスログ"]
          U["usecase<br/>フロー制御 / TX境界 / 監査ログ / Command・Query分離"]
          D["domain<br/>状態遷移 / 不変条件 / 所有者判定（ログ出力なし）"]
          R["repository<br/>集約ルート1:1 / 楽観ロック / 例外ラップ"]
          G["gateway<br/>adapter+client / 依存関係ログ / 劣化兆候ログ"]
          P --> U
          U --> D
          U --> R
          R --> D
          R --> G
    - tier_id: "tier-worker"
      layers:
        - id: "L-worker-presentation"
          name: "プレゼンテーション層"
          responsibility: "Driver Side の入出力。CronJob ハンドラ（日次判定・レポート集計）と MQ コンシューマハンドラ（通知送信）の入口。実行パラメータの解釈、メッセージのデシリアライズ、ジョブ/メッセージ処理エラーへの変換"
          allowed_dependencies:
            - "L-worker-usecase"
          policies:
            - id: "LP-017"
              name: "ジョブ・メッセージのライフサイクルログ"
              description: "CronJob はジョブ起動・実行パラメータ・終了（COMPLETED / FAILED）を診断ログとして INFO 出力する。MQ コンシューマはストリーム処理の起動・停止を INFO 出力し、処理不能メッセージ（ポイズンピル）は例外情報とともに ERROR 出力する"
              reason: "日次バッチの実行有無と結果を運用で確認でき、8 時間以内の処理時間目標に対する実績を追跡できるようにするため"
              source_model: "BUC: 返却期限接近の貸出を判定する, 期限超過の貸出を延滞にする, NFR B.2.2.1, NFR C.1.3.1"
              confidence: "medium"
            - id: "LP-018"
              name: "キュー劣化ログ"
              description: "キュー深度がしきい値を超えた場合と、メッセージの滞留時間が伸びた場合に WARN レベルの構造化ログを出力する。degradation_type / current_value / threshold を context に含め、しきい値は設定ファイルから読み込む"
              reason: "バッチ 10 万件の走査結果を一括で送信要求へ変換するため、キューの滞留がバッチ処理時間 8 時間以内の目標を脅かす主要因となるため"
              source_model: "BUC: 督促メールを送信する, リマインドメールを送信する, 取置き通知メールを送信する, NFR B.1.1.4, NFR B.2.2.1"
              confidence: "medium"
          rules:
            - id: "LR-017"
              name: "アーキタイプ別の入口分離"
              description: "CronJob アーキタイプ（返却期限接近判定・期限超過判定・在庫状況集計・期間別貸出統計集計）と MQ コンシューマアーキタイプ（取置き通知・リマインド・督促のメール送信）でハンドラを分離し、それぞれ独立に起動・スケールできるようにする"
              reason: "定期実行と非同期メッセージ消費でスケーリング特性と失敗時の扱い（再実行 vs 再配送）が異なるため"
              source_model: "BUC: タイマー起動 2 件, 通知送信 3 件, NFR B.3.1.1"
              confidence: "high"
            - id: "LR-018"
              name: "ジョブ・メッセージ ID による冪等化"
              description: "CronJob は実行日をキーとしたジョブ ID、MQ コンシューマは通知 ID をメッセージ ID として冪等性を担保する。再実行・再配送時は既処理を検知して副作用（重複した通知レコード生成・重複メール送信）を発生させない"
              reason: "MQ が at-least-once 配信であり、通知の重複送信抑止が業務要件として明示されているため（CTP-006 の Worker 分担）"
              source_model: "状態: 通知状態（重複送信防止）, 情報: 通知"
              confidence: "high"
            - id: "LR-019"
              name: "ポイズンピルの DLQ 退避"
              description: "リトライ上限を超えたメッセージは DLQ へ退避し、退避時に ERROR ログと監視アラートを出力する。DLQ からの再処理は手順書に基づく手動操作とする"
              reason: "障害復旧方式が手順書に基づく手動復旧であり、自動再処理より運用者による原因確認を優先するため"
              source_model: "状態: 通知状態（送信失敗）, NFR C.3.3.1, NFR C.3.1.1, NFR C.5.1.1"
              confidence: "medium"
        - id: "L-worker-usecase"
          name: "ユースケース層"
          responsibility: "非同期処理のビジネスフロー制御、チャンク単位のトランザクション境界、監査ログの出力、例外の集約キャッチ"
          allowed_dependencies:
            - "L-worker-domain"
            - "L-worker-repository"
          policies:
            - id: "LP-019"
              name: "監査ログ"
              description: "延滞遷移・通知の送信待ち生成・送信済み/送信失敗への遷移・レポートの作成済み/実績なし確定を、対象エンティティ ID（貸出ID / 通知ID / 予約ID / レポートID）とともに監査ログとして INFO 記録する。操作主体はシステム（ジョブ名）とする"
              reason: "利用者への通知到達を事後に追跡でき、督促の実施記録を監査ログとして残す必要があるため"
              source_model: "状態: 貸出状態（延滞）, 通知状態, 統計レポート状態, NFR E.7.1.1, NFR C.6.1.2"
              confidence: "high"
            - id: "LP-020"
              name: "チャンク処理と進捗サマリ"
              description: "貸出全件走査（1 回あたり最大 10 万件）はチャンク単位で読み込み・判定・コミットし、チャンクごとの処理件数と総実行時間を診断ログのサマリとして出力する。1 件ごとの逐次ログは出力しない"
              reason: "バッチ処理量 10 万件を 8 時間以内で処理する目標に対し、メモリ枯渇と長時間トランザクションを避けつつログ量を抑えるため"
              source_model: "NFR B.1.1.4, NFR B.2.2.1, NFR B.2.2.2"
              confidence: "medium"
          rules:
            - id: "LR-020"
              name: "例外の集約キャッチ"
              description: "domain 例外と repository がラップしたドメイン例外を usecase 層で集約キャッチし、1 回だけエラーログを出力してから presentation へ再スローする"
              reason: "Backend API と同一のエラーハンドリング伝播方針を適用し、多重ログを防止するため"
              source_model: "NFR C.6.1.2"
              confidence: "high"
            - id: "LR-021"
              name: "部分失敗の継続処理"
              description: "アイテム単位の処理失敗はスキップして後続アイテムの処理を継続し、失敗件数と対象 ID をサマリで記録する。チャンク全体を失敗させるのは datastore 接続不能などの継続不能な障害に限る"
              reason: "1 件の不正データで日次のリマインド・督促全体が停止すると利用者への通知が欠落するため"
              source_model: "BUC: 返却期限接近の貸出を判定する, 期限超過の貸出を延滞にする, NFR B.2.2.1"
              confidence: "medium"
        - id: "L-worker-domain"
          name: "ドメイン層"
          responsibility: "ビジネスルール、状態遷移、不変条件の強制。Backend API の domain 層と同一コードを共有する。ログ出力は行わない"
          allowed_dependencies: []
          policies:
            - id: "LP-021"
              name: "ログ出力禁止"
              description: "domain 層は直接ログ出力を行わない。状態変化はドメインイベントの発行、ルール違反はドメイン例外のスローで通知する"
              reason: "Backend API と domain 層を共有するため、ロギング方針も同一にする必要があるため"
              source_model: "なし"
              confidence: "high"
            - id: "LP-022"
              name: "タイマー契機の状態遷移"
              description: "返却期限超過による貸出状態の延滞への遷移、通知状態の送信待ち／送信済み／送信失敗／再送の遷移、統計レポート状態の集計中／作成済み／実績なしの確定を、Backend API と同一のドメインモデルで実行する"
              reason: "状態.tsv にタイマー契機の状態遷移（期限超過の貸出を延滞にする）と通知・レポートの状態遷移が定義されており、遷移ロジックの二重実装を避ける必要があるため"
              source_model: "状態: 貸出状態（貸出中→延滞）, 通知状態, 統計レポート状態, 条件: 督促通知対象条件, リマインド通知対象条件, 取置き通知対象条件"
              confidence: "high"
          rules:
            - id: "LR-022"
              name: "Backend API との domain 共有"
              description: "domain 層のエンティティ・値オブジェクト・ドメインサービスは Backend API と同一モジュール（同一 BC）のコードを共有し、Worker 専用のドメインロジックを重複定義しない"
              reason: "モジュラモノリスとして単一コードベースで運用するため、状態遷移ルールの実装が分岐すると整合が崩れるため"
              source_model: "BC: BC-003 貸出, BC-004 予約, BC-005 通知, BC-006 分析, NFR F.2.2.1"
              confidence: "high"
        - id: "L-worker-repository"
          name: "リポジトリ層"
          responsibility: "domain のデータアクセス方法。Backend API と同一の repository を共有し、大量走査向けの読み取り専用 finder を追加する"
          allowed_dependencies:
            - "L-worker-domain"
            - "L-worker-gateway"
          policies: []
          rules:
            - id: "LR-023"
              name: "Backend API との repository 共有"
              description: "集約ルート単位の repository は Backend API と共有する。永続化パターン（save / findById / deleteById）も同一とする"
              reason: "同一データモデルに対する二重のデータアクセス実装を避けるため"
              source_model: "集約仮説: AG-003, AG-004, AG-005, AG-006"
              confidence: "high"
            - id: "LR-024"
              name: "大量走査用 finder の分離"
              description: "リマインド・督促の対象抽出（貸出全件走査）と統計集計はストリーミング/ページング可能な読み取り専用 finder として定義し、集約ルート単位の取得メソッドと分離する"
              reason: "10 万件の走査を集約ルートの全件ロードで行うとメモリとレスポンスの両方が破綻するため"
              source_model: "条件: リマインド通知対象条件, 督促通知対象条件, 貸出統計集計条件, NFR B.1.1.4, NFR B.2.2.2"
              confidence: "medium"
        - id: "L-worker-gateway"
          name: "ゲートウェイ層"
          responsibility: "Driven Side の入出力。RDB / KVS / MQ の adapter と client。外部連携（メール配信）は external-gateway ティアへ委譲する"
          allowed_dependencies: []
          policies:
            - id: "LP-023"
              name: "依存関係ログ"
              description: "datastore と MQ への呼び出し、および external-gateway への送信依頼の処理時間と成否を依存関係ログとして INFO 出力する。メッセージ処理メトリクスは件数集約して出力する"
              reason: "通知の未達追跡には外部連携の呼び出し結果をログで追える必要があるため"
              source_model: "外部システム: メール配信サービス, 状態: 通知状態（送信失敗）, NFR C.1.3.1"
              confidence: "medium"
            - id: "LP-024"
              name: "劣化兆候ログ"
              description: "リトライ発生・サーキットブレーカーの状態遷移・コネクションプール逼迫を WARN レベルで構造化出力する。しきい値は設定ファイルから読み込む"
              reason: "外部メール配信サービスの劣化を通知の大量失敗より前に検知するため"
              source_model: "外部システム: メール配信サービス, NFR A.2.1.1, NFR A.1.2.1"
              confidence: "medium"
          rules:
            - id: "LR-025"
              name: "外部連携の委譲"
              description: "メール配信サービスへの送信は Worker の gateway から直接行わず、external-gateway ティアの ACL 経由で依頼する。Worker は送信依頼の成否のみを扱い、外部 API のモデルを知らない"
              reason: "外部モデルの隔離（ACL / CM-011）を 1 箇所に集約し、外部サービス変更の影響範囲を限定するため"
              source_model: "CM-011, 外部システム: メール配信サービス"
              confidence: "high"
      cross_layer_policies:
        - id: "CLP-007"
          name: "IF なし（直接依存）"
          description: "レイヤー間は直接依存とする。ただし external-gateway への送信依頼だけはテスト時の mock 差し替えのため IF を導入する（部分的な凹型）"
          reason: "日次バッチの自動テストで実際のメール送信を行わないようにする必要があり、外部連携のみ IF 導入の便益がコストを上回るため"
          source_model: "外部システム: メール配信サービス"
          confidence: "medium"
        - id: "CLP-008"
          name: "エラーハンドリング伝播"
          description: "domain が例外の発生源、repository はラップして再スロー（ログなし）、usecase が集約ポイントで 1 回だけログ出力、presentation はジョブエラーログ／メッセージ処理エラーへ変換する。gateway は依存関係ログに記録後に技術例外としてスローする"
          reason: "Backend API と同一の伝播方針を適用し、ティアをまたいでもエラー追跡の形式を揃えるため"
          source_model: "NFR C.6.1.2"
          confidence: "default"
        - id: "CLP-009"
          name: "アーキタイプ別ロギング"
          description: "CronJob は presentation でジョブ起動/終了、usecase で処理件数サマリと監査ログ、gateway で依存関係ログとアイテム単位のエラーを出力する。MQ コンシューマは presentation で起動/停止とポイズンピル、usecase で監査ログ、gateway で集約メトリクスと劣化兆候を出力する"
          reason: "バッチとメッセージコンシューマで診断に必要な情報が異なり、同一のログ設計では運用時の切り分けができないため"
          source_model: "BUC: タイマー起動 2 件, 通知送信 3 件, NFR C.1.3.1, NFR C.6.1.2"
          confidence: "medium"
        - id: "CLP-010"
          name: "ログアンチパターン防止"
          description: "ループ内での逐次ログを禁止し N 件中 M 件失敗のサマリログに集約する。多重ログ禁止、catch 握り潰し禁止、宛先メールアドレスのマスキング必須、構造化ログ強制、UTC 統一を適用する"
          reason: "10 万件走査で 1 件 1 行のログを出力するとログ保管 6 ヶ月の容量と検索性が破綻し、宛先メールアドレスの平文出力は個人情報漏洩に直結するため"
          source_model: "NFR B.1.1.4, NFR C.6.1.1, NFR E.1.2.1"
          confidence: "default"
      cross_layer_rules:
        - id: "CLR-005"
          name: "trace_id の非同期伝播"
          description: "Backend API が発行した trace_id を MQ メタデータへ格納し、Worker の presentation 層で取り出して新しい span を開始する。CronJob 起点の処理は presentation 層で新規 trace_id を発行する"
          reason: "予約取消から取置き通知までの因果を、同期処理と非同期処理をまたいで 1 本のトレースで追跡するため"
          source_model: "CM-006, CM-007, NFR C.1.3.1"
          confidence: "medium"
        - id: "CLR-006"
          name: "実行枠の遵守"
          description: "日次バッチはバックアップと計画保守の枠（深夜 1 時〜4 時）を避けて起動し、運用時間（9 時〜翌 8 時）内に完了させる。長時間化した場合は次回起動をスキップし多重起動しない"
          reason: "運用時間 9 時〜翌 8 時とバックアップ時間帯 1 時〜4 時が定義されており、バッチとバックアップの競合が復旧性能を落とすため"
          source_model: "NFR A.1.1.1, NFR C.1.1.1, NFR C.1.1.2, NFR C.2.1.1, NFR B.2.2.1"
          confidence: "medium"
        - id: "CLR-007"
          name: "システム実行主体の認証コンテキスト"
          description: "Worker はログイン利用者を持たないため、認証コンテキストにはジョブ名/コンシューマ名をシステム主体として設定して domain へ渡す。所有者ベースの認可判定はシステム主体では常に許可とし、対象データの絞り込みは条件（リマインド/督促/取置き通知対象条件）で行う"
          reason: "domain 層の所有者判定を Backend API と共有する構造上、Worker でも認証コンテキストの受け渡し形式を揃える必要があるため"
          source_model: "条件: 個人情報参照可否条件, リマインド通知対象条件, 督促通知対象条件, 取置き通知対象条件"
          confidence: "medium"
      diagram_mermaid: |
        graph TD
          PC["presentation (CronJob)<br/>日次判定 / レポート集計の起動"]
          PM["presentation (MQ consumer)<br/>通知送信メッセージの消費 / DLQ"]
          U["usecase<br/>チャンク処理 / 監査ログ / 集約キャッチ"]
          D["domain<br/>延滞・通知・レポートの状態遷移（Backend API と共有）"]
          R["repository<br/>集約ルート1:1 + 大量走査 finder"]
          G["gateway<br/>RDB / KVS / MQ adapter・client"]
          EXT["external-gateway ティアへ送信依頼"]
          PC --> U
          PM --> U
          U --> D
          U --> R
          R --> D
          R --> G
          G --> EXT
    - tier_id: "tier-frontend-patron"
      layers:
        - id: "L-frontend-patron-view"
          name: "ビュー/コンポーネント層"
          responsibility: "UI 描画、ユーザー操作のハンドリング、画面ローカルの状態保持、入力の形式チェック、エラーのユーザー向けメッセージ変換"
          allowed_dependencies:
            - "L-frontend-patron-api-client"
          policies:
            - id: "LP-025"
              name: "本人限定参照の UI 制約"
              description: "貸出内容・返却期限・貸出履歴・予約状況・取置き状況・利用者情報の画面はログイン中の利用者本人のデータのみを表示し、他利用者のデータへ到達する導線（利用者番号の直接指定等）を持たない。表示制御はあくまで補助であり、実際の制約は Backend API の domain 層が強制する"
              reason: "条件「個人情報参照可否条件」が自分の〜を照会する系 UC に適用され、貸出履歴は思想信条を推知しうる機微情報であるため"
              source_model: "条件: 個人情報参照可否条件, BUC: 利用照会業務, NFR E.1.2.1"
              confidence: "high"
            - id: "LP-026"
              name: "アクセシビリティ準拠"
              description: "JIS X 8341-3:2016 レベル AA を目標とし、意味的な HTML 構造・キーボード操作・コントラスト比・代替テキストをコンポーネントの設計要件に含める"
              reason: "公共図書館の利用者向け画面としてアクセシビリティ目標が NFR で明示されているため"
              source_model: "NFR F.3.1.2, アクター: 利用者"
              confidence: "high"
          rules:
            - id: "LR-026"
              name: "状態の画面ローカル保持"
              description: "画面をまたいで共有する状態は認証情報と検索条件に限り、それ以外はコンポーネントローカルに保持する。共有が必要な状態はルーティングのクエリパラメータまたは api client の再取得で表現する"
              reason: "利用者ポータルの UC は 15 件で画面間の状態依存が弱く、独立した状態管理層を設けるコストが便益を上回らないため"
              source_model: "BUC: 利用者向け 15 UC"
              confidence: "medium"
            - id: "LR-027"
              name: "エラーメッセージの変換"
              description: "api client から伝播したエラーを利用者向けの平易なメッセージへ変換して表示する。技術的な例外内容・スタックトレース・内部 ID を画面に出さない"
              reason: "社外の一般利用者が対象であり、内部情報の露出は攻撃の手がかりとなるため"
              source_model: "アクター: 利用者（社外）, NFR E.10.2.1"
              confidence: "default"
        - id: "L-frontend-patron-api-client"
          name: "API クライアント層"
          responsibility: "Backend API との通信、認証トークンの保持と更新、冪等キーの付与、trace_id の発行、タイムアウトとリトライ、エラーの集約"
          allowed_dependencies: []
          policies:
            - id: "LP-027"
              name: "認証トークン管理"
              description: "IdP から取得したトークンを api client 層でのみ保持し、リクエストへの付与・期限切れ時の再取得・失効時のログイン画面への誘導を担う。ビュー層はトークンの実体を扱わない"
              reason: "トークンの取り扱いを 1 レイヤーへ閉じ、画面実装からの漏洩経路を減らすため"
              source_model: "NFR E.5.1.1, NFR E.5.2.1"
              confidence: "high"
            - id: "LP-028"
              name: "trace_id の発行"
              description: "1 画面操作につき trace_id を発行し、W3C Trace Context 準拠のヘッダーで Backend API へ伝播する"
              reason: "利用者からの問い合わせを起点に、フロントエンドから datastore までの処理を 1 本のトレースで追跡するため"
              source_model: "NFR C.1.3.1, NFR C.1.3.2"
              confidence: "medium"
          rules:
            - id: "LR-028"
              name: "冪等キーの付与"
              description: "予約登録・予約取消などの更新系リクエストに冪等キーを付与し、再送時も同一キーを使用する（CTP-006 の 4 層防御のフロントエンド分担）"
              reason: "通信不安定時の再送や利用者の二重クリックによる重複予約を防ぐため"
              source_model: "条件: 重複予約禁止条件, BUC: 予約を登録する, 予約を取り消す"
              confidence: "medium"
            - id: "LR-029"
              name: "タイムアウトとリトライ"
              description: "リクエストのタイムアウトを Backend API の処理タイムアウトより長く設定し、参照系のみ指数バックオフで最大 2 回リトライする。更新系は冪等キーがある場合に限りリトライする"
              reason: "タイムアウト階層（CTR-005）を守りつつ、レスポンスタイム 5 秒以内の目標下で無用な多重更新を防ぐため"
              source_model: "NFR B.2.1.1, NFR A.1.2.1"
              confidence: "medium"
      cross_layer_policies:
        - id: "CLP-011"
          name: "IF なし（直接依存）"
          description: "ビュー層は api client を直接利用する。API のモック化はテスト時の通信層スタブで行い、IF は導入しない"
          reason: "2 層構成で介在レイヤーがなく、IF 導入の便益が小さいため"
          source_model: "なし"
          confidence: "default"
        - id: "CLP-012"
          name: "エラーハンドリング伝播"
          description: "api client 層を集約ポイントとし、通信エラー・認可エラー・業務エラーを分類してビュー層へ伝播する。ビュー層はユーザーフレンドリーなメッセージへの変換のみを行う"
          reason: "状態管理層を持たない 2 層構成では api client がエラー分類の唯一の集約点になるため"
          source_model: "アクター: 利用者（社外）"
          confidence: "default"
      cross_layer_rules:
        - id: "CLR-008"
          name: "ブラウザストレージへの PII 非保存"
          description: "氏名・連絡先・貸出履歴などの個人情報をローカルストレージ等の永続ストレージへ保存しない。認証トークンは XSS 耐性を考慮した保管方式とし、ログアウト時に確実に破棄する"
          reason: "共用端末からの利用が想定され、端末側に残る個人情報が漏洩経路となるため"
          source_model: "NFR E.1.2.1, NFR E.6.1.1, NFR E.5.1.1"
          confidence: "high"
      diagram_mermaid: |
        graph TD
          V["view / component<br/>UI描画 / 画面ローカル状態 / 本人限定参照のUI制約"]
          A["api client<br/>トークン管理 / 冪等キー / trace_id / タイムアウト"]
          V --> A
    - tier_id: "tier-frontend-staff"
      layers:
        - id: "L-frontend-staff-view"
          name: "ビュー層"
          responsibility: "UI 描画、司書操作のハンドリング、ロール別の画面表示、破壊的操作の確認、エラーのユーザー向けメッセージ変換"
          allowed_dependencies:
            - "L-frontend-staff-state"
          policies:
            - id: "LP-029"
              name: "ロール別の画面表示"
              description: "司書ロールのトークンを持つ場合のみ管理機能の画面を表示する。表示制御は利便性のための一次フィルタであり、実際のアクセス制御は API Gateway の粗粒度 RBAC と Backend API の認可判定で担保する"
              reason: "ロールベースアクセス制御が要求され、司書向け管理機能は館内ネットワークからのみ利用可という制約があるため"
              source_model: "情報: 利用者アカウント（役割）, NFR E.5.2.1, NFR E.5.3.1"
              confidence: "high"
          rules:
            - id: "LR-030"
              name: "破壊的操作の確認"
              description: "書籍削除・利用者削除・予約取消の実行前に対象と影響（進行中の貸出/予約の有無）を提示して確認を取る。削除可否の判定結果は Backend API の応答を表示し、フロント側で独自判定しない"
              reason: "蔵書削除可否条件・利用者削除可否条件が他エンティティの状態に依存し、フロント側の独自判定は判定漏れを生むため"
              source_model: "条件: 蔵書削除可否条件, 利用者削除可否条件, BUC: 蔵書管理業務（書籍を削除する）, 利用者を削除する, 予約を取り消す"
              confidence: "medium"
        - id: "L-frontend-staff-state"
          name: "状態管理層"
          responsibility: "アプリケーション状態の管理、画面間の状態共有、サーバ状態のキャッシュと再取得、エラーの集約"
          allowed_dependencies:
            - "L-frontend-staff-api-client"
          policies:
            - id: "LP-030"
              name: "業務状態の画面横断共有"
              description: "窓口業務のフロー（利用者特定 → 貸出可否判定 → 貸出登録、返却対象照会 → 返却登録 → 返却後状態更新）で画面をまたいで引き継ぐ対象（利用者番号・書籍ID・貸出ID）を状態管理層で保持し、更新後は関連する一覧のキャッシュを無効化する"
              reason: "司書ポータルは 22 UC あり、窓口フローが複数画面にまたがるため画面ローカル状態では引き継ぎが破綻するため"
              source_model: "BUC: 書籍を貸し出すフロー, 書籍を返却するフロー, 司書向け 22 UC"
              confidence: "medium"
          rules:
            - id: "LR-031"
              name: "エラーの集約と分類"
              description: "api client から伝播したエラーを状態管理層で分類（通信／認可／業務ルール違反／競合）し、集約ポイントとして 1 回だけ扱ってからビュー層へ渡す"
              reason: "エラーハンドリング伝播方針のフロントエンド適用（集約ポイント＝状態管理層）に従うため"
              source_model: "なし"
              confidence: "default"
        - id: "L-frontend-staff-api-client"
          name: "API クライアント層"
          responsibility: "Backend API との通信、認証トークンの保持と更新、冪等キーの付与、trace_id の発行、タイムアウトとリトライ"
          allowed_dependencies: []
          policies:
            - id: "LP-031"
              name: "認証トークン管理"
              description: "IdP から取得した司書トークンを api client 層でのみ保持し、リクエストへの付与・期限切れ時の再取得・失効時の再ログイン誘導を担う。ビュー層・状態管理層はトークンの実体を扱わない"
              reason: "司書アカウントは蔵書・利用者の全操作権限を持つため、トークンの取り扱い範囲を最小化する必要があるため"
              source_model: "情報: 利用者アカウント（役割）, NFR E.5.1.1, NFR E.5.2.1"
              confidence: "high"
          rules:
            - id: "LR-032"
              name: "冪等キーの付与"
              description: "貸出登録・返却登録・書籍/利用者の登録・削除・予約取消などの更新系リクエストに冪等キーを付与し、再送時も同一キーを使用する"
              reason: "窓口業務では通信エラー時の再操作が発生しやすく、二重登録が在庫整合を直接破壊するため"
              source_model: "BUC: 貸出を登録する, 返却を登録する, 書籍を登録する, 利用者を登録する"
              confidence: "medium"
            - id: "LR-033"
              name: "館内ネットワークでも TLS を適用"
              description: "館内ネットワーク限定の経路であっても API Gateway との通信は TLS1.2 以上で暗号化する"
              reason: "内部通信を含む全通信暗号化が要求されているため"
              source_model: "NFR E.6.1.2, NFR E.5.3.1"
              confidence: "high"
      cross_layer_policies:
        - id: "CLP-013"
          name: "IF なし（直接依存）"
          description: "ビュー層は状態管理層を、状態管理層は api client を直接利用する。IF は導入しない"
          reason: "単一チームでの開発を前提とし、レイヤー間の差し替え要求が現時点で存在しないため"
          source_model: "なし"
          confidence: "default"
        - id: "CLP-014"
          name: "エラーハンドリング伝播"
          description: "状態管理層を集約ポイントとし、ビュー層はユーザーフレンドリーなメッセージへの変換のみを行う。api client は通信エラーを分類して状態管理層へ伝播する"
          reason: "ロギングパターンのフロントエンド適用（集約ポイント＝状態管理層、変換＝ビュー層）に従うため"
          source_model: "なし"
          confidence: "default"
        - id: "CLP-015"
          name: "利用者ポータルとの共通コンポーネント共有"
          description: "書籍検索フォーム・検索結果一覧・書籍詳細・在庫状況表示など両ポータルで重複する UI を共通コンポーネントとして切り出し、ポータル固有の業務ロジック（本人限定参照の導線制約・司書の管理操作）はコンポーネントに埋め込まず利用側で与える"
          reason: "検索系画面が利用者ポータルと司書ポータルで重複し、2 ポータル分離の代償である実装重複を抑える必要があるため"
          source_model: "BUC: 書籍を検索する, 司書向けに蔵書を検索する, 書籍詳細と在庫状況を照会する"
          confidence: "medium"
      cross_layer_rules:
        - id: "CLR-009"
          name: "操作ログの生成責務"
          description: "司書の登録・編集・削除操作の監査ログは Backend API の usecase 層で生成する。フロントエンドはログを送信せず、trace_id の付与のみを行う"
          reason: "監査ログをクライアント側で生成すると改ざん可能となり、監査証跡として成立しないため"
          source_model: "NFR E.7.1.1, NFR C.6.1.2"
          confidence: "high"
      diagram_mermaid: |
        graph TD
          V["view<br/>UI描画 / ロール別表示 / 破壊的操作の確認"]
          S["state management<br/>画面横断の業務状態 / キャッシュ無効化 / エラー集約"]
          A["api client<br/>トークン管理 / 冪等キー / trace_id / TLS"]
          V --> S
          S --> A
    - tier_id: "tier-external-gateway"
      layers:
        - id: "L-external-gateway-translator"
          name: "ACL 翻訳層"
          responsibility: "Driver Side の入口。通知ドメインの送信依頼を外部メール配信サービスの API モデルへ変換し、配信結果を通知状態（送信済み／送信失敗）へ翻訳する"
          allowed_dependencies:
            - "L-external-gateway-client"
          policies:
            - id: "LP-032"
              name: "ACL による外部モデルの隔離"
              description: "メール配信サービスの API モデル（送信依頼形式・配信結果コード・エラー体系）をこの層に閉じ込め、内側へは通知ドメインの語彙（通知種別・通知状態・宛先利用者番号）だけを渡す"
              reason: "コンテキストマップ CM-011 が外部モデルを通知状態へ翻訳する ACL を規定しており、外部サービス変更の影響範囲をこの層に限定する必要があるため"
              source_model: "CM-011, BC-007, 外部システム: メール配信サービス, 状態: 通知状態"
              confidence: "high"
          rules:
            - id: "LR-034"
              name: "外部モデルの非漏出"
              description: "外部サービスの型・エラーコード・SDK の例外クラスを内側のティア（Worker / Backend API）へ返さない。すべて通知ドメインの結果型とドメイン例外へ変換する"
              reason: "外部モデルが内側へ漏れると ACL が形骸化し、サービス変更時の改修が全ティアへ波及するため"
              source_model: "CM-011, BC-007"
              confidence: "high"
            - id: "LR-035"
              name: "配信結果の通知状態への翻訳"
              description: "送信成功は送信済み、恒久的失敗（宛先不正等）は送信失敗、一時的失敗（レート制限・タイムアウト）はリトライ後も解消しなければ送信失敗として返す。再送の判断は通知側の状態遷移に委ね、この層では自律的な再送キュー投入を行わない"
              reason: "通知状態が送信待ち／送信済み／送信失敗と再送遷移を持ち、再送の業務判断は通知コンテキストの責務であるため"
              source_model: "状態: 通知状態（送信待ち／送信済み／送信失敗）, CM-011"
              confidence: "high"
        - id: "L-external-gateway-client"
          name: "クライアント層"
          responsibility: "Driven Side の入出力。メール配信サービスの SDK / API 呼び出し、Timeout・Retry・Circuit Breaker の適用、依存関係ログと劣化兆候ログの出力"
          allowed_dependencies: []
          policies:
            - id: "LP-033"
              name: "依存関係ログ"
              description: "メール配信サービス呼び出しの開始・終了、処理時間、成否、リトライ回数を依存関係ログとして INFO 出力する。リクエスト/レスポンス本文は DEBUG とし、宛先メールアドレスはマスキングする"
              reason: "アプリケーション監視で通知の未達を検知し、外部サービス起因かを切り分ける必要があるため"
              source_model: "外部システム: メール配信サービス, 状態: 通知状態（送信失敗）, NFR C.1.3.1, NFR C.6.1.2"
              confidence: "medium"
            - id: "LP-034"
              name: "劣化兆候ログ"
              description: "リトライ発生、サーキットブレーカーの状態遷移（Closed→Open, Open→Half-Open）、DNS/TLS ハンドシェイク遅延を WARN レベルで構造化出力する。degradation_type / current_value / threshold / action_taken を context に含め、しきい値は設定ファイルから読み込む"
              reason: "外部連携の劣化を通知の大量失敗より前に検知し、手動切替・手動復旧の判断材料とするため"
              source_model: "外部システム: メール配信サービス, NFR A.2.1.1, NFR A.1.2.1, NFR C.3.1.1"
              confidence: "medium"
          rules:
            - id: "LR-036"
              name: "回復性スタックの適用"
              description: "Timeout → Retry（指数バックオフ、上限あり）→ Circuit Breaker の順で外部呼び出しを保護する。Circuit が Open の間は即座に一時的失敗を返し、通知は送信待ちのまま次回処理へ回す"
              reason: "メール配信サービスの障害が Worker のバッチ全体を停滞させ、バッチ処理時間 8 時間以内の目標を破らないようにするため"
              source_model: "外部システム: メール配信サービス, NFR A.1.2.1, NFR B.2.2.1"
              confidence: "high"
            - id: "LR-037"
              name: "送信の重複抑止キー"
              description: "送信依頼に通知 ID を重複抑止キーとして付与し、リトライ時も同一キーを使用する。外部サービスが冪等キーに対応しない場合は、送信済み判定を通知状態の更新で保証する"
              reason: "at-least-once の再送経路で同一利用者へ同一通知が複数届くことを防ぐ必要があるため"
              source_model: "状態: 通知状態（重複送信防止）, 情報: 通知（通知ID）"
              confidence: "high"
            - id: "LR-038"
              name: "宛先の非ログ出力"
              description: "宛先メールアドレスを平文でログ出力しない。追跡が必要な場合は通知 ID と宛先利用者番号を context に含め、メールアドレスはマスキングまたはハッシュ化する"
              reason: "メールアドレスは個人情報であり、ログ保管 6 ヶ月の間の漏洩リスクを避ける必要があるため"
              source_model: "情報: 通知（宛先メールアドレス）, NFR E.1.2.1, NFR E.6.1.1, NFR C.6.1.1"
              confidence: "high"
      cross_layer_policies:
        - id: "CLP-016"
          name: "凹型（IF 導入）"
          description: "翻訳層とクライアント層の間に IF を導入し、実装を差し替え可能にする。テストではスタブ実装を用い、実際のメール送信を行わない"
          reason: "外部サービスは唯一の外部依存であり、乗り換え・API 変更・テスト時のモック化のいずれの動機も成立するため（IF 導入の判定条件に該当）"
          source_model: "外部システム: メール配信サービス, CM-011, NFR C.4.1.1, NFR E.6.2.1"
          confidence: "medium"
        - id: "CLP-017"
          name: "エラーハンドリング伝播"
          description: "クライアント層は依存関係ログに記録してから技術例外をスローし、翻訳層がそれを通知ドメインの結果型／ドメイン例外へ変換して呼び出し元へ返す。エラーログの集約は呼び出し元（Worker の usecase 層）で行う"
          reason: "ティアをまたぐ多重ログを避け、集約ポイントを呼び出し側の usecase 層に一本化するため"
          source_model: "NFR C.6.1.2"
          confidence: "default"
      cross_layer_rules:
        - id: "CLR-010"
          name: "タイムアウト階層の遵守"
          description: "外部連携のタイムアウトを Backend API の処理タイムアウトより短く設定し、Gateway > Backend API > 外部連携 の階層（CTR-005）を守る"
          reason: "外部サービスの遅延が上位のタイムアウトを超過すると、どの層で失敗したかの切り分けができなくなるため"
          source_model: "外部システム: メール配信サービス, NFR B.2.1.1, NFR A.1.2.1"
          confidence: "medium"
      diagram_mermaid: |
        graph TD
          T["ACL translator<br/>送信依頼 ⇄ 外部APIモデルの変換 / 配信結果 → 通知状態"]
          C["client<br/>SDK呼び出し / Timeout・Retry・CircuitBreaker / 依存関係ログ"]
          T -->|IF 経由・凹型。テスト時はスタブへ差し替え| C
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
          description: "書籍ID。蔵書1冊を一意に識別する"
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
          description: "ISBN。移行時のクレンジング対象（NFR D.4.1.3）"
          nullable: true
          primary_key: false
        - name: "publisher"
          type: "string"
          description: "出版社"
          nullable: false
          primary_key: false
        - name: "genre"
          type: "string"
          description: "ジャンル（バリエーション: 文学/人文/社会科学/自然科学/技術/芸術/児童/その他）"
          nullable: false
          primary_key: false
        - name: "material_type"
          type: "string"
          description: "資料種別（バリエーション: 紙書籍/電子書籍。初期リリースは紙書籍のみ有効）"
          nullable: false
          primary_key: false
        - name: "book_status"
          type: "string"
          description: "書籍状態（在庫あり/貸出中/予約待ち）。スナップショットが保持するキャッシュ的ステータス"
          nullable: false
          primary_key: false
        - name: "registered_at"
          type: "datetime"
          description: "登録日時。登録イベントの occurred_at をスナップショットへ射影した値"
          nullable: false
          primary_key: false
        - name: "updated_at"
          type: "datetime"
          description: "最終更新日時。最新イベントの occurred_at を射影する"
          nullable: false
          primary_key: false
      relationships: []
    - id: "E-002"
      name: "利用者"
      source_info: "情報: 利用者"
      model_type: "event_snapshot"
      attributes:
        - name: "user_no"
          type: "string"
          description: "利用者番号。利用者を一意に識別する"
          nullable: false
          primary_key: true
        - name: "name"
          type: "string"
          description: "氏名。個人情報のため保管時暗号化の対象（NFR E.6.1.1）"
          nullable: false
          primary_key: false
        - name: "email"
          type: "string"
          description: "連絡先（メールアドレス）。通知メールの宛先。保管時暗号化の対象（NFR E.6.1.1）"
          nullable: false
          primary_key: false
        - name: "user_category"
          type: "string"
          description: "利用者区分（バリエーション: 一般/学生/団体）。貸出期間の適用単位"
          nullable: false
          primary_key: false
        - name: "user_status"
          type: "string"
          description: "利用者状態（登録済み/取引進行中）。スナップショットが保持するキャッシュ的ステータス"
          nullable: false
          primary_key: false
        - name: "registered_at"
          type: "datetime"
          description: "登録日時。登録イベントの occurred_at を射影した値"
          nullable: false
          primary_key: false
        - name: "updated_at"
          type: "datetime"
          description: "最終更新日時。最新イベントの occurred_at を射影する"
          nullable: false
          primary_key: false
      relationships: []
    - id: "E-003"
      name: "利用者アカウント"
      source_info: "情報: 利用者アカウント"
      model_type: "resource_mutable"
      attributes:
        - name: "account_id"
          type: "string"
          description: "アカウントID"
          nullable: false
          primary_key: true
        - name: "user_no"
          type: "string"
          description: "利用者番号。利用者（E-002）への参照"
          nullable: false
          primary_key: false
        - name: "login_id"
          type: "string"
          description: "ログインID。認証情報の正データは IdP ティアが保持し、本エンティティは業務側の対応関係のみ保持する"
          nullable: false
          primary_key: false
        - name: "role"
          type: "string"
          description: "役割（司書/利用者）。RBAC のロール（NFR E.5.2.1）"
          nullable: false
          primary_key: false
        - name: "is_active"
          type: "boolean"
          description: "有効フラグ。ログイン失敗連続検知によるアカウントロックで false になる（NFR E.7.2.1）"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-002"
          type: "N:1"
          description: "利用者アカウントは1人の利用者に紐づく（実質 1:1。司書アカウントも利用者番号で識別する）"
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
          description: "貸出対象の書籍ID"
          nullable: false
          primary_key: false
        - name: "user_no"
          type: "string"
          description: "貸出先の利用者番号"
          nullable: false
          primary_key: false
        - name: "loan_date"
          type: "date"
          description: "貸出日。貸出登録イベントの occurred_at を日付へ射影した値"
          nullable: false
          primary_key: false
        - name: "loan_period_type"
          type: "string"
          description: "貸出期間区分（バリエーション: 標準/短期/長期）。返却期限の算出単位"
          nullable: false
          primary_key: false
        - name: "due_date"
          type: "date"
          description: "返却期限。貸出日＋利用者区分に対応する貸出期間日数で自動設定する（条件: 返却期限設定条件）"
          nullable: false
          primary_key: false
        - name: "loan_status"
          type: "string"
          description: "貸出状態（貸出中/延滞/返却済み）。スナップショットが保持するキャッシュ的ステータス"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-001"
          type: "N:1"
          description: "1冊の書籍は時系列で複数の貸出を持つ（同時に有効な貸出は1件）"
        - target_entity: "E-002"
          type: "N:1"
          description: "1人の利用者は複数の貸出を持つ"
    - id: "E-005"
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
          description: "予約対象の書籍ID"
          nullable: false
          primary_key: false
        - name: "user_no"
          type: "string"
          description: "予約申込者の利用者番号"
          nullable: false
          primary_key: false
        - name: "applied_at"
          type: "datetime"
          description: "予約申込日時。予約順位の昇順ソートキー（条件: 予約順位決定条件）"
          nullable: false
          primary_key: false
        - name: "priority"
          type: "integer"
          description: "予約順位。貸出済み・キャンセルを除外して繰り上げ再計算する"
          nullable: false
          primary_key: false
        - name: "reservation_status"
          type: "string"
          description: "予約状態（予約中/取置き中/貸出済み/キャンセル）。スナップショットが保持するキャッシュ的ステータス"
          nullable: false
          primary_key: false
        - name: "hold_expires_at"
          type: "datetime"
          description: "取置き期限。取置き期限切れの日次判定でインデックス検索するためスナップショットに保持する（イミュータブル原則の明示的例外。取置き開始日時は取置き遷移イベントの occurred_at で管理する）"
          nullable: true
          primary_key: false
      relationships:
        - target_entity: "E-001"
          type: "N:1"
          description: "1冊の書籍は複数の予約（予約待ち行列）を持つ"
        - target_entity: "E-002"
          type: "N:1"
          description: "1人の利用者は複数の予約を持つ"
    - id: "E-006"
      name: "通知"
      source_info: "情報: 通知"
      model_type: "event_snapshot"
      attributes:
        - name: "notification_id"
          type: "string"
          description: "通知ID"
          nullable: false
          primary_key: true
        - name: "notification_type"
          type: "string"
          description: "通知種別（バリエーション: 取置き案内/返却期限リマインド/延滞督促）"
          nullable: false
          primary_key: false
        - name: "timing_type"
          type: "string"
          description: "通知タイミング区分（バリエーション: 期限前リマインド/期限当日/期限超過督促）"
          nullable: false
          primary_key: false
        - name: "recipient_user_no"
          type: "string"
          description: "宛先利用者番号"
          nullable: false
          primary_key: false
        - name: "recipient_email"
          type: "string"
          description: "宛先メールアドレス。送信時点の値をコピーして保持する（利用者側の変更に追随させない）。保管時暗号化の対象（NFR E.6.1.1）"
          nullable: false
          primary_key: false
        - name: "target_loan_id"
          type: "string"
          description: "対象貸出ID。リマインド・督促のときに設定する"
          nullable: true
          primary_key: false
        - name: "target_reservation_id"
          type: "string"
          description: "対象予約ID。取置き案内のときに設定する"
          nullable: true
          primary_key: false
        - name: "send_result"
          type: "text"
          description: "送信結果。メール配信サービスの応答コード・エラー内容を記録し未達追跡に使う"
          nullable: true
          primary_key: false
        - name: "notification_status"
          type: "string"
          description: "通知状態（送信待ち/送信済み/送信失敗）。スナップショットが保持するキャッシュ的ステータス。送信日時は送信イベントの occurred_at で管理する"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-002"
          type: "N:1"
          description: "1人の利用者は複数の通知を受け取る"
        - target_entity: "E-004"
          type: "N:1"
          description: "1件の貸出に対しリマインド・督促の通知が複数回発生する"
        - target_entity: "E-005"
          type: "N:1"
          description: "1件の予約に対し取置き案内の通知が発生する"
    - id: "E-007"
      name: "統計レポート"
      source_info: "情報: 統計レポート"
      model_type: "event_snapshot"
      attributes:
        - name: "report_id"
          type: "string"
          description: "レポートID"
          nullable: false
          primary_key: true
        - name: "report_type"
          type: "string"
          description: "レポート種別（バリエーション: 在庫状況/人気書籍ランキング/期間別貸出統計）"
          nullable: false
          primary_key: false
        - name: "period_type"
          type: "string"
          description: "集計期間区分（バリエーション: 日次/月次/年次）"
          nullable: false
          primary_key: false
        - name: "period_start"
          type: "date"
          description: "集計開始日"
          nullable: false
          primary_key: false
        - name: "period_end"
          type: "date"
          description: "集計終了日"
          nullable: false
          primary_key: false
        - name: "aggregated_at"
          type: "datetime"
          description: "集計日時。集計開始イベントの occurred_at を射影した値"
          nullable: false
          primary_key: false
        - name: "detail"
          type: "text"
          description: "集計明細。書籍状態別件数・書籍別貸出回数・書籍一覧を構造化テキスト（JSON）で保持する導出データ"
          nullable: false
          primary_key: false
        - name: "report_status"
          type: "string"
          description: "統計レポート状態（集計中/作成済み/実績なし）。スナップショットが保持するキャッシュ的ステータス"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-001"
          type: "N:M"
          description: "集計明細は書籍を集計軸として参照する（読み取り専用の導出関係。外部キー制約は張らない）"
        - target_entity: "E-004"
          type: "N:M"
          description: "集計明細は期間内の貸出実績を集計する（読み取り専用の導出関係）"
    - id: "E-901"
      name: "セッション情報"
      source_info: "情報: なし（派生エンティティ。外部アクター + OAuth2/OIDC 認証から生成）"
      model_type: "resource_mutable"
      attributes:
        - name: "session_id"
          type: "string"
          description: "セッションID"
          nullable: false
          primary_key: true
        - name: "account_id"
          type: "string"
          description: "利用者アカウントID"
          nullable: false
          primary_key: false
        - name: "user_no"
          type: "string"
          description: "利用者番号。本人限定参照（条件: 個人情報参照可否条件）の判定に使う"
          nullable: false
          primary_key: false
        - name: "role"
          type: "string"
          description: "役割（司書/利用者）。RBAC の粗粒度判定に使う（NFR E.5.2.1）"
          nullable: false
          primary_key: false
        - name: "access_token"
          type: "string"
          description: "アクセストークン。IdP が発行する"
          nullable: false
          primary_key: false
        - name: "refresh_token"
          type: "string"
          description: "リフレッシュトークン"
          nullable: true
          primary_key: false
        - name: "expires_at"
          type: "datetime"
          description: "有効期限。TTL による自動失効の基準"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-003"
          type: "N:1"
          description: "1つの利用者アカウントは複数の同時セッションを持ちうる"
    - id: "E-902"
      name: "通知送信冪等キー"
      source_info: "情報: なし（派生エンティティ。条件「取置き通知対象条件」の重複送信抑止と MQ の at-least-once 配信から生成）"
      model_type: "resource_mutable"
      attributes:
        - name: "idempotency_key"
          type: "string"
          description: "冪等キー。通知種別＋対象貸出ID/対象予約ID＋通知タイミング区分から決定的に生成する"
          nullable: false
          primary_key: true
        - name: "notification_id"
          type: "string"
          description: "生成済みの通知ID"
          nullable: false
          primary_key: false
        - name: "requested_at"
          type: "datetime"
          description: "送信要求日時"
          nullable: false
          primary_key: false
        - name: "expires_at"
          type: "datetime"
          description: "キー保持期限。TTL で自動失効させる"
          nullable: false
          primary_key: false
      relationships:
        - target_entity: "E-006"
          type: "N:1"
          description: "冪等キーは1件の通知に対応する（実質 1:1）"
```

## 追加転写元: `docs/nfr/latest/nfr-grade.yaml`

- 転写元: `docs/nfr/latest/nfr-grade.yaml`
- source_sha256: `9ecccca870476f5c8b048641028a922e9f2b393562b9bca87d4bd1f567861198`
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
                reason: "BUC「貸出履歴を確認するフロー」「予約状況を確認するフロー」で利用者が Web から任意の時間に照会し、BUC「返却期限をリマインドするフロー」「延滞を督促するフロー」の通知処理が夜間帯に動くため、日中窓口業務時間を超える稼働が必要"
                source_model: "BUC: 貸出履歴を確認するフロー / 予約状況を確認するフロー / 返却期限をリマインドするフロー"
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
                reason: "モデルシステム2のデフォルト値を適用（A.1.1.1 の「1時間程度の停止」許容と整合）"
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
                reason: "モデルシステム2のデフォルト値を適用（デプロイ環境がクラウドに確定した場合は infrastructure スキルで Lv4 へ補正する）"
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
                reason: "モデルシステム2のデフォルト値を適用（司書窓口端末は代替機での運用継続が可能）"
                source_model: "アクター: 司書"
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
                reason: "モデルシステム2のデフォルト値を適用（デプロイ環境がクラウドに確定した場合は infrastructure スキルで Lv3 へ補正する）"
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
                reason: "規模感プリインタビューで「24/7 稼働、DR は RPO/RTO 24h 許容」を採用したため、待機拠点は設けず遠隔地バックアップに留める（モデルシステム2 デフォルトの Lv2 コールドスタンバイ拠点より 1 段低く設定）"
                source_model: "システム概要: まずは 1 館での運用を想定"
                confidence: "medium"
              - id: "A.3.1.2"
                name: "業務継続の要否"
                important: true
                grade: 1
                grade_description: "業務継続要（24時間以内に復旧）"
                reason: "規模感プリインタビューで DR は RPO/RTO 24h 許容を採用。貸出・返却は災害時に紙台帳での暫定運用が可能なため 24 時間以内の復旧で足りる"
                source_model: "システム概要: 紙台帳と表計算ファイルに分散した情報を統合"
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
                reason: "情報「貸出」「予約」「書籍」「利用者」「通知」の 5 つに状態モデルが定義され、貸出中／予約中／取置き中といった進行中取引が失われると窓口業務と整合しなくなるため、日次バックアップ（Lv1）では不足する。一方で金銭取引は扱わないため Lv3 以上は過剰"
                source_model: "状態: 書籍状態 / 貸出状態 / 予約状態 / 利用者状態 / 通知状態"
                confidence: "medium"
              - id: "A.4.1.2"
                name: "RTO（目標復旧時間）"
                important: true
                grade: 3
                grade_description: "2時間以内"
                reason: "通常障害時は開館時間中に窓口の貸出・返却が停止するため、モデルシステム2 デフォルトの 2 時間以内を採用（災害時の 24 時間は A.3.1.2 で別途規定）"
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
                reason: "規模感プリインタビューで登録利用者〜1,000 人・ピーク 10〜100 rps を採用。司書 2〜3 名の窓口操作と利用者の Web 照会を合わせても同時アクセスは 100 を超えない"
                source_model: "アクター: 司書 / 利用者（2 種）"
                confidence: "medium"
              - id: "B.1.1.2"
                name: "データ量"
                important: false
                grade: 1
                grade_description: "〜100万件/年（蔵書数万件＋貸出・予約・通知の年間明細を含めて総容量 100GB 未満）"
                reason: "規模感プリインタビューで総レコード〜100万件/年を採用。情報は書籍・利用者・利用者アカウント・貸出・予約・通知・統計レポートの 7 エンティティで、テキスト主体・添付ファイルなし"
                source_model: "情報: 書籍 / 利用者 / 貸出 / 予約 / 通知 / 統計レポート"
                confidence: "medium"
              - id: "B.1.1.3"
                name: "オンラインリクエスト件数"
                important: true
                grade: 2
                grade_description: "〜10,000件/日"
                reason: "UC 41 件のうち照会系が過半を占め、司書の窓口操作（貸出・返却・予約取消）と利用者の Web 照会を合わせて日次数千リクエストを想定。1 館規模のため 10 万件/日（Lv3）には達しない"
                source_model: "BUC: 全 13 フロー / UC 41 件"
                confidence: "medium"
              - id: "B.1.1.4"
                name: "バッチ処理件数"
                important: false
                grade: 1
                grade_description: "1回あたり〜10万件（貸出全件をリマインド・督促判定で日次走査）"
                reason: "UC「返却期限接近の貸出を判定する」「期限超過の貸出を延滞にする」が貸出レコードを日次で全件走査するが、貸出中の件数は蔵書数以下に収まるため 10 万件規模に留まる"
                source_model: "UC: 返却期限接近の貸出を判定する / 期限超過の貸出を延滞にする"
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
                reason: "モデルシステム2のデフォルト値を適用（返却期限リマインドメール送信直後に照会アクセスが集中する想定と整合）"
                source_model: "BUC: 返却期限をリマインドするフロー"
                confidence: "default"
              - id: "B.1.2.2"
                name: "ピーク時データ量"
                important: false
                grade: 1
                grade_description: "通常時の2倍（ピーク日でも1日あたり数千件の明細追加に留まる）"
                reason: "B.1.2.1 のピーク倍率と整合させた推定。RDRA に季節変動・イベント時の集中に関する記述はない"
                source_model: ""
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
                reason: "アクター「利用者」が社外から Web 画面で検索・照会を行い、UC「書籍を検索する」「書籍詳細と在庫状況を照会する」など一般利用者向け画面操作が多いため、モデルシステム2 標準の 5 秒以内を採用"
                source_model: "UC: 書籍を検索する / 書籍詳細と在庫状況を照会する、アクター: 利用者（社外・受益者）"
                confidence: "medium"
              - id: "B.2.1.2"
                name: "スループット"
                important: true
                grade: 2
                grade_description: "〜50 TPS"
                reason: "規模感プリインタビューのピーク 10〜100 rps に対し、保守的に下限側の 50 TPS を目標とする（モデルシステム2 デフォルトの Lv3 は 1 館規模には過剰）"
                source_model: ""
                confidence: "medium"
              - id: "B.2.1.3"
                name: "ターンアラウンドタイム"
                important: false
                grade: 2
                grade_description: "10秒以内（在庫状況・貸出統計レポートの集計要求から結果表示まで）"
                reason: "UC「在庫状況を区分別に集計する」「期間別貸出統計を集計する」は蔵書全件・期間内貸出の集計であり、データ量 100 万件/年の範囲では 10 秒以内で完了する"
                source_model: "UC: 在庫状況を区分別に集計する / 期間別貸出統計を集計する"
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
                reason: "モデルシステム2のデフォルト値を適用（リマインド・督促の通知バッチは翌開館時刻までに完了すればよい）"
                source_model: "BUC: 返却期限をリマインドするフロー / 延滞を督促するフロー"
                confidence: "default"
              - id: "B.2.2.2"
                name: "バッチ処理量"
                important: false
                grade: 1
                grade_description: "1回あたり〜10万件（貸出全件走査＋通知レコード生成）"
                reason: "B.1.1.4 のバッチ処理件数と整合させた推定。RDRA に具体的な処理件数の記述はない"
                source_model: ""
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
                reason: "アクター「利用者」が社外の一般ユーザーとして Web 照会を行うため、利用者増に対して水平拡張できる構成が必要。1 館運用のため自動スケール（Lv3）までは要さない"
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
                reason: "モデルシステム2のデフォルト値を適用（A.1.1.3 の計画停止許容と整合）"
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
                reason: "モデルシステム2のデフォルト値を適用（B.1.2.1 の通常時 2 倍ピークを検証対象とする）"
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
                reason: "情報「利用者」に氏名・連絡先（メールアドレス）という個人情報を保持するため、設置母体（自治体・法人）のセキュリティポリシー準拠が必要。ISMS 等の第三者認証（Lv3）までは 1 館規模には過剰"
                source_model: "情報: 利用者（氏名・連絡先）"
                confidence: "medium"
          - id: "E.1.2"
            name: "セキュリティ関連法規"
            important: false
            metrics:
              - id: "E.1.2.1"
                name: "準拠すべき法規・基準"
                important: false
                grade: 2
                grade_description: "個人情報保護法・不正アクセス禁止法に準拠（図書館の貸出履歴は思想信条を推知しうるためプライバシー配慮が特に必要）"
                reason: "情報「利用者」に氏名・連絡先、情報「貸出」に誰が何を借りたかの履歴が保持され、条件「個人情報参照可否条件」で本人限定参照が定められている"
                source_model: "情報: 利用者（氏名・連絡先）/ 貸出、条件: 個人情報参照可否条件"
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
                reason: "モデルシステム2のデフォルト値を適用（インターネット公開する利用者向け画面と個人情報の組み合わせに対し脅威分析が必要）"
                source_model: "アクター: 利用者（社外）"
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
                reason: "インターネット公開する利用者向け画面があるため無診断（Lv0）は不可だが、1 館規模・決済なしのためモデルシステム2 デフォルトの手動脆弱性診断（Lv2）より 1 段低く設定した。RDRA に診断要件の記述がないため確信度は低い"
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
                reason: "モデルシステム2のデフォルト値を適用（C.2.1.2 の四半期パッチ適用と連動）"
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
                reason: "情報「利用者アカウント」にログインIDと役割（司書／利用者）が定義されており認証が前提。ただし外部システムは通知メール配信のみで認証連携がなく、一般利用者に多要素認証（Lv3）を課すと利用障壁になるため Lv2 とした"
                source_model: "情報: 利用者アカウント（ログインID、役割）、外部システム: メール配信サービス"
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
                reason: "情報「利用者アカウント」の属性「役割（司書／利用者）」で利用権限を分け、司書向け照会と利用者向け Web 照会を出し分けると明記されている"
                source_model: "情報: 利用者アカウント（役割（司書／利用者））、条件: 個人情報参照可否条件"
                confidence: "high"
          - id: "E.5.3"
            name: "利用制限"
            important: false
            metrics:
              - id: "E.5.3.1"
                name: "利用制限"
                important: false
                grade: 1
                grade_description: "司書向け管理機能は館内ネットワークからのみ利用可、利用者向け照会はインターネットへ公開"
                reason: "アクター「司書」は社内、アクター「利用者」は社外という区分から接続元の分離が推論できるが、館内ネットワーク制限の要否は RDRA に記述がない"
                source_model: "アクター: 司書（社内）/ 利用者（社外）"
                confidence: "low"
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
                grade_description: "機密データのみ暗号化（利用者の氏名・連絡先、利用者アカウントのパスワード、貸出履歴）"
                reason: "情報「利用者」に氏名・連絡先（メールアドレス）、情報「利用者アカウント」にログインIDが含まれ、情報「貸出」は誰が何を借りたかの履歴となるため保管時暗号化が必要"
                source_model: "情報: 利用者（氏名、連絡先（メールアドレス））/ 利用者アカウント / 貸出"
                confidence: "high"
              - id: "E.6.1.2"
                name: "データ暗号化（通信時）"
                important: true
                grade: 2
                grade_description: "全通信暗号化（内部通信を含む）"
                reason: "アクター「利用者」が社外から Web 照会を行い、外部システム「メール配信サービス」へ宛先メールアドレスを送信するため、外部通信・内部通信ともに暗号化が必要"
                source_model: "アクター: 利用者（社外）、外部システム: メール配信サービス、情報: 通知（宛先メールアドレス）"
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
                reason: "C.4.1.1 で簡易テスト環境を設けるため、情報「利用者」の個人情報がテスト環境へ流出しないようマスキングが必要"
                source_model: "情報: 利用者（氏名、連絡先）"
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
                reason: "条件「個人情報参照可否条件」で本人以外の貸出履歴・予約状況の参照を禁じており、逸脱を検知するにはデータアクセスログが必須。改ざん検知（Lv3）は金銭取引がないため要さない"
                source_model: "条件: 個人情報参照可否条件、情報: 利用者アカウント（役割）"
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
                reason: "情報「利用者アカウント」に有効フラグがあり、不正ログイン試行への無効化が想定できる"
                source_model: "情報: 利用者アカウント（有効フラグ）"
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
                reason: "インターネット公開があるため検知は必要と推論したが、遮断まで要するかは RDRA に記述がない"
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
                reason: "情報「利用者」「貸出」の個人情報をインターネット公開画面から参照させるため、DB 層の直接露出を避ける必要がある"
                source_model: "情報: 利用者 / 貸出、アクター: 利用者（社外）"
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
                reason: "インターネット公開する利用者向け Web 画面があるため WAF なし（Lv0）は不可だが、1 館規模で決済を伴わないためモデルシステム2 デフォルトのカスタムルール＋定期チューニング（Lv2）は運用負荷に見合わないと判断した。RDRA に Web 攻撃対策の記述がないため確信度は低い"
                source_model: "アクター: 利用者（社外）、システム概要: interface_kind=gui"
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
                reason: "システム概要の interface_kind が gui であり、UC「書籍を検索する」で利用者入力を検索条件に用いるためインジェクション対策が必須"
                source_model: "システム概要: interface_kind=gui、UC: 書籍を検索する、条件: 書籍検索条件"
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
                reason: "情報「利用者」の個人情報漏えい時には個人情報保護法上の報告・通知義務が生じるため、連絡体制のみ（Lv1）では不十分"
                source_model: "情報: 利用者（氏名、連絡先）"
                confidence: "medium"
```

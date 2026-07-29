# 変更サマリ

- event_id: 20260729_141624_spec_generation
- trigger_event: rdra:20260729_140044_impl_feedback_19ec0182, usdm:20260729_140044_impl_feedback_19ec0182, arch:20260412_164019_arch_infra_feedback（変更なし）, design:20260412_164650_design_system（変更なし）

## 追加 UC

なし

## 変更 UC

- 貸出管理業務/貸出管理フロー/書籍を貸出する（REQ-007〜REQ-012 反映。認証・アクセス制御の実装契約明確化、予約状態モデル「完了」新設への追従、貸出可否判定ルールの例外明記、reservations 参照の明示、返却期限表記統一、onLoan 戻り値型明確化）

## 削除 UC

なし

## 影響 BUC

- 貸出管理業務/貸出管理フロー（「書籍を貸出する」UC 変更に伴い buc-spec.md の BUC 内共有条件一覧を再生成。貸出可否判定ルールの説明を更新、利用者認証・アクセス制御ルール/冪等リクエスト処理ルールを追加）

## cross-cutting 再生成

- openapi.yaml: `POST /api/v1/loans` に認証（`user` スコープ）・`X-User-Id` ヘッダ・401/400/404 レスポンスを追加（400/404 は Step6.5 round-1 F-001 で判明した tier-backend-api.md との契約不一致の是正）。`searchBooks` の genre/material_type query parameter、`CreateBookRequest`/`UpdateBookRequest` の genre/material_type enum を `components.schemas.Genre`/`MaterialType` の共有スキーマに統合し `x-enum-varnames`（英語識別子）付きで `$ref` 参照化（Step6.5 round-1 F-005 の重複定義是正）。`ReservationResponse.status` の enum に `fulfilled` を追加（Step6.5 round-2 F-007。rdb-schema.yaml の4値定義との不一致是正）
- asyncapi.yaml: `OverdueNotificationMessage`/`ReservationNotificationMessage` の `payload` に `title`（`OverdueNotificationPayload`/`ReservationNotificationPayload`）を追加
- rdb-schema.yaml: `reservations.status` の description を「pending/reserved/cancelled/fulfilled」の4値に更新し、各値の意味（RDRA予約状態ラベルとの対応）を明記
- kvs-schema.yaml: `idempotency:{idempotency_key}` の value_description を訂正し、重複時の挙動は各API仕様（tier-*.md のエラー表）を優先する旨を明記
- traceability-matrix.md: 条件マトリクスに利用者認証・アクセス制御ルール／冪等リクエスト処理ルールの2行を追加（4→6件）、貸出可否判定ルールの説明文を最新の例外条件込みに更新。状態遷移マトリクスに「予約状態 | 予約確保済 | 完了 | 書籍を貸出する」の1行を追加（9→10件）。網羅率サマリー（条件6/6・状態遷移パス10/10・合計53/53）を訂正（Step6.5 round-1 F-002 の是正。当初「変更なし」としていたが実態と一致していなかった）
- ux-ui/*.md: 変更なし（latest の内容をそのまま引き継ぎ）

## 既知課題の扱い（今回未対応・スコープ外として持ち越し）

- `cross_uc_api_dependency_undeclared`（tier-frontend.md が参照する `GET /api/v1/books/:id` が
  `_api-summary.yaml` の endpoints に宣言されていない cross-UC 依存の暗黙参照）: USDM の
  `docs/usdm/events/20260729_140044_impl_feedback_19ec0182/source.txt` において、dist-spec 自体の
  生成ロジック改善要望（`_api-summary.yaml` への `external_dependencies` 欄追加等）としてUSDM化を
  見送り済み（RDRA業務モデルへの直接影響がないため）。本イベントでも同様にスコープ外とし、対応しない。

## 予約系 UC への波及確認（スコープ判定・追加変更なし）

予約状態モデルへの「完了」状態新設（RDRA状態.tsv, 遷移元: 予約確保済, トリガー: 書籍を貸出する）について、
以下の3 UC の spec.md 状態遷移一覧、および buc-spec.md（予約管理業務/予約管理フロー）の状態遷移全体図への
追記の要否を確認した:

- 予約管理業務/予約管理フロー/書籍を予約する（トリガー UC: 自身。遷移: (初期)→予約受付中）
- 予約管理業務/予約管理フロー/予約をキャンセルする（トリガー UC: 自身。遷移: 予約受付中→予約キャンセル）
- 予約管理業務/予約管理フロー/予約通知を送信する（トリガー UC: 自身。遷移: 予約受付中→予約確保済）
- 予約管理業務/予約管理フロー/buc-spec.md（状態遷移全体図・UCマッピング表）

**判定: 変更不要**。上記いずれの spec.md 状態遷移一覧も「自身がトリガーする遷移のみ」を記載する設計であり、
「予約確保済→完了」の遷移トリガーは他業務の UC（書籍を貸出する）であるため、この3 UC のどの状態遷移一覧にも
元々含まれていない。buc-spec.md（予約管理フロー）の状態遷移全体図も、所属 UC（この3件）がトリガーする
遷移のみを描画する設計であり、旧仕様の時点でも「予約確保済→(終了)」は描画されていなかった。今回の変更で
この設計方針を変える理由はないため、3 UC・buc-spec.md いずれも未変更とした。

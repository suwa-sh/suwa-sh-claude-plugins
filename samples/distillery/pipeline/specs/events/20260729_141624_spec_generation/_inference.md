# Spec 差分更新 分析根拠

## 分析日時

2026-07-29T14:16:24

## 差分の起点

- USDM: `docs/usdm/events/20260729_140044_impl_feedback_19ec0182/requirements.yaml`（REQ-007〜REQ-012）
- RDRA: `docs/rdra/events/20260729_140044_impl_feedback_19ec0182/`（BUC.tsv, 条件.tsv, 状態.tsv, バリエーション.tsv, 外部システム.tsv）
- いずれも `docs/rdra/latest/` に既にマージ済み（dist-requirements が先行処理済み）であることを確認した上で、`docs/rdra/latest/*.tsv` を Spec 差分生成の入力とした

## 影響範囲判定（コストゲート）

`affected_models` の `target` と `related_files` を突き合わせ、影響 UC を以下のように判定した:

| SPEC-ID | affected_models.target | 波及 UC |
|---------|------------------------|---------|
| SPEC-007-01/02 | 条件: 利用者認証・アクセス制御ルール | 書籍を貸出する（related_files が本UC配下に限定） |
| SPEC-008-01 | 状態: 予約状態 | 書籍を貸出する（遷移UCは状態.tsv上「書籍を貸出する」のみ） |
| SPEC-008-02 | 条件: 貸出可否判定ルール / BUC: 貸出管理フロー | 書籍を貸出する |
| SPEC-009-01 | 外部システム: メール送信サービス | _cross-cutting/api/asyncapi.yaml（全UC統合ファイルへの直接編集） |
| SPEC-009-02 | バリエーション: 書籍ジャンル/資料種別 | _cross-cutting/api/openapi.yaml（同上。searchBooks に加え、同じ enum を持つ CreateBookRequest/UpdateBookRequest にも一貫性のため適用） |
| SPEC-010-01 | 条件: 冪等リクエスト処理ルール | _cross-cutting/datastore/kvs-schema.yaml（同上） |
| SPEC-011-01 / SPEC-012-01 | 情報: 貸出（tier-frontend.md 表記のみ、RDRA実体変更なし） | 書籍を貸出する |

**予約系 UC（書籍を予約する / 予約をキャンセルする / 予約通知を送信する）への波及確認**: 状態.tsv の
「予約状態」モデル全体を確認したところ、遷移 UC 列は各遷移ごとに1つの UC のみを持ち、「予約確保済→完了」
の遷移 UC は「書籍を貸出する」のみだった。既存の3 UC の spec.md 状態遷移一覧は「自身がトリガーする遷移
のみ」を記載する設計（他業務UCがトリガーする遷移は記載しない）であることを確認したため、この3 UC・
buc-spec.md（予約管理フロー）への変更は不要と判定した。詳細は `_changes.md` の該当セクションを参照。

**結論**: フル改修対象は「書籍を貸出する」1 UC のみ。team-lead 指示の「4 UC 超過なら停止」ゲートに対し
1 UC で収まるため、生成に進んだ。

## UC-ティアマッピング（変更なし）

「書籍を貸出する」UC は画面あり UC（外部アクター: 利用者）と判定済み（既存 latest と同一判定）。
対象ティア: Presentation 系（tier-frontend, user向け） + API 系（tier-backend-api）。ティア構成自体の
変更はなし（arch-design.yaml に変更がないため）。

## 全体横断設計方針

Step2（ux-design.md, ui-design.md, data-visualization.md）は前段（RDRA/Design）の当該部分に変更がないため、
`latest/` の既存内容をそのまま `events/` にコピーして引き継いだ（再生成なし）。

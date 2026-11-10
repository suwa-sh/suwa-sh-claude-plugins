| # | 観点 | 判定 | 該当指摘 | 一言根拠 |
|---|------|------|---------|---------|
| P1 | 要求との縦の整合 | CONCERN | 指摘 1 | 要求の二重予約防止と、非機能グレード表の復旧水準を照合した |
| P2 | ADR どうしの横の整合 | CONCERN | 指摘 2 | 修正後の ADR 0016 と backend の rules を照合した |
| P3 | 決めずに残した点 | PASS | なし | 認証方式、稼働時間、旧予約の移行などの仮置きが確認事項として返されていることを確認した |

### 指摘 1
- **perspective**: P1
- **対象**: `docs/nfr/nfr-grade.md:43,75`、`docs/nfr/nfr-grade.yaml:170,411`
- **severity**: high
- **claim**: 前回指摘した復旧水準の不整合が残っている。非機能グレード表は前日のバックアップまでの復旧を許すため、成立を知らせた予約が復旧後に消えうる。
- **evidence**: `SPEC-002-02` は重なる有効な予約を禁じる。グレード表の RPO は「前日の最終バックアップまで」、バックアップ方式は日次のまま。ADR 0016 も `docs/adr/0016-backup-point-in-time-recovery.md:56` で食い違いが残ると明記している。
- **why_raised**: 障害当日に成立した予約が消えると、その枠を別の社員が再び予約でき、先に成立を知らされた社員と利用が衝突する。
- **suggested_fix**: グレード表の RPO とバックアップ方式を、ADR 0016 で決めた復旧水準に合わせる。

### 指摘 2
- **perspective**: P2
- **対象**: `docs/adr/0016-backup-point-in-time-recovery.md:16-18`、`docs/rules/tier-backend.md:101-102`
- **severity**: high
- **claim**: 前回指摘への修正は ADR 0016 に入ったが、backend の rules には反映されていない。rules の「コミット後に応答」だけでは、別の保管場所への記録完了を保証できない。
- **evidence**: ADR 0016 は、更新の記録が別の保管場所に書き終わったことを確かめてから確定を完了すると定める。backend の rules にはその条件と、記録が届かない場合に成立・取り消しを失敗にする規則が無い。
- **why_raised**: rules を実装の基準にすると、記録の到達前にコミットと応答を済ませられる。その間に DB 本体を失えば、利用者に知らせた予約を復元できない。
- **suggested_fix**: ADR 0016 の同期書き込み、到達確認、失敗時の扱いを backend の rules に反映する。

below-threshold

なし。

Codex session ID: 01a1a6ca-139d-7d93-9281-7b52d7f864ba
Resume in Codex: codex resume 01a1a6ca-139d-7d93-9281-7b52d7f864ba

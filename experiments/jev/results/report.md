# Jev 実測レポート

確信帯: hi=0.8 / lo=0.2。確率が hi 以上ははい、lo 以下はいいえ、それ以外は保留として扱う。

注意: 正解の候補は arch-design.yaml / arch-design.md / decisions/* のテキストにパターン名（またはRDRAモデル種別）が出現するかどうかで機械抽出した粗い基準であり、絶対の正解ではない。出現は adopted（採用の文脈）/ rejected（decisions の alternatives_considered 配下、または「不採用」等のキーワードを含む行）に分類し、一般語の別名（weakAliases）だけの自由記述中の出現や adopted/rejected の混在は ambiguous として一致率の分母から除外し、人が見る一覧に出す。一般語の別名でも、YAML の name: キーの値や Markdown 表の先頭セルのような構造化された箇所での出現は adopted として扱う。

## experiments/jev/results/library-patterns-en.json

- judge: patterns
- lang: en
- model: jev-1.13.0
- requests: 6
- input tokens (合計): 26816
- 所要時間（median latencyMs）: 260

### コードで決めた項目（always / numericGates / codeSignal / excludeCodeSignal）

- 件数: 6（うち正解の候補が ambiguous: 0）
- 一致率（ambiguous を除く）: 1.00

#### コードで決めた項目の食い違い一覧（レビュー指摘1: Jev の食い違いとは別表にする）

| pattern | decidedBy | コードの判定 | 正解の候補 |
|---|---|---|---|

### Jev 判定の項目

- 件数: 24（うち正解の候補が ambiguous: 3）
- 保留率（ambiguous を除く全項目のうち）: 0.43
- 一致率（確信帯かつ ambiguous を除く項目のうち）: 0.67

#### 食い違い・保留・ambiguous の一覧（人が見る一覧）

| pattern | 状態 | Jev | 正解の候補 | 根拠の出現箇所 |
|---|---|---|---|---|
| circuit-breaker | 保留 | (保留) | true | arch/latest/arch-design.yaml:726(adopted), arch/latest/arch-design.yaml:727(adopted), arch/latest/arch-design.yaml:733(adopted) |
| retry | 不一致 | false | true | arch/latest/arch-design.yaml:726(adopted), arch/latest/arch-design.yaml:1122(adopted), arch/latest/arch-design.yaml:1606(adopted), arch/latest/arch-design.yaml:643(weak), arch/latest/arch-design.yaml:778(weak), arch/latest/arch-design.yaml:1123(weak) |
| timeout | 保留 | (保留) | true | arch/latest/arch-design.yaml:726(adopted), arch/latest/arch-design.yaml:1606(adopted), arch/latest/arch-design.md:313(adopted), arch/latest/arch-design.yaml:643(weak), arch/latest/arch-design.yaml:727(weak), arch/latest/arch-design.yaml:1148(weak) |
| saga | 不一致 | true | false | (なし) |
| compensating-transaction | 不一致 | true | false | (なし) |
| materialized-view | ambiguous（正解の候補が決めがたい） | true | ambiguous | arch/latest/arch-design.yaml:2144(adopted), arch/latest/arch-design.yaml:2304(adopted), arch/latest/arch-design.md:1017(adopted), arch/latest/decisions/arch-decision-010.yaml:45(rejected) |
| static-content-hosting | ambiguous（正解の候補が決めがたい） | false | ambiguous | arch/latest/arch-design.yaml:399(weak), arch/latest/arch-design.yaml:409(weak), arch/latest/arch-design.md:170(weak) |
| publisher-subscriber | 保留 | (保留) | false | (なし) |
| competing-consumers | 保留 | (保留) | true | arch/latest/arch-design.yaml:631(adopted), arch/latest/arch-design.md:276(adopted) |
| asynchronous-request-reply | 保留 | (保留) | false | (なし) |
| priority-queue | 保留 | (保留) | false | (なし) |
| federated-identity | 不一致 | true | false | (なし) |
| gatekeeper-gateway-offloading | 保留 | (保留) | true | arch/latest/arch-design.yaml:477(adopted), arch/latest/arch-design.yaml:1463(adopted), arch/latest/arch-design.yaml:1556(adopted), arch/latest/arch-design.yaml:428(weak), arch/latest/arch-design.yaml:453(weak), arch/latest/arch-design.yaml:466(weak) |
| backends-for-frontends | ambiguous（正解の候補が決めがたい） | (保留) | ambiguous | arch/latest/decisions/arch-decision-007.yaml:41(weak), arch/latest/decisions/arch-decision-007.yaml:42(weak) |
| anti-corruption-layer | 保留 | (保留) | true | arch/latest/arch-design.yaml:720(adopted), arch/latest/arch-design.yaml:1336(adopted), arch/latest/arch-design.yaml:1594(adopted), arch/latest/arch-design.yaml:713(weak), arch/latest/arch-design.yaml:717(weak), arch/latest/arch-design.yaml:1332(weak) |
| ambassador | 保留 | (保留) | false | (なし) |

## experiments/jev/results/library-patterns-ja.json

- judge: patterns
- lang: ja
- model: jev-1.13.0
- requests: 6
- input tokens (合計): 28073
- 所要時間（median latencyMs）: 272

### コードで決めた項目（always / numericGates / codeSignal / excludeCodeSignal）

- 件数: 6（うち正解の候補が ambiguous: 0）
- 一致率（ambiguous を除く）: 1.00

#### コードで決めた項目の食い違い一覧（レビュー指摘1: Jev の食い違いとは別表にする）

| pattern | decidedBy | コードの判定 | 正解の候補 |
|---|---|---|---|

### Jev 判定の項目

- 件数: 24（うち正解の候補が ambiguous: 3）
- 保留率（ambiguous を除く全項目のうち）: 0.52
- 一致率（確信帯かつ ambiguous を除く項目のうち）: 0.70

#### 食い違い・保留・ambiguous の一覧（人が見る一覧）

| pattern | 状態 | Jev | 正解の候補 | 根拠の出現箇所 |
|---|---|---|---|---|
| circuit-breaker | 保留 | (保留) | true | arch/latest/arch-design.yaml:726(adopted), arch/latest/arch-design.yaml:727(adopted), arch/latest/arch-design.yaml:733(adopted) |
| retry | 保留 | (保留) | true | arch/latest/arch-design.yaml:726(adopted), arch/latest/arch-design.yaml:1122(adopted), arch/latest/arch-design.yaml:1606(adopted), arch/latest/arch-design.yaml:643(weak), arch/latest/arch-design.yaml:778(weak), arch/latest/arch-design.yaml:1123(weak) |
| timeout | 保留 | (保留) | true | arch/latest/arch-design.yaml:726(adopted), arch/latest/arch-design.yaml:1606(adopted), arch/latest/arch-design.md:313(adopted), arch/latest/arch-design.yaml:643(weak), arch/latest/arch-design.yaml:727(weak), arch/latest/arch-design.yaml:1148(weak) |
| saga | 不一致 | true | false | (なし) |
| compensating-transaction | 不一致 | true | false | (なし) |
| cache-aside | 保留 | (保留) | true | arch/latest/arch-design.yaml:801(adopted), arch/latest/arch-design.yaml:1128(adopted), arch/latest/arch-design.yaml:1129(adopted) |
| materialized-view | ambiguous（正解の候補が決めがたい） | (保留) | ambiguous | arch/latest/arch-design.yaml:2144(adopted), arch/latest/arch-design.yaml:2304(adopted), arch/latest/arch-design.md:1017(adopted), arch/latest/decisions/arch-decision-010.yaml:45(rejected) |
| static-content-hosting | ambiguous（正解の候補が決めがたい） | false | ambiguous | arch/latest/arch-design.yaml:399(weak), arch/latest/arch-design.yaml:409(weak), arch/latest/arch-design.md:170(weak) |
| publisher-subscriber | 保留 | (保留) | false | (なし) |
| competing-consumers | 保留 | (保留) | true | arch/latest/arch-design.yaml:631(adopted), arch/latest/arch-design.md:276(adopted) |
| asynchronous-request-reply | 保留 | (保留) | false | (なし) |
| priority-queue | 保留 | (保留) | false | (なし) |
| federated-identity | 不一致 | true | false | (なし) |
| gatekeeper-gateway-offloading | 保留 | (保留) | true | arch/latest/arch-design.yaml:477(adopted), arch/latest/arch-design.yaml:1463(adopted), arch/latest/arch-design.yaml:1556(adopted), arch/latest/arch-design.yaml:428(weak), arch/latest/arch-design.yaml:453(weak), arch/latest/arch-design.yaml:466(weak) |
| backends-for-frontends | ambiguous（正解の候補が決めがたい） | (保留) | ambiguous | arch/latest/decisions/arch-decision-007.yaml:41(weak), arch/latest/decisions/arch-decision-007.yaml:42(weak) |
| anti-corruption-layer | 保留 | (保留) | true | arch/latest/arch-design.yaml:720(adopted), arch/latest/arch-design.yaml:1336(adopted), arch/latest/arch-design.yaml:1594(adopted), arch/latest/arch-design.yaml:713(weak), arch/latest/arch-design.yaml:717(weak), arch/latest/arch-design.yaml:1332(weak) |
| ambassador | 保留 | (保留) | false | (なし) |

## experiments/jev/results/equipment-patterns-en.json

- judge: patterns
- lang: en
- model: jev-1.13.0
- requests: 6
- input tokens (合計): 7397
- 所要時間（median latencyMs）: 240.5

### コードで決めた項目（always / numericGates / codeSignal / excludeCodeSignal）

- 件数: 7（うち正解の候補が ambiguous: 0）
- 一致率（ambiguous を除く）: 1.00

#### コードで決めた項目の食い違い一覧（レビュー指摘1: Jev の食い違いとは別表にする）

| pattern | decidedBy | コードの判定 | 正解の候補 |
|---|---|---|---|

### Jev 判定の項目

- 件数: 23（うち正解の候補が ambiguous: 0）
- 保留率（ambiguous を除く全項目のうち）: 0.48
- 一致率（確信帯かつ ambiguous を除く項目のうち）: 0.67

#### 食い違い・保留・ambiguous の一覧（人が見る一覧）

| pattern | 状態 | Jev | 正解の候補 | 根拠の出現箇所 |
|---|---|---|---|---|
| circuit-breaker | 保留 | (保留) | true | arch/latest/arch-design.yaml:341(adopted), arch/latest/arch-design.yaml:342(adopted), arch/latest/arch-design.yaml:992(adopted) |
| retry | 不一致 | false | true | arch/latest/arch-design.yaml:992(adopted), arch/latest/arch-design.md:494(adopted), arch/latest/arch-design.yaml:341(weak), arch/latest/arch-design.yaml:342(weak), arch/latest/arch-design.md:177(weak) |
| timeout | 保留 | (保留) | true | arch/latest/arch-design.yaml:289(adopted), arch/latest/arch-design.yaml:340(adopted), arch/latest/arch-design.yaml:595(adopted), arch/latest/arch-design.yaml:290(weak), arch/latest/arch-design.yaml:341(weak), arch/latest/arch-design.yaml:342(weak) |
| saga | 不一致 | true | false | (なし) |
| compensating-transaction | 不一致 | true | false | (なし) |
| queue-based-load-leveling | 不一致 | true | false | (なし) |
| cache-aside | 保留 | (保留) | false | (なし) |
| materialized-view | 保留 | (保留) | false | (なし) |
| publisher-subscriber | 保留 | (保留) | false | (なし) |
| competing-consumers | 保留 | (保留) | false | (なし) |
| priority-queue | 保留 | (保留) | false | (なし) |
| federated-identity | 保留 | (保留) | true | arch/latest/arch-design.yaml:392(adopted), arch/latest/arch-design.md:201(adopted), arch/latest/decisions/arch-decision-008.yaml:13(adopted) |
| gatekeeper-gateway-offloading | 保留 | (保留) | true | arch/latest/arch-design.yaml:416(adopted), arch/latest/arch-design.md:205(adopted), arch/latest/arch-design.yaml:417(weak), arch/latest/decisions/arch-decision-007.yaml:18(weak), arch/latest/decisions/arch-decision-007.yaml:37(weak) |
| anti-corruption-layer | 保留 | (保留) | true | arch/latest/arch-design.yaml:321(adopted), arch/latest/arch-design.yaml:986(adopted), arch/latest/arch-design.md:169(adopted), arch/latest/arch-design.yaml:127(weak), arch/latest/arch-design.yaml:129(weak), arch/latest/arch-design.yaml:176(weak) |
| ambassador | 保留 | (保留) | false | (なし) |

## experiments/jev/results/equipment-patterns-ja.json

- judge: patterns
- lang: ja
- model: jev-1.13.0
- requests: 6
- input tokens (合計): 8694
- 所要時間（median latencyMs）: 218.5

### コードで決めた項目（always / numericGates / codeSignal / excludeCodeSignal）

- 件数: 7（うち正解の候補が ambiguous: 0）
- 一致率（ambiguous を除く）: 1.00

#### コードで決めた項目の食い違い一覧（レビュー指摘1: Jev の食い違いとは別表にする）

| pattern | decidedBy | コードの判定 | 正解の候補 |
|---|---|---|---|

### Jev 判定の項目

- 件数: 23（うち正解の候補が ambiguous: 0）
- 保留率（ambiguous を除く全項目のうち）: 0.43
- 一致率（確信帯かつ ambiguous を除く項目のうち）: 0.69

#### 食い違い・保留・ambiguous の一覧（人が見る一覧）

| pattern | 状態 | Jev | 正解の候補 | 根拠の出現箇所 |
|---|---|---|---|---|
| circuit-breaker | 保留 | (保留) | true | arch/latest/arch-design.yaml:341(adopted), arch/latest/arch-design.yaml:342(adopted), arch/latest/arch-design.yaml:992(adopted) |
| retry | 保留 | (保留) | true | arch/latest/arch-design.yaml:992(adopted), arch/latest/arch-design.md:494(adopted), arch/latest/arch-design.yaml:341(weak), arch/latest/arch-design.yaml:342(weak), arch/latest/arch-design.md:177(weak) |
| timeout | 保留 | (保留) | true | arch/latest/arch-design.yaml:289(adopted), arch/latest/arch-design.yaml:340(adopted), arch/latest/arch-design.yaml:595(adopted), arch/latest/arch-design.yaml:290(weak), arch/latest/arch-design.yaml:341(weak), arch/latest/arch-design.yaml:342(weak) |
| saga | 不一致 | true | false | (なし) |
| compensating-transaction | 不一致 | true | false | (なし) |
| queue-based-load-leveling | 不一致 | true | false | (なし) |
| cache-aside | 保留 | (保留) | false | (なし) |
| materialized-view | 保留 | (保留) | false | (なし) |
| publisher-subscriber | 不一致 | true | false | (なし) |
| competing-consumers | 保留 | (保留) | false | (なし) |
| federated-identity | 保留 | (保留) | true | arch/latest/arch-design.yaml:392(adopted), arch/latest/arch-design.md:201(adopted), arch/latest/decisions/arch-decision-008.yaml:13(adopted) |
| gatekeeper-gateway-offloading | 保留 | (保留) | true | arch/latest/arch-design.yaml:416(adopted), arch/latest/arch-design.md:205(adopted), arch/latest/arch-design.yaml:417(weak), arch/latest/decisions/arch-decision-007.yaml:18(weak), arch/latest/decisions/arch-decision-007.yaml:37(weak) |
| anti-corruption-layer | 保留 | (保留) | true | arch/latest/arch-design.yaml:321(adopted), arch/latest/arch-design.yaml:986(adopted), arch/latest/arch-design.md:169(adopted), arch/latest/arch-design.yaml:127(weak), arch/latest/arch-design.yaml:129(weak), arch/latest/arch-design.yaml:176(weak) |
| ambassador | 保留 | (保留) | false | (なし) |

## experiments/jev/results/library-model-types-en.json

- judge: model-types
- lang: en
- model: jev-1.13.0
- requests: 19
- input tokens (合計): 20197
- 所要時間（median latencyMs）: 233

### 判定結果

- 件数（送った質問の総数）: 152
- 欠落した回答の件数: 0
- 保留率（欠落を含む）: 0.74
- 一致率（確信帯の項目のうち）: 0.95

#### 食い違い・保留の一覧

| spec | 種別 | 確率 | 欠落 | 正解の候補 |
|---|---|---|---|---|
| SPEC-001-01 | actor | 0.37 |  | true |
| SPEC-001-01 | information | 0.76 |  | true |
| SPEC-001-01 | state | 0.68 |  | false |
| SPEC-001-01 | condition | 0.46 |  | false |
| SPEC-001-01 | variation | 0.49 |  | false |
| SPEC-001-02 | actor | 0.33 |  | false |
| SPEC-001-02 | state | 0.77 |  | false |
| SPEC-001-02 | condition | 0.53 |  | false |
| SPEC-001-02 | variation | 0.41 |  | false |
| SPEC-001-03 | actor | 0.23 |  | true |
| SPEC-001-03 | information | 0.73 |  | false |
| SPEC-001-03 | state | 0.59 |  | false |
| SPEC-001-03 | buc | 0.77 |  | true |
| SPEC-001-03 | condition | 0.54 |  | false |
| SPEC-001-03 | variation | 0.49 |  | true |
| SPEC-002-01 | actor | 0.33 |  | false |
| SPEC-002-01 | condition | 0.81 |  | false |
| SPEC-002-01 | variation | 0.64 |  | false |
| SPEC-002-01 | external_system | 0.24 |  | false |
| SPEC-002-01 | business_policy | 0.27 |  | false |
| SPEC-002-02 | actor | 0.28 |  | false |
| SPEC-002-02 | information | 0.76 |  | true |
| SPEC-002-02 | condition | 0.76 |  | false |
| SPEC-002-02 | variation | 0.66 |  | false |
| SPEC-002-02 | external_system | 0.25 |  | false |
| SPEC-002-02 | business_policy | 0.25 |  | false |
| SPEC-002-03 | actor | 0.36 |  | false |
| SPEC-002-03 | information | 0.79 |  | true |
| SPEC-002-03 | variation | 0.62 |  | false |
| SPEC-002-03 | external_system | 0.28 |  | false |
| SPEC-002-03 | business_policy | 0.46 |  | false |
| SPEC-002-04 | actor | 0.41 |  | false |
| SPEC-002-04 | information | 0.7 |  | true |
| SPEC-002-04 | state | 0.81 |  | false |
| SPEC-002-04 | buc | 0.79 |  | true |
| SPEC-002-04 | condition | 0.79 |  | false |
| SPEC-002-04 | variation | 0.47 |  | false |
| SPEC-002-04 | external_system | 0.61 |  | true |
| SPEC-002-04 | business_policy | 0.34 |  | false |
| SPEC-003-01 | actor | 0.25 |  | false |
| SPEC-003-01 | information | 0.69 |  | true |
| SPEC-003-01 | state | 0.68 |  | false |
| SPEC-003-01 | buc | 0.75 |  | true |
| SPEC-003-01 | condition | 0.75 |  | false |
| SPEC-003-01 | variation | 0.34 |  | false |
| SPEC-003-01 | business_policy | 0.58 |  | true |
| SPEC-003-02 | actor | 0.51 |  | true |
| SPEC-003-02 | information | 0.56 |  | false |
| SPEC-003-02 | state | 0.58 |  | false |
| SPEC-003-02 | condition | 0.79 |  | true |
| SPEC-003-02 | variation | 0.42 |  | false |
| SPEC-003-02 | external_system | 0.45 |  | true |
| SPEC-003-02 | business_policy | 0.77 |  | false |
| SPEC-003-03 | actor | 0.49 |  | false |
| SPEC-003-03 | information | 0.77 |  | true |
| SPEC-003-03 | variation | 0.55 |  | false |
| SPEC-003-03 | external_system | 0.39 |  | false |
| SPEC-003-03 | business_policy | 0.54 |  | false |
| SPEC-004-01 | actor | 0.23 |  | false |
| SPEC-004-01 | information | 0.62 |  | true |
| SPEC-004-01 | state | 0.63 |  | false |
| SPEC-004-01 | condition | 0.47 |  | false |
| SPEC-004-01 | variation | 0.43 |  | false |
| SPEC-004-01 | external_system | 0.34 |  | false |
| SPEC-004-02 | actor | 0.23 |  | false |
| SPEC-004-02 | information | 0.64 |  | true |
| SPEC-004-02 | state | 0.74 |  | false |
| SPEC-004-02 | buc | 0.79 |  | true |
| SPEC-004-02 | condition | 0.44 |  | false |
| SPEC-004-02 | variation | 0.47 |  | false |
| SPEC-004-02 | external_system | 0.36 |  | false |
| SPEC-005-01 | actor | 0.25 |  | false |
| SPEC-005-01 | information | 0.62 |  | false |
| SPEC-005-01 | state | 0.76 |  | true |
| SPEC-005-01 | buc | 0.76 |  | true |
| SPEC-005-01 | condition | 0.56 |  | false |
| SPEC-005-01 | variation | 0.61 |  | false |
| SPEC-005-01 | external_system | 0.23 |  | false |
| SPEC-005-02 | actor | 0.23 |  | false |
| SPEC-005-02 | information | 0.6 |  | true |
| SPEC-005-02 | state | 0.36 |  | false |
| SPEC-005-02 | buc | 0.76 |  | true |
| SPEC-005-02 | condition | 0.72 |  | false |
| SPEC-005-02 | variation | 0.45 |  | false |
| SPEC-005-02 | business_policy | 0.27 |  | false |
| SPEC-005-03 | actor | 0.26 |  | false |
| SPEC-005-03 | information | 0.57 |  | true |
| SPEC-005-03 | state | 0.38 |  | false |
| SPEC-005-03 | buc | 0.79 |  | false |
| SPEC-005-03 | condition | 0.63 |  | false |
| SPEC-005-03 | variation | 0.48 |  | true |
| SPEC-005-03 | external_system | 0.24 |  | false |
| SPEC-005-03 | business_policy | 0.35 |  | false |
| SPEC-006-01 | state | 0.41 |  | false |
| SPEC-006-01 | buc | 0.6 |  | false |
| SPEC-006-01 | condition | 0.4 |  | false |
| SPEC-006-01 | business_policy | 0.24 |  | false |
| SPEC-007-01 | actor | 0.32 |  | false |
| SPEC-007-01 | information | 0.66 |  | false |
| SPEC-007-01 | state | 0.72 |  | false |
| SPEC-007-01 | buc | 0.72 |  | true |
| SPEC-007-01 | variation | 0.46 |  | false |
| SPEC-007-01 | business_policy | 0.31 |  | false |
| SPEC-007-02 | information | 0.49 |  | false |
| SPEC-007-02 | state | 0.25 |  | false |
| SPEC-007-02 | buc | 0.63 |  | false |
| SPEC-007-02 | variation | 0.49 |  | false |
| SPEC-007-02 | external_system | 0.25 |  | false |
| SPEC-007-02 | business_policy | 0.56 |  | false |
| SPEC-007-03 | information | 0.53 |  | false |
| SPEC-007-03 | state | 0.22 |  | false |
| SPEC-007-03 | buc | 0.5 |  | false |
| SPEC-007-03 | variation | 0.49 |  | false |
| SPEC-007-03 | external_system | 0.22 |  | false |
| SPEC-007-03 | business_policy | 0.55 |  | false |

## experiments/jev/results/library-model-types-ja.json

- judge: model-types
- lang: ja
- model: jev-1.13.0
- requests: 19
- input tokens (合計): 27778
- 所要時間（median latencyMs）: 239

### 判定結果

- 件数（送った質問の総数）: 152
- 欠落した回答の件数: 0
- 保留率（欠落を含む）: 0.72
- 一致率（確信帯の項目のうち）: 0.88

#### 食い違い・保留の一覧

| spec | 種別 | 確率 | 欠落 | 正解の候補 |
|---|---|---|---|---|
| SPEC-001-01 | actor | 0.46 |  | true |
| SPEC-001-01 | information | 0.74 |  | true |
| SPEC-001-01 | state | 0.58 |  | false |
| SPEC-001-01 | buc | 0.72 |  | true |
| SPEC-001-01 | condition | 0.59 |  | false |
| SPEC-001-01 | variation | 0.42 |  | false |
| SPEC-001-02 | actor | 0.35 |  | false |
| SPEC-001-02 | information | 0.67 |  | true |
| SPEC-001-02 | state | 0.65 |  | false |
| SPEC-001-02 | buc | 0.7 |  | true |
| SPEC-001-02 | condition | 0.63 |  | false |
| SPEC-001-02 | variation | 0.35 |  | false |
| SPEC-001-03 | actor | 0.36 |  | true |
| SPEC-001-03 | information | 0.7 |  | false |
| SPEC-001-03 | state | 0.34 |  | false |
| SPEC-001-03 | buc | 0.69 |  | true |
| SPEC-001-03 | condition | 0.68 |  | false |
| SPEC-001-03 | variation | 0.51 |  | true |
| SPEC-002-01 | actor | 0.51 |  | false |
| SPEC-002-01 | buc | 0.75 |  | true |
| SPEC-002-01 | condition | 0.85 |  | false |
| SPEC-002-01 | variation | 0.56 |  | false |
| SPEC-002-02 | actor | 0.43 |  | false |
| SPEC-002-02 | buc | 0.75 |  | true |
| SPEC-002-02 | condition | 0.83 |  | false |
| SPEC-002-02 | variation | 0.66 |  | false |
| SPEC-002-02 | external_system | 0.21 |  | false |
| SPEC-002-02 | business_policy | 0.23 |  | false |
| SPEC-002-03 | actor | 0.51 |  | false |
| SPEC-002-03 | buc | 0.76 |  | true |
| SPEC-002-03 | variation | 0.59 |  | false |
| SPEC-002-03 | business_policy | 0.43 |  | false |
| SPEC-002-04 | actor | 0.74 |  | false |
| SPEC-002-04 | information | 0.77 |  | true |
| SPEC-002-04 | state | 0.84 |  | false |
| SPEC-002-04 | buc | 0.77 |  | true |
| SPEC-002-04 | condition | 0.81 |  | false |
| SPEC-002-04 | variation | 0.48 |  | false |
| SPEC-002-04 | external_system | 0.74 |  | true |
| SPEC-002-04 | business_policy | 0.34 |  | false |
| SPEC-003-01 | actor | 0.44 |  | false |
| SPEC-003-01 | information | 0.65 |  | true |
| SPEC-003-01 | state | 0.6 |  | false |
| SPEC-003-01 | buc | 0.68 |  | true |
| SPEC-003-01 | condition | 0.81 |  | false |
| SPEC-003-01 | variation | 0.3 |  | false |
| SPEC-003-01 | business_policy | 0.46 |  | true |
| SPEC-003-02 | actor | 0.71 |  | true |
| SPEC-003-02 | information | 0.47 |  | false |
| SPEC-003-02 | state | 0.57 |  | false |
| SPEC-003-02 | buc | 0.75 |  | true |
| SPEC-003-02 | condition | 0.78 |  | true |
| SPEC-003-02 | variation | 0.4 |  | false |
| SPEC-003-02 | external_system | 0.67 |  | true |
| SPEC-003-02 | business_policy | 0.77 |  | false |
| SPEC-003-03 | actor | 0.77 |  | false |
| SPEC-003-03 | buc | 0.77 |  | true |
| SPEC-003-03 | variation | 0.64 |  | false |
| SPEC-003-03 | external_system | 0.64 |  | false |
| SPEC-003-03 | business_policy | 0.57 |  | false |
| SPEC-004-01 | actor | 0.34 |  | false |
| SPEC-004-01 | information | 0.7 |  | true |
| SPEC-004-01 | state | 0.5 |  | false |
| SPEC-004-01 | buc | 0.71 |  | true |
| SPEC-004-01 | condition | 0.69 |  | false |
| SPEC-004-01 | variation | 0.49 |  | false |
| SPEC-004-01 | external_system | 0.34 |  | false |
| SPEC-004-02 | actor | 0.32 |  | false |
| SPEC-004-02 | information | 0.74 |  | true |
| SPEC-004-02 | state | 0.64 |  | false |
| SPEC-004-02 | buc | 0.72 |  | true |
| SPEC-004-02 | condition | 0.62 |  | false |
| SPEC-004-02 | variation | 0.45 |  | false |
| SPEC-004-02 | external_system | 0.29 |  | false |
| SPEC-005-01 | actor | 0.3 |  | false |
| SPEC-005-01 | information | 0.68 |  | false |
| SPEC-005-01 | state | 0.65 |  | true |
| SPEC-005-01 | buc | 0.61 |  | true |
| SPEC-005-01 | condition | 0.66 |  | false |
| SPEC-005-01 | variation | 0.53 |  | false |
| SPEC-005-02 | actor | 0.29 |  | false |
| SPEC-005-02 | information | 0.54 |  | true |
| SPEC-005-02 | state | 0.22 |  | false |
| SPEC-005-02 | buc | 0.66 |  | true |
| SPEC-005-02 | condition | 0.75 |  | false |
| SPEC-005-02 | variation | 0.42 |  | false |
| SPEC-005-02 | business_policy | 0.23 |  | false |
| SPEC-005-03 | actor | 0.33 |  | false |
| SPEC-005-03 | information | 0.57 |  | true |
| SPEC-005-03 | state | 0.27 |  | false |
| SPEC-005-03 | buc | 0.68 |  | false |
| SPEC-005-03 | condition | 0.77 |  | false |
| SPEC-005-03 | variation | 0.57 |  | true |
| SPEC-005-03 | business_policy | 0.29 |  | false |
| SPEC-006-01 | state | 0.41 |  | false |
| SPEC-006-01 | buc | 0.52 |  | false |
| SPEC-006-01 | condition | 0.67 |  | false |
| SPEC-006-01 | business_policy | 0.32 |  | false |
| SPEC-007-01 | actor | 0.34 |  | false |
| SPEC-007-01 | information | 0.69 |  | false |
| SPEC-007-01 | state | 0.79 |  | false |
| SPEC-007-01 | buc | 0.66 |  | true |
| SPEC-007-01 | variation | 0.52 |  | false |
| SPEC-007-01 | business_policy | 0.41 |  | false |
| SPEC-007-02 | information | 0.43 |  | false |
| SPEC-007-02 | buc | 0.5 |  | false |
| SPEC-007-02 | variation | 0.47 |  | false |
| SPEC-007-02 | external_system | 0.25 |  | false |
| SPEC-007-02 | business_policy | 0.41 |  | false |
| SPEC-007-03 | information | 0.48 |  | false |
| SPEC-007-03 | state | 0.21 |  | false |
| SPEC-007-03 | buc | 0.35 |  | false |
| SPEC-007-03 | condition | 0.76 |  | true |
| SPEC-007-03 | variation | 0.4 |  | false |
| SPEC-007-03 | business_policy | 0.48 |  | false |

## experiments/jev/results/equipment-model-types-en.json

- judge: model-types
- lang: en
- model: jev-1.13.0
- requests: 7
- input tokens (合計): 7911
- 所要時間（median latencyMs）: 242

### 判定結果

- 件数（送った質問の総数）: 56
- 欠落した回答の件数: 0
- 保留率（欠落を含む）: 0.71
- 一致率（確信帯の項目のうち）: 0.94

#### 食い違い・保留の一覧

| spec | 種別 | 確率 | 欠落 | 正解の候補 |
|---|---|---|---|---|
| SPEC-001-01 | actor | 0.28 |  | true |
| SPEC-001-01 | state | 0.72 |  | false |
| SPEC-001-01 | condition | 0.71 |  | false |
| SPEC-001-01 | variation | 0.55 |  | true |
| SPEC-001-01 | external_system | 0.39 |  | true |
| SPEC-001-01 | business_policy | 0.21 |  | false |
| SPEC-001-02 | actor | 0.24 |  | false |
| SPEC-001-02 | variation | 0.43 |  | false |
| SPEC-001-02 | business_policy | 0.34 |  | false |
| SPEC-001-03 | actor | 0.23 |  | false |
| SPEC-001-03 | information | 0.76 |  | false |
| SPEC-001-03 | state | 0.68 |  | false |
| SPEC-001-03 | buc | 0.74 |  | false |
| SPEC-001-03 | variation | 0.46 |  | false |
| SPEC-002-01 | actor | 0.25 |  | true |
| SPEC-002-01 | information | 0.76 |  | true |
| SPEC-002-01 | buc | 0.77 |  | true |
| SPEC-002-01 | condition | 0.69 |  | false |
| SPEC-002-01 | variation | 0.5 |  | false |
| SPEC-002-01 | external_system | 0.24 |  | false |
| SPEC-002-01 | business_policy | 0.39 |  | false |
| SPEC-002-02 | actor | 0.26 |  | false |
| SPEC-002-02 | buc | 0.79 |  | true |
| SPEC-002-02 | condition | 0.72 |  | false |
| SPEC-002-02 | variation | 0.65 |  | false |
| SPEC-002-02 | external_system | 0.21 |  | false |
| SPEC-002-02 | business_policy | 0.23 |  | false |
| SPEC-003-01 | actor | 0.51 |  | false |
| SPEC-003-01 | information | 0.78 |  | false |
| SPEC-003-01 | buc | 0.78 |  | true |
| SPEC-003-01 | variation | 0.65 |  | false |
| SPEC-003-01 | external_system | 0.27 |  | false |
| SPEC-003-01 | business_policy | 0.64 |  | false |
| SPEC-003-02 | actor | 0.66 |  | false |
| SPEC-003-02 | information | 0.52 |  | false |
| SPEC-003-02 | state | 0.63 |  | false |
| SPEC-003-02 | buc | 0.79 |  | true |
| SPEC-003-02 | condition | 0.8 |  | false |
| SPEC-003-02 | variation | 0.43 |  | false |
| SPEC-003-02 | external_system | 0.66 |  | true |
| SPEC-003-02 | business_policy | 0.34 |  | false |

## experiments/jev/results/equipment-model-types-ja.json

- judge: model-types
- lang: ja
- model: jev-1.13.0
- requests: 7
- input tokens (合計): 10704
- 所要時間（median latencyMs）: 222

### 判定結果

- 件数（送った質問の総数）: 56
- 欠落した回答の件数: 0
- 保留率（欠落を含む）: 0.71
- 一致率（確信帯の項目のうち）: 0.88

#### 食い違い・保留の一覧

| spec | 種別 | 確率 | 欠落 | 正解の候補 |
|---|---|---|---|---|
| SPEC-001-01 | actor | 0.45 |  | true |
| SPEC-001-01 | state | 0.62 |  | false |
| SPEC-001-01 | buc | 0.69 |  | true |
| SPEC-001-01 | condition | 0.77 |  | false |
| SPEC-001-01 | variation | 0.55 |  | true |
| SPEC-001-01 | external_system | 0.52 |  | true |
| SPEC-001-01 | business_policy | 0.25 |  | false |
| SPEC-001-02 | actor | 0.42 |  | false |
| SPEC-001-02 | state | 0.74 |  | true |
| SPEC-001-02 | buc | 0.71 |  | true |
| SPEC-001-02 | variation | 0.38 |  | false |
| SPEC-001-02 | business_policy | 0.34 |  | false |
| SPEC-001-03 | actor | 0.27 |  | false |
| SPEC-001-03 | information | 0.72 |  | false |
| SPEC-001-03 | state | 0.53 |  | false |
| SPEC-001-03 | buc | 0.67 |  | false |
| SPEC-001-03 | variation | 0.38 |  | false |
| SPEC-002-01 | actor | 0.54 |  | true |
| SPEC-002-01 | buc | 0.76 |  | true |
| SPEC-002-01 | condition | 0.8 |  | false |
| SPEC-002-01 | variation | 0.52 |  | false |
| SPEC-002-01 | external_system | 0.21 |  | false |
| SPEC-002-01 | business_policy | 0.28 |  | false |
| SPEC-002-02 | actor | 0.51 |  | false |
| SPEC-002-02 | buc | 0.75 |  | true |
| SPEC-002-02 | condition | 0.79 |  | false |
| SPEC-002-02 | variation | 0.57 |  | false |
| SPEC-002-02 | business_policy | 0.38 |  | false |
| SPEC-003-01 | actor | 0.73 |  | false |
| SPEC-003-01 | information | 0.82 |  | false |
| SPEC-003-01 | buc | 0.7 |  | true |
| SPEC-003-01 | condition | 0.77 |  | true |
| SPEC-003-01 | variation | 0.65 |  | false |
| SPEC-003-01 | external_system | 0.35 |  | false |
| SPEC-003-01 | business_policy | 0.56 |  | false |
| SPEC-003-02 | actor | 0.7 |  | false |
| SPEC-003-02 | information | 0.45 |  | false |
| SPEC-003-02 | state | 0.54 |  | false |
| SPEC-003-02 | buc | 0.7 |  | true |
| SPEC-003-02 | condition | 0.71 |  | false |
| SPEC-003-02 | variation | 0.41 |  | false |
| SPEC-003-02 | business_policy | 0.39 |  | false |


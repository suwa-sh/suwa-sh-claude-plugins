# Step3: コンポーネント仕様生成 (design-event.yaml の components/screens/states セクション)

## 生成対象

### UI 共通コンポーネント (必ず生成)

| コンポーネント | 用途 |
|---------------|------|
| Button | 全アクション (variant: default/secondary/outline/ghost/destructive, size: sm/md/lg) |
| Badge | ステータス表示 (variant: default/success/warning/destructive/info/virtual/outline) |
| Card | コンテンツコンテナ (hoverable オプション) |
| Input | フォーム入力 (label, error state) |

### ドメイン特化コンポーネント (RDRA から導出)

RDRA モデルの分析結果に基づいて、以下のパターンでコンポーネントを導出:

| RDRA パターン | コンポーネント候補 |
|--------------|-------------------|
| 画面に「検索」を含む | SearchFilter |
| 画面に「一覧」を含む + 情報に画像属性 | ImageCard (RoomCard 等) |
| 状態モデルが存在 | StatusBadge ({Entity}StatusBadge) |
| 状態モデルの状態数 >= 3 + 順序性あり | StepTracker ({Entity}Tracker) |
| 情報に評価/スコア属性 | StarRating |
| 情報に金額属性 | PriceDisplay |
| 画面に「問合せ」を含む | InquiryThread / MessageThread |
| 画面に「カレンダー」or 日時選択 | BookingCalendar / DatePicker |
| 情報に精算/売上属性 | SummaryCard ({Entity}SummaryCard) |
| アクターに審査/認証フロー | VerificationBadge |

## component-specs.md の構造

各コンポーネントに以下を定義:

```markdown
## {ComponentName}

{用途の説明}

### Anatomy
(ASCII art でコンポーネントの構造を示す)

### Props
| Prop | Type | Description |

### Variants
| Variant | Style | Description |

### States
| State | Visual Change | Cursor |
```

## screen-mapping.md の構造

```markdown
## {ポータル名} ({N}画面)

| RDRA画面名 | ルート | 主要コンポーネント |
```

- ルートは REST 風のパス設計
- 主要コンポーネントは UI + Domain から該当するものを列挙

## state-mapping.md の構造

```markdown
## {状態モデル名}

| RDRA状態 | Badge Label | Color Token | アクション |
```

- Color Token は semantic token 名 (amber, green, blue, gray, red)
- アクションは各アクターが該当状態で実行可能な操作

## 実装ルール

- コンポーネント内で **ハードコードカラーを使わない** → 必ずトークン参照
  - NG: `text-white`, `bg-gray-200`
  - OK: `text-[var(--color-white)]`, `bg-[var(--hover-muted,var(--color-gray-200))]`
- status 系の背景色は semantic token (`--success-light`, `--warning-light` 等) を使う
  - NG: `bg-[var(--color-green-50)]`
  - OK: `bg-[var(--success-light)]`
- hover 色は `--hover-muted` トークン + fallback パターンを使う

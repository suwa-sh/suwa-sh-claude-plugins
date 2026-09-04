import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginatedListFrame } from '@/components/common/PaginatedListFrame'
import { StatCardGroup, type StatCardGroupItem } from '@/components/common/StatCardGroup'
import { ToggleGroup } from '@/components/ui/ToggleGroup'
import { BookTable } from '@/components/domain/BookTable'
import { sampleBooks } from '@/components/domain/sampleData'

type StatusFilter = 'ALL' | 'AVAILABLE' | 'ON_LOAN' | 'RESERVED'

interface InventoryPageProps {
  loading?: boolean
}

/** 在庫状況一覧画面（/staff/reports/inventory）。StatCardGroup + ToggleGroup + BookTable(inventory) + Pagination。 */
const InventoryPage: React.FC<InventoryPageProps> = ({ loading = false }) => {
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const available = sampleBooks.filter((b) => b.state === '在庫あり').length
  const onLoan = sampleBooks.filter((b) => b.state === '貸出中').length
  const reserved = sampleBooks.filter((b) => b.state === '予約待ち').length
  const stats: StatCardGroupItem[] = [
    { key: 'AVAILABLE', label: '在庫あり', value: loading ? null : available, unit: '冊', icon: 'book' },
    { key: 'ON_LOAN', label: '貸出中', value: loading ? null : onLoan, unit: '冊', icon: 'book-open' },
    { key: 'RESERVED', label: '予約待ち', value: loading ? null : reserved, unit: '冊', icon: 'bookmark' },
  ]
  const books = sampleBooks.filter((b) => {
    if (status === 'ALL') return true
    if (status === 'AVAILABLE') return b.state === '在庫あり'
    if (status === 'ON_LOAN') return b.state === '貸出中'
    return b.state === '予約待ち'
  })
  return (
    <StaffLayout activeGroup="reports" activeItem="inventory" userName="佐藤 花子">
      <PageHeader title="在庫状況一覧" />
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <StatCardGroup items={stats} loading={loading} activeKey={status === 'ALL' ? undefined : status} onSelect={(k) => setStatus(k as StatusFilter)} />
        <PaginatedListFrame
          filter={
            <ToggleGroup<StatusFilter>
              label="状態絞り込み"
              options={[
                { value: 'ALL', label: 'すべて' },
                { value: 'AVAILABLE', label: '在庫あり' },
                { value: 'ON_LOAN', label: '貸出中' },
                { value: 'RESERVED', label: '予約待ち' },
              ]}
              value={status}
              onChange={setStatus}
            />
          }
          page={1}
          totalCount={books.length}
          onPageChange={() => {}}
          loading={loading}
          error={null}
          empty={!loading && books.length === 0}
          emptyState={{ title: '条件に一致する書籍はありません' }}
          skeleton={{ variant: 'table' }}
        >
          <BookTable books={books} variant="inventory" />
        </PaginatedListFrame>
      </div>
    </StaffLayout>
  )
}

const meta: Meta<typeof InventoryPage> = {
  title: 'Pages/司書ポータル/在庫状況一覧画面',
  component: InventoryPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof InventoryPage>

export const Default: Story = {
  render: () => <InventoryPage />,
}

export const Loading: Story = {
  render: () => <InventoryPage loading />,
}

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { EntityFormPage } from '@/components/common/EntityFormPage'
import { BookForm } from '@/components/domain/Forms'
import { sampleBooks } from '@/components/domain/sampleData'

const meta: Meta<typeof EntityFormPage> = {
  title: 'Common/EntityFormPage',
  component: EntityFormPage,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof EntityFormPage>

export const Create: Story = {
  render: () => (
    <EntityFormPage mode="create" title="書籍を登録" submitting={false} onCancel={() => {}}>
      {({ fieldErrors }) => <BookForm mode="create" errors={fieldErrors} onSubmit={() => {}} onCancel={() => {}} />}
    </EntityFormPage>
  ),
}

export const EditWithConflict: Story = {
  render: () => (
    <EntityFormPage mode="edit" title="書籍を編集" submitting={false} submitError={{ kind: 'conflict', message: '他の司書が更新しました' }} onReload={() => {}} onCancel={() => {}}>
      {({ fieldErrors }) => <BookForm mode="edit" initial={sampleBooks[0]} errors={fieldErrors} onSubmit={() => {}} onCancel={() => {}} />}
    </EntityFormPage>
  ),
}

export const LoadingInitial: Story = {
  render: () => (
    <EntityFormPage mode="edit" title="書籍を編集" loading submitting={false} onCancel={() => {}}>
      {() => null}
    </EntityFormPage>
  ),
}

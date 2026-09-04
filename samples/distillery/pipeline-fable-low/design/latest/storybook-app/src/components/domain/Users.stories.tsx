import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { UserForm } from './Forms'
import { UserTable } from './UserTable'
import { sampleUsers } from './sampleData'

const meta: Meta = {
  title: 'Domain/Users',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Table: Story = { render: () => <UserTable users={sampleUsers} onEdit={() => undefined} onDelete={() => undefined} onOpenStatus={() => undefined} /> }
export const TableEmpty: Story = { render: () => <UserTable users={[]} /> }
export const FormCreate: Story = { render: () => <div style={{ maxWidth: 720 }}><UserForm mode="create" /></div> }
export const FormEdit: Story = { render: () => <div style={{ maxWidth: 720 }}><UserForm mode="edit" userNumber={sampleUsers[0].number} initial={sampleUsers[0]} /></div> }
export const FormValidationError: Story = {
  render: () => (
    <div style={{ maxWidth: 720 }}>
      <UserForm mode="create" initial={{ name: '山田 花子', email: 'hanako' }} errors={{ email: 'メールアドレスの形式が正しくありません' }} />
    </div>
  ),
}

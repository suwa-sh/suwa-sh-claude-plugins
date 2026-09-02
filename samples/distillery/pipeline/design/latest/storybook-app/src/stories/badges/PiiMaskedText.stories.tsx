import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PiiMaskedText } from '@/components/common/PiiMaskedText'

const meta: Meta<typeof PiiMaskedText> = {
  title: 'Common/PiiMaskedText',
  component: PiiMaskedText,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '連絡先など個人情報の既定マスクと明示操作による開示を 1 箇所に集約する（pii トークン + Button(ghost) の合成、NFR E.1.2.1 / arch SR-006）。開示状態は画面遷移で破棄する。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof PiiMaskedText>

export const EmailMasked: Story = {
  args: { value: 'hanako.yamada@example.jp', kind: 'email', revealable: true },
}

export const PhoneMasked: Story = {
  args: { value: '090-1234-5678', kind: 'phone', revealable: true },
}

export const AddressNotRevealable: Story = {
  args: { value: '東京都千代田区1-1-1', kind: 'address', revealable: false },
}

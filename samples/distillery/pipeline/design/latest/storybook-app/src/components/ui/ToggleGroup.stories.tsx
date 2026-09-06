import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ToggleGroup } from './ToggleGroup'

const meta: Meta = {
  title: 'UI/ToggleGroup',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

const kinds = ['キーワード', 'タイトル', '著者', 'ISBN', 'ジャンル'].map((k) => ({ value: k, label: k }))
const genres = ['文学', '社会科学', '自然科学', '技術', '芸術', '歴史', '児童書', 'その他'].map((g) => ({ value: g, label: g }))

export const Single: Story = {
  render: function Render() {
    const [v, setV] = useState('キーワード')
    return <ToggleGroup label="検索条件種別" options={kinds} value={v} onChange={setV} />
  },
}
export const Multi: Story = {
  render: function Render() {
    const [v, setV] = useState<string[]>(['文学', '技術'])
    return <ToggleGroup label="ジャンル" mode="multi" size="sm" options={genres} value={v} onChange={setV} />
  },
}

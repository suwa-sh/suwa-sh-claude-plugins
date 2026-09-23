import React from 'react';

export interface BookCardProps {
  title?: string;
}

export const BookCard: React.FC<BookCardProps> = ({ title }) => (
  <div style={{ padding: 'var(--card-padding)' }}>{title}</div>
);

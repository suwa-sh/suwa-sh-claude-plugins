import React from 'react';

export interface ButtonProps {
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children }) => (
  <button style={{ color: 'var(--color-white)' }}>{children}</button>
);

// distillery2 genSkeleton.js が置いた画面の描画の入口。手で変えてよい (再実行で上書きしない)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root が無い (index.html を確かめる)');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

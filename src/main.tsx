import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 创建根节点并渲染应用
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// 移除StrictMode以优化性能和减少点击延迟
root.render(
  <App />
);

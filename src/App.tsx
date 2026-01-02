import React from 'react';
import AppRouter from './routes/AppRouter';

// 主应用组件 - 现在只负责渲染路由系统
const App: React.FC = () => {
  return (
    <AppRouter />
  );
};

export default App;
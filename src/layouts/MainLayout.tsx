import React, {type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();

  // 定义导航项
  const navItems = [
    { path: '/', label: '欢迎', exact: true },
    { path: '/projects', label: '项目管理' },
    { path: '/login', label: '登录' },
    { path: '/register', label: '注册' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航栏 */}
      <header style={{
        backgroundColor: '#2c3e50',
        padding: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            color: 'white',
            marginRight: '24px'
          }}>
            Troads
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  color: location.pathname === item.path || 
                         (item.exact && location.pathname === item.path) 
                         ? '#3498db' : 'white',
                  textDecoration: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  backgroundColor: location.pathname === item.path || 
                                  (item.exact && location.pathname === item.path)
                                  ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* 主内容区域 */}
      <main style={{ flex: 1, overflow: 'auto', backgroundColor: '#ecf0f1' }}>
        {children}
      </main>

      {/* 底部 */}
      <footer style={{
        backgroundColor: '#34495e',
        color: 'white',
        padding: '16px',
        textAlign: 'center',
        fontSize: '12px'
      }}>
        © 2026 Troads - 可视化对话流程编辑器
      </footer>
    </div>
  );
};

export default MainLayout;
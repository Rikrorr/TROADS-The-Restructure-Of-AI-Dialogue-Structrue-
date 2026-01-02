import React, { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarLayoutProps {
  children: ReactNode;
}

const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const location = useLocation();

  // 定义导航项
  const navItems = [
    { path: '/', label: '欢迎', exact: true },
    { path: '/projects', label: '项目管理' },
    { path: '/login', label: '登录' },
    { path: '/register', label: '注册' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'row' }}>
      {/* 左侧边栏 */}
      <aside style={{
        width: '220px',
        backgroundColor: '#2c3e50',
        padding: '16px 0',
        boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          color: 'white',
          textAlign: 'center',
          marginBottom: '24px',
          padding: '0 16px'
        }}>
          Troads
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                color: location.pathname === item.path || 
                       (item.exact && location.pathname === item.path) 
                       ? '#3498db' : 'rgba(255,255,255,0.7)',
                textDecoration: 'none',
                padding: '12px 24px',
                margin: '4px 8px',
                borderRadius: '4px',
                backgroundColor: location.pathname === item.path || 
                                (item.exact && location.pathname === item.path)
                                ? 'rgba(255,255,255,0.1)' : 'transparent',
                transition: 'all 0.2s ease'
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </aside>

      {/* 主内容区域 */}
      <main style={{ flex: 1, overflow: 'auto', backgroundColor: '#ecf0f1', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
};

export default SidebarLayout;
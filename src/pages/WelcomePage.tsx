import React from 'react';
import { Link } from 'react-router-dom';

const WelcomePage: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '20px',
      textAlign: 'center',
      backgroundColor: '#f8f9fa'
    }}>
      <h1 style={{
        fontSize: '2.5rem',
        color: '#2c3e50',
        marginBottom: '20px'
      }}>
        欢迎使用 Troads
      </h1>
      
      <p style={{
        fontSize: '1.2rem',
        color: '#7f8c8d',
        maxWidth: '600px',
        lineHeight: '1.6',
        marginBottom: '40px'
      }}>
        一个强大的可视化对话流程编辑器，帮助您轻松创建和管理对话流程。
        通过直观的拖拽界面，您可以快速构建复杂的对话系统。
      </p>
      
      <div style={{
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: '20px'
      }}>
        <Link
          to="/projects"
          style={{
            backgroundColor: '#3498db',
            color: 'white',
            padding: '12px 24px',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'background-color 0.3s'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#2980b9';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#3498db';
          }}
        >
          开始使用
        </Link>
        
        <Link
          to="/login"
          style={{
            backgroundColor: '#2ecc71',
            color: 'white',
            padding: '12px 24px',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'background-color 0.3s'
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#27ae60';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#2ecc71';
          }}
        >
          登录
        </Link>
      </div>
      
      <div style={{
        marginTop: '60px',
        display: 'flex',
        gap: '40px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '800px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          minWidth: '200px'
        }}>
          <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>可视化编辑</h3>
          <p style={{ color: '#7f8c8d', margin: 0 }}>
            直观的拖拽界面，轻松创建对话流程
          </p>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          minWidth: '200px'
        }}>
          <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>实时协作</h3>
          <p style={{ color: '#7f8c8d', margin: 0 }}>
            多人同时编辑，实时同步更新
          </p>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          minWidth: '200px'
        }}>
          <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>智能分析</h3>
          <p style={{ color: '#7f8c8d', margin: 0 }}>
            深度分析对话数据，优化用户体验
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
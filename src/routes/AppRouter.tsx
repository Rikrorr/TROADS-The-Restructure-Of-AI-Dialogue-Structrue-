import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import SidebarLayout from '../layouts/SidebarLayout';
import WelcomePage from '../pages/WelcomePage';
import AuthPage from '../pages/AuthPage';
import ProjectDashboard from '../pages/ProjectDashboard';
import CanvasEditor from '../pages/CanvasEditor';

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <SidebarLayout>
            <WelcomePage />
          </SidebarLayout>
        } />
        <Route path="/welcome" element={
          <SidebarLayout>
            <WelcomePage />
          </SidebarLayout>
        } />
        <Route path="/login" element={
          <SidebarLayout>
            <AuthPage />
          </SidebarLayout>
        } />
        <Route path="/register" element={
          <SidebarLayout>
            <AuthPage />
          </SidebarLayout>
        } />
        <Route path="/projects" element={
          <SidebarLayout>
            <ProjectDashboard />
          </SidebarLayout>
        } />
        <Route path="/canvas/:projectId" element={
          <CanvasEditor />
        } />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
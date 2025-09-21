import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import WelcomeCard from '../components/WelcomeCard';
import DashboardOptions from '../components/DashboardOptions';
import './Dashboard.css';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Por defecto oculto
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    // Decodificar el token para obtener información del usuario
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser(payload);
    } catch (error) {
      console.error('Error al decodificar token:', error);
      localStorage.removeItem('token');
      navigate('/');
    }

    // Remover estilos del login
    document.body.style.background = 'var(--bg-color)';
    document.body.style.backgroundImage = 'none';
  }, [navigate]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark-mode', !darkMode);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  if (!user) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div className={`dashboard ${darkMode ? 'dark' : ''}`}>
      <Sidebar 
        user={user} 
        isOpen={sidebarOpen}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        onLogout={handleLogout}
        onClose={() => setSidebarOpen(false)}
      />
      
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      
      <div className="main-content">
        <div className="top-bar">
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            <i className="fas fa-bars"></i>
          </button>
          <h1>AsisControlGo</h1>
        </div>
        
        <main className="content">
          <div className="container">
            <WelcomeCard user={user} />
            <DashboardOptions user={user} />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Dashboard;
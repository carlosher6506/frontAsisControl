import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleAsistencias = () => {
    // Redirigir a la página de asistencias según el rol
    if (user.role === 'student') {
      navigate('/attendance/students');
    } else {
      navigate('/attendance');
    }
  };

  const handleUsuarios = () => {
    // Solo admin y super_admin pueden ver usuarios
    if (user.role === 'admin' || user.role === 'super_admin') {
      navigate('/settings/students');
    }
  };

  return (
    <div className="home-container">
      <div className="welcome-card">
        <h1>Bienvenido(a), {user.fullName}!</h1>
        <p className="bible-verse">"Los planes del diligente ciertamente tienden a la abundancia." — Proverbios 21:5</p>
        
        <div className="action-buttons">
          <button onClick={handleAsistencias} className="action-btn">
            <span className="btn-icon">📋</span>
            <span>Asistencias</span>
          </button>
          
          {(user.role === 'admin' || user.role === 'super_admin') && (
            <button onClick={handleUsuarios} className="action-btn">
              <span className="btn-icon">👥</span>
              <span>Usuarios</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
import React, { useState } from 'react';
import './Header.css';

const Header = ({ user, darkMode, toggleDarkMode, onLogout }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-title">
          <h1>AsisControlGo</h1>
        </div>
        
        <div className="header-actions">
          <button 
            className="theme-toggle"
            onClick={toggleDarkMode}
            title={darkMode ? 'Modo Claro' : 'Modo Oscuro'}
          >
            <i className={darkMode ? 'fas fa-sun' : 'fas fa-moon'}></i>
          </button>
          
          <div className="user-menu">
            <button 
              className="user-menu-trigger"
              onClick={toggleUserMenu}
            >
              <span className="user-name">{user.fullName}</span>
              <i className={`fas fa-chevron-down ${showUserMenu ? 'rotate' : ''}`}></i>
            </button>
            
            {showUserMenu && (
              <div className="user-dropdown">
                <a href="/perfil" className="dropdown-item">
                  <i className="fas fa-user"></i>
                  Mi Perfil
                </a>
                <button 
                  className="dropdown-item logout-btn"
                  onClick={onLogout}
                >
                  <i className="fas fa-sign-out-alt"></i>
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
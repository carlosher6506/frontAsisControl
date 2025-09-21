import './Sidebar.css';
import React, { useState } from 'react';

const Sidebar = ({ user, isOpen, darkMode, toggleDarkMode, onLogout }) => {
  const [activeMenu, setActiveMenu] = useState('');

  const getMenuItems = (role) => {
    const systemItems = [
      {
        id: 'configuracion-sistema',
        label: 'Configuración del Sistema',
        icon: 'fas fa-cog',
        submenu: [
          { 
            label: darkMode ? 'Modo Claro' : 'Modo Oscuro', 
            action: toggleDarkMode,
            icon: darkMode ? 'fas fa-sun' : 'fas fa-moon'
          }
        ]
      },
      {
        id: 'mi-perfil',
        label: 'Mi Perfil',
        icon: 'fas fa-user',
        submenu: [
          { label: 'Ver Perfil', path: '/perfil', icon: 'fas fa-eye' },
          { 
            label: 'Cerrar Sesión', 
            action: onLogout,
            icon: 'fas fa-sign-out-alt',
            className: 'logout-item'
          }
        ]
      }
    ];

    switch (role) {
      case 'super_admin':
      case 'admin':
        return [
          {
            id: 'asistencia',
            label: 'Asistencia',
            icon: 'fas fa-calendar-check',
            submenu: [
              { label: 'Docente', path: '/asistencia/docente' },
              { label: 'Alumnos', path: '/asistencia/alumnos' },
              { label: 'Grupos', path: '/asistencia/grupos' }
            ]
          },
          {
            id: 'biblioteca',
            label: 'Biblioteca',
            icon: 'fas fa-book',
            submenu: [
              { label: 'Reservar', path: '/biblioteca/reservar' },
              { label: 'Mis Reservas', path: '/biblioteca/mis-reservas' }
            ]
          },
          {
            id: 'configuracion',
            label: 'Configuración',
            icon: 'fas fa-cogs',
            submenu: role === 'super_admin' ? [
              { label: 'Docentes', path: '/configuracion/docentes' },
              { label: 'Alumnos', path: '/configuracion/alumnos' },
              { label: 'Grupos', path: '/configuracion/grupos' },
              { label: 'Asistencias', path: '/configuracion/asistencias' }
            ] : [
              { label: 'Alumnos', path: '/configuracion/alumnos' },
              { label: 'Grupos', path: '/configuracion/grupos' },
              { label: 'Asistencias', path: '/configuracion/asistencias' }
            ]
          },
          {
            id: 'calificaciones',
            label: 'Calificaciones',
            icon: 'fas fa-star',
            submenu: [
              { label: 'Asignar', path: '/calificaciones/asignar' },
              { label: 'Ver', path: '/calificaciones/ver' }
            ]
          },
          ...systemItems
        ];

      case 'teacher':
        return [
          {
            id: 'asistencia',
            label: 'Asistencia',
            icon: 'fas fa-calendar-check',
            submenu: [
              { label: 'Docente', path: '/asistencia/docente' },
              { label: 'Grupos', path: '/asistencia/grupos' }
            ]
          },
          {
            id: 'biblioteca',
            label: 'Biblioteca',
            icon: 'fas fa-book',
            submenu: [
              { label: 'Mis Reservas', path: '/biblioteca/mis-reservas' }
            ]
          },
          {
            id: 'calificaciones',
            label: 'Calificaciones',
            icon: 'fas fa-star',
            submenu: [
              { label: 'Asignar', path: '/calificaciones/asignar' },
              { label: 'Ver', path: '/calificaciones/ver' }
            ]
          },
          ...systemItems
        ];

      case 'student':
        return [
          {
            id: 'asistencia',
            label: 'Asistencia',
            icon: 'fas fa-calendar-check',
            submenu: [
              { label: 'Alumnos', path: '/asistencia/alumnos' }
            ]
          },
          {
            id: 'calificaciones',
            label: 'Calificaciones',
            icon: 'fas fa-star',
            submenu: [
              { label: 'Ver', path: '/calificaciones/ver' }
            ]
          },
          ...systemItems
        ];

      default:
        return systemItems;
    }
  };

  const menuItems = getMenuItems(user.role);

  const toggleSubmenu = (menuId) => {
    setActiveMenu(activeMenu === menuId ? '' : menuId);
  };

  const handleItemClick = (item) => {
    if (item.action) {
      item.action();
    } else if (item.path) {
      window.location.href = item.path;
    }
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <div className="user-profile">
          <div className="user-avatar">
            <i className="fas fa-user-circle"></i>
          </div>
          <div className="user-info">
            <h4>{user.fullName}</h4>
            <span className="user-role">{user.role.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">
          {menuItems.map((item) => (
            <li key={item.id} className="nav-item">
              {item.submenu ? (
                <>
                  <button 
                    className={`nav-link ${activeMenu === item.id ? 'active' : ''}`}
                    onClick={() => toggleSubmenu(item.id)}
                  >
                    <i className={item.icon}></i>
                    <span>{item.label}</span>
                    <i className={`fas fa-chevron-down chevron ${activeMenu === item.id ? 'rotate' : ''}`}></i>
                  </button>
                  <ul className={`submenu ${activeMenu === item.id ? 'show' : ''}`}>
                    {item.submenu.map((subItem, index) => (
                      <li key={index}>
                        <button 
                          className={`submenu-link ${subItem.className || ''}`}
                          onClick={() => handleItemClick(subItem)}
                        >
                          {subItem.icon && <i className={subItem.icon}></i>}
                          {subItem.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <button 
                  className="nav-link"
                  onClick={() => handleItemClick(item)}
                >
                  <i className={item.icon}></i>
                  <span>{item.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
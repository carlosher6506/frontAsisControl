import React from 'react';
import './DashboardOptions.css';

const DashboardOptions = ({ user }) => {
  const canAccessUsers = ['super_admin', 'admin'].includes(user.role);

  const handleNavigation = (path) => {
    window.location.href = path;
  };

  return (
    <div className="dashboard-options">
      <div className="options-grid">
        <div className="option-card">
          <div className="option-icon">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="option-content">
            <h3>Asistencias</h3>
            <p>Gestiona y consulta las asistencias del sistema</p>
            <button 
              className="option-link"
              onClick={() => handleNavigation('/asistencia')}
            >
              Acceder <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>

        {canAccessUsers && (
          <div className="option-card">
            <div className="option-icon">
              <i className="fas fa-users"></i>
            </div>
            <div className="option-content">
              <h3>Usuarios</h3>
              <p>Administra usuarios, roles y permisos</p>
              <button 
                className="option-link"
                onClick={() => handleNavigation('/configuracion')}
              >
                Acceder <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOptions;
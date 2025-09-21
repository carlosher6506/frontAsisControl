import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <span className="brand-name">AsisControlGo</span>
          <div className="brand-logo">
            {/* Aquí puedes agregar tu logo cuando lo tengas */}
            <i className="fas fa-graduation-cap"></i>
          </div>
        </div>
        
        <div className="footer-author">
          <span>Autor: gohe-dev 2025</span>
          <div className="author-logo">
            {/* Aquí puedes agregar el logo del autor cuando lo tengas */}
            <i className="fas fa-code"></i>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
import React from 'react';
import './WelcomeCard.css';

const WelcomeCard = ({ user }) => {
  return (
    <div className="welcome-card">
      <div className="welcome-content">
        <h2>¡Bienvenido(a), {user.fullName}!</h2>
        <div className="verse">
          <p>"Los planes del diligente ciertamente tienden a la abundancia."</p>
          <cite>— Proverbios 21:5</cite>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCard;
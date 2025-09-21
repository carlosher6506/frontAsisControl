import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Agregar clase para el login
    document.body.classList.add('login-page');
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error')) {
      setMessage(
        urlParams.get('error') === 'invalid'
          ? 'Credenciales inválidas. Intenta de nuevo.'
          : 'Error del servidor. Intenta de nuevo más tarde.'
      );
    }

    // Cleanup: remover clase cuando se desmonta el componente
    return () => {
      document.body.classList.remove('login-page');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        setMessage('Inicio de sesión exitoso!');
        // Remover clase antes de navegar
        document.body.classList.remove('login-page');
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        throw new Error(data.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      setMessage(error.message);
      window.history.pushState({}, '', '?error=invalid');
    }
  };

  return (
    <div className="wrapper">
      <div className="logos">
        <img src="/logo_1.png" alt="Logo 1" className="logo" />
        <img src="/logo_2.png" alt="Logo 2" className="logo" />
      </div>
      <form onSubmit={handleSubmit}>
        <h3>LOGIN</h3>
        <div id="error-message" style={{ color: 'red', marginBottom: '15px', display: message ? 'block' : 'none' }}>
          {message}
        </div>
        <div className="input-box">
          <i className="fas fa-user"></i>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo Electrónico"
            required
          />
        </div>
        <div className="input-box">
          <i className="fas fa-lock"></i>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            required
          />
        </div>
        <button type="submit" className="btn">
          <i className="fas fa-sign-in-alt"></i> Entrar
        </button>
      </form>
    </div>
  );
};

export default Login;
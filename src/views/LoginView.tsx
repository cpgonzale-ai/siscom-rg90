import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { loginApi, setAuthToken } from '../services/api';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token } = await loginApi(email, password);
      setAuthToken(access_token);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#faf9f5',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '360px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e0da',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <ShieldCheck size={22} color="#128752" />
          <h1 style={{ fontSize: '17px', fontWeight: 700, color: '#22262b' }}>SISCOM RG90</h1>
        </div>
        <p style={{ fontSize: '12.5px', color: '#5c6470', marginBottom: '24px' }}>
          Iniciá sesión para continuar
        </p>

        <label style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #e2e0da',
            borderRadius: '7px',
            fontSize: '13px',
            margin: '6px 0 16px',
          }}
        />

        <label style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>Contraseña</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #e2e0da',
            borderRadius: '7px',
            fontSize: '13px',
            margin: '6px 0 20px',
          }}
        />

        {error && (
          <div style={{ fontSize: '12.5px', color: '#b3402f', marginBottom: '16px' }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: '#128752',
            color: '#ffffff',
            border: 'none',
            borderRadius: '7px',
            padding: '11px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
};

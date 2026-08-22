import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { loginApi, setAuthToken } from '../services/api';
import logoConsultora from '../assets/logo-consultora-san-miguel.png';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
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

  const inputWrapStyle: React.CSSProperties = { position: 'relative', marginBottom: '18px' };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px 12px 40px',
    border: '1px solid #e2e0da',
    borderRadius: '9px',
    fontSize: '13.5px',
    color: '#22262b',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  };
  const iconLeftStyle: React.CSSProperties = { position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: '#9aa1ab' };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #0e6b41 0%, #0a4d30 55%, #08381f 100%)',
        padding: '24px',
      }}
    >
      <div style={{ width: '380px', maxWidth: '100%' }}>
        <form
          onSubmit={handleSubmit}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '36px 32px 32px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <img src={logoConsultora} alt="Consultora San Miguel" style={{ height: '44px', width: 'auto' }} />
          </div>

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
            <ShieldCheck size={20} color="#128752" />
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#22262b', letterSpacing: '-0.01em' }}>
              SISCOM <span style={{ color: '#128752' }}>RG90</span>
            </h1>
          </div>
          <p style={{ fontSize: '12.5px', color: '#9aa1ab', textAlign: 'center', marginBottom: '28px' }}>
            Conciliación de Libros de Venta vs RG90
          </p>

          <label style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470', marginBottom: '6px', display: 'block' }}>Email</label>
          <div style={inputWrapStyle}>
            <Mail size={16} style={iconLeftStyle} />
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={inputStyle}
            />
          </div>

          <label style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470', marginBottom: '6px', display: 'block' }}>Contraseña</label>
          <div style={inputWrapStyle}>
            <Lock size={16} style={iconLeftStyle} />
            <input
              type={verPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ ...inputStyle, paddingRight: '40px' }}
            />
            <button
              type="button"
              onClick={() => setVerPassword(v => !v)}
              tabIndex={-1}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9aa1ab', cursor: 'pointer', display: 'flex' }}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#fbe9e3', border: '1px solid #eec3b5', color: '#8a3a26',
                borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', marginBottom: '18px',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              backgroundColor: '#128752',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9px',
              padding: '13px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(18,135,82,0.35)',
              marginTop: '4px',
            }}
          >
            {loading ? 'Ingresando…' : (<><LogIn size={16} /><span>Ingresar</span></>)}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '11.5px', color: 'rgba(255,255,255,0.55)', marginTop: '20px' }}>
          desarrollado por CORVISPY v1.0
        </p>
      </div>
    </div>
  );
};

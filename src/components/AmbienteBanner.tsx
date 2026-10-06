import React from 'react';
import { esProduccion, etiquetaAmbiente } from '../utils/ambiente';

// Franja fija arriba de toda la app (también en el login) que indica en qué ambiente se
// está trabajando. Producción: verde sólido. Prueba: ámbar con rayas de advertencia, para
// que no pase desapercibido cuando alguien cree estar operando con datos reales.
export const AmbienteBanner: React.FC = () => {
  const estilo: React.CSSProperties = esProduccion
    ? { backgroundColor: '#0c6b43', color: '#ffffff' }
    : {
        backgroundColor: '#f0a63d',
        color: '#1a1a1a',
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.07) 0 10px, transparent 10px 20px)',
      };

  return (
    <div
      role="status"
      aria-label={`Ambiente: ${etiquetaAmbiente}`}
      style={{
        ...estilo,
        padding: '5px 12px',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        lineHeight: 1.4,
      }}
    >
      {etiquetaAmbiente}
      <span style={{ fontWeight: 500, letterSpacing: 0, marginLeft: '10px', opacity: 0.85 }}>
        {esProduccion
          ? window.location.host
          : `${window.location.host} — los datos pueden ser compartidos con producción`}
      </span>
    </div>
  );
};

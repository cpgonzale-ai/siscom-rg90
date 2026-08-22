import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import type { EventoAuditoria } from '../services/api';
import { listAuditoriaApi } from '../services/api';

interface AuditoriaModalProps {
  titulo: string;
  acciones: string[];
  entidadId?: number;
  onClose: () => void;
}

const ACCION_LABEL: Record<string, string> = {
  alta_local: 'Alta', edicion_local: 'Edición', baja_local: 'Baja',
  alta_usuario: 'Alta', edicion_usuario: 'Edición', baja_usuario: 'Baja',
  alta_rol: 'Alta', edicion_rol: 'Edición', baja_rol: 'Baja',
};

const ACCION_COLOR: Record<string, string> = {
  alta_local: '#128752', edicion_local: '#b0740f', baja_local: '#b3402f',
  alta_usuario: '#128752', edicion_usuario: '#b0740f', baja_usuario: '#b3402f',
  alta_rol: '#128752', edicion_rol: '#b0740f', baja_rol: '#b3402f',
};

// Modal de solo lectura para el botón "ojito" — muestra fecha, acción, descripción y
// usuario responsable de cada cambio (alta/edición/baja) del módulo desde el que se abre.
export const AuditoriaModal: React.FC<AuditoriaModalProps> = ({ titulo, acciones, entidadId, onClose }) => {
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAuditoriaApi(acciones, entidadId)
      .then(setEventos)
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar la auditoría'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtFecha = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <Modal title={titulo} onClose={onClose} width="720px">
      {error && (
        <div style={{ background: '#fbe9e3', border: '1px solid #eec3b5', color: '#8a3a26', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', marginBottom: '14px' }}>
          {error}
        </div>
      )}
      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#9aa1ab', fontSize: '13px' }}>Cargando…</div>
      ) : (
        <div style={{ border: '1px solid #e2e0da', borderRadius: '8px', overflow: 'hidden', maxHeight: '55vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470', position: 'sticky', top: 0 }}>
                <th style={{ padding: '10px 12px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Fecha</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Acción</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Descripción</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, backgroundColor: '#fafbfa' }}>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map(ev => (
                <tr key={ev.id} style={{ borderBottom: '1px solid #f0eee8' }}>
                  <td style={{ padding: '9px 12px', color: '#5c6470', whiteSpace: 'nowrap' }}>{fmtFecha(ev.fecha)}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{
                      background: '#f4f2ed', color: ACCION_COLOR[ev.accion] || '#5c6470',
                      fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px',
                    }}>
                      {ACCION_LABEL[ev.accion] || ev.accion}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#22262b' }}>{ev.descripcion}</td>
                  <td style={{ padding: '9px 12px', color: '#5c6470' }}>{ev.usuario}</td>
                </tr>
              ))}
              {eventos.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#9aa1ab' }}>Todavía no hay movimientos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};

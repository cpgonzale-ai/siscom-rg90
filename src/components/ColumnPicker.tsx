import React, { useState } from 'react';
import { Columns3 } from 'lucide-react';
import { secondaryBtnStyle } from './Modal';

interface ColumnPickerProps {
  // Todas las columnas disponibles, en el orden en que aparecen en la grilla — el picker
  // no las reordena, solo decide cuáles se muestran.
  columnas: { key: string; label: string }[];
  ocultas: Set<string>;
  onChange: (next: Set<string>) => void;
}

// Botón "Columnas" con un desplegable de checkboxes para elegir qué columnas mostrar en una
// grilla — mismo mecanismo de desplegable + backdrop que ExcelFilterHeader (icono, no
// texto en la fila de la tabla, para no competir con el filtro de cada columna).
export const ColumnPicker: React.FC<ColumnPickerProps> = ({ columnas, ocultas, onChange }) => {
  const [open, setOpen] = useState(false);

  const toggle = (key: string) => {
    const next = new Set(ocultas);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
  };

  const mostrarTodas = () => onChange(new Set());

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <Columns3 size={14} />
        <span>Columnas{ocultas.size > 0 ? ` (${columnas.length - ocultas.size}/${columnas.length})` : ''}</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '6px',
              background: '#ffffff', border: '1px solid #e2e0da', borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '10px', width: '240px',
              zIndex: 50, fontWeight: 400, color: '#22262b',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#5c6470' }}>Mostrar columnas</span>
              {ocultas.size > 0 && (
                <button onClick={mostrarTodas} style={{ fontSize: '11px', color: '#128752', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Mostrar todas
                </button>
              )}
            </div>
            <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {columnas.map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5c6470', padding: '4px 2px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!ocultas.has(col.key)} onChange={() => toggle(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </span>
  );
};

import React, { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';

interface ExcelFilterHeaderProps {
  label: string;
  // Todos los valores de esta columna en el dataset SIN filtrar (se de-duplican adentro).
  allValues: string[];
  // null = sin filtro (se muestran todas las filas). Set = solo se muestran las filas cuyo
  // valor en esta columna está en el set.
  active: Set<string> | null;
  onChange: (next: Set<string> | null) => void;
  align?: 'left' | 'right' | 'center';
}

// Filtro de columna "tipo Excel": un icono de embudo al lado del título de la columna abre
// un desplegable con checkboxes por cada valor distinto que aparece en esa columna — con
// buscador propio y "Seleccionar todo" — igual que el AutoFiltro de Excel/Google Sheets.
export const ExcelFilterHeader: React.FC<ExcelFilterHeaderProps> = ({ label, allValues, active, onChange, align = 'left' }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set());

  const distinct = useMemo(
    () => Array.from(new Set(allValues)).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
    [allValues]
  );
  const filteredDistinct = useMemo(() => {
    if (!search.trim()) return distinct;
    const q = search.trim().toLowerCase();
    return distinct.filter(v => v.toLowerCase().includes(q));
  }, [distinct, search]);

  const isActive = active !== null;

  const abrir = () => {
    setDraft(active ? new Set(active) : new Set(distinct));
    setSearch('');
    setOpen(true);
  };

  const toggleValor = (v: string) => {
    setDraft(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const seleccionTotal = filteredDistinct.length > 0 && filteredDistinct.every(v => draft.has(v));
  const toggleTodos = () => {
    setDraft(prev => {
      const next = new Set(prev);
      if (seleccionTotal) filteredDistinct.forEach(v => next.delete(v));
      else filteredDistinct.forEach(v => next.add(v));
      return next;
    });
  };

  const aplicar = () => {
    onChange(draft.size === distinct.length ? null : new Set(draft));
    setOpen(false);
  };

  const quitarFiltro = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <span>{label}</span>
      <button
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : abrir(); }}
        title={`Filtrar por ${label}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: isActive ? '#128752' : '#9aa1ab' }}
      >
        <Filter size={12} fill={isActive ? '#128752' : 'none'} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: '100%', left: 0, marginTop: '6px',
              background: '#ffffff', border: '1px solid #e2e0da', borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '10px', width: '220px',
              zIndex: 50, fontWeight: 400, textTransform: 'none', color: '#22262b',
            }}
          >
            <input
              type="text" placeholder="Buscar valor..." value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e0da', borderRadius: '6px', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, padding: '4px 2px', cursor: 'pointer', borderBottom: '1px solid #f0eee8', marginBottom: '4px' }}>
              <input type="checkbox" checked={seleccionTotal} onChange={toggleTodos} />
              (Seleccionar todo)
            </label>
            <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filteredDistinct.map(v => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5c6470', padding: '3px 2px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={draft.has(v)} onChange={() => toggleValor(v)} />
                  {v || '(vacío)'}
                </label>
              ))}
              {filteredDistinct.length === 0 && (
                <div style={{ fontSize: '12px', color: '#9aa1ab', padding: '6px 2px' }}>Sin resultados</div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <button onClick={quitarFiltro} style={{ fontSize: '11px', color: '#b3402f', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Quitar filtro
              </button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setOpen(false)} style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid #e2e0da', borderRadius: '5px', background: '#fff', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={aplicar} style={{ fontSize: '11px', padding: '4px 8px', border: 'none', borderRadius: '5px', background: '#128752', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </span>
  );
};

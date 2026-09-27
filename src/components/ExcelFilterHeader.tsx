import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Filter } from 'lucide-react';

const PANEL_WIDTH = 220;
const PANEL_MARGIN = 12;

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
  // El ícono vive dentro de la grilla con scroll (scrollableGridStyle: overflow:auto) —
  // un panel position:absolute ahí adentro queda recortado por ese overflow apenas la
  // columna está cerca del borde derecho (exactamente el caso de "Estado", que además
  // suele ser una de las últimas columnas). Se dibuja en un portal a document.body con
  // position:fixed, calculando su posición a mano desde dónde está el ícono en pantalla
  // — así escapa del overflow:auto de cualquier grilla, sin importar qué tan angosta sea
  // o en qué columna esté el filtro.
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Cálculo perezoso: antes era un useMemo con dependencia [allValues], que corre en el
  // PRIMER render del componente sin importar si el usuario llega a abrir el desplegable
  // o no. Eso no se notaba mientras la grilla que lo usa quedara montada una sola vez —
  // pero varias grillas de este sistema se desmontan y remontan al navegar entre pasos
  // (ver el comentario sobre el Paso 3 en RG90View.tsx), y cada remontaje es una instancia
  // nueva de ExcelFilterHeader por columna, sin el caché de la anterior: 14+ columnas
  // volviendo a ordenar (con localeCompare, más lento que un sort simple) sus valores
  // únicos de cero, aunque nadie hubiera tocado ningún filtro. Ahora el sort recién se
  // hace la primera vez que ESTE desplegable puntual se abre, cacheado en un ref mientras
  // `allValues` no cambie de referencia.
  const distinctCacheRef = useRef<{ src: string[]; value: string[] } | null>(null);
  const getDistinct = (): string[] => {
    if (distinctCacheRef.current && distinctCacheRef.current.src === allValues) {
      return distinctCacheRef.current.value;
    }
    const value = Array.from(new Set(allValues)).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    distinctCacheRef.current = { src: allValues, value };
    return value;
  };
  // Mientras el desplegable está cerrado no hace falta el valor real: usar el último
  // calculado si ya existe (abrir/cerrar no debe recalcular) o un array vacío si nunca se
  // abrió — ninguno de los dos dispara el sort.
  const distinct = open ? getDistinct() : (distinctCacheRef.current?.src === allValues ? distinctCacheRef.current.value : []);
  const filteredDistinct = useMemo(() => {
    if (!search.trim()) return distinct;
    const q = search.trim().toLowerCase();
    return distinct.filter(v => v.toLowerCase().includes(q));
  }, [distinct, search]);

  const isActive = active !== null;

  const abrir = () => {
    // getDistinct() directo, NO la constante `distinct` de arriba -- en este punto el
    // render todavía es el de open=false, así que `distinct` vale [] (ver su definición
    // arriba); getDistinct() sí calcula (o reusa el caché) sin depender de en qué render
    // está parado.
    setDraft(active ? new Set(active) : new Set(getDistinct()));
    setSearch('');
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(rect.left, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN);
      setPos({ top: rect.bottom + 6, left: Math.max(PANEL_MARGIN, left) });
    }
    setOpen(true);
  };

  // Al estar en un portal con position:fixed (ver comentario de arriba), el panel no se
  // mueve solo si el usuario hace scroll de la grilla que tiene el ícono — se cierra en
  // ese caso en vez de quedar "flotando" desconectado de la columna que lo abrió.
  useEffect(() => {
    if (!open) return;
    const cerrar = () => setOpen(false);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [open]);

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
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : abrir(); }}
        title={`Filtrar por ${label}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: isActive ? '#128752' : '#9aa1ab' }}
      >
        <Filter size={12} fill={isActive ? '#128752' : 'none'} />
      </button>

      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1040 }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', top: pos.top, left: pos.left,
              background: '#ffffff', border: '1px solid #e2e0da', borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '10px', width: `${PANEL_WIDTH}px`,
              zIndex: 1050, fontWeight: 400, textTransform: 'none', color: '#22262b',
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
        </>,
        document.body
      )}
    </span>
  );
};

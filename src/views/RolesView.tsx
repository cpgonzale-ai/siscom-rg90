import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, Lock, Eye, Search } from 'lucide-react';
import { Modal, fieldLabelStyle, fieldInputStyle, primaryBtnStyle, secondaryBtnStyle, dangerBtnStyle } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { AuditoriaModal } from '../components/AuditoriaModal';
import { ExcelFilterHeader } from '../components/ExcelFilterHeader';
import type { Rol, Permiso } from '../services/api';
import { createRolApi, updateRolApi, deleteRolApi } from '../services/api';

const COLUMNAS: { key: string; label: string; getValue: (r: Rol) => string }[] = [
  { key: 'nombre', label: 'Rol', getValue: r => r.nombre },
  { key: 'descripcion', label: 'Descripción', getValue: r => r.descripcion || '' },
  { key: 'estado', label: 'Estado', getValue: r => (r.estado === 'activo' ? 'Activo' : 'Inactivo') },
];

interface RolesViewProps {
  roles: Rol[];
  permisos: Permiso[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  canCrear: boolean;
  canEditar: boolean;
  canEliminar: boolean;
}

const PANTALLA_LABEL: Record<string, string> = {
  dashboard: 'Panel general',
  carga: 'Carga y libro de ventas',
  correlatividad: 'Control de correlatividad',
  rg90: 'Comparación RG90',
  locales: 'Locales',
  usuarios: 'Usuarios',
  roles: 'Roles y permisos',
};

export const RolesView: React.FC<RolesViewProps> = ({ roles, permisos, loading, error, refetch, canCrear, canEditar, canEliminar }) => {
  const [modalOpen, setModalOpen] = useState<'crear' | 'editar' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [estado, setEstado] = useState<'activo' | 'inactivo'>('activo');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [esSistema, setEsSistema] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Rol | null>(null);
  const [auditoriaDe, setAuditoriaDe] = useState<Rol | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtrosColumna, setFiltrosColumna] = useState<Record<string, Set<string> | null>>({});

  // Mismo criterio que rg90GridAllValuesPorColumna en App.tsx (ver hallazgo F1 de
  // /auditoria/05-performance.md) — volumen bajo acá, pero mismo patrón, para que
  // ExcelFilterHeader reciba una referencia estable.
  const rolesAllValuesPorColumna = useMemo(
    () => Object.fromEntries(COLUMNAS.map(col => [col.key, roles.map(col.getValue)])),
    [roles]
  );

  const rolesFiltrados = useMemo(() => {
    let lista = roles;
    for (const col of COLUMNAS) {
      const activo = filtrosColumna[col.key];
      if (activo) lista = lista.filter(r => activo.has(col.getValue(r)));
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter(r => COLUMNAS.some(col => col.getValue(r).toLowerCase().includes(q)));
    }
    return lista;
  }, [roles, filtrosColumna, busqueda]);

  const hayFiltrosActivos = busqueda.trim() !== '' || Object.values(filtrosColumna).some(v => v !== null && v !== undefined);

  const grupos = useMemo(() => {
    const porPantalla: Record<string, Permiso[]> = {};
    for (const p of permisos) {
      (porPantalla[p.pantalla] ||= []).push(p);
    }
    return Object.entries(porPantalla).map(([pantalla, items]) => ({
      pantalla,
      label: PANTALLA_LABEL[pantalla] || pantalla,
      items: items.sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'pantalla' ? -1 : 1)),
    }));
  }, [permisos]);

  const openCrear = () => {
    setNombre(''); setDescripcion(''); setEstado('activo'); setSeleccionados(new Set()); setEsSistema(false); setFormError(null);
    setModalOpen('crear');
  };
  const openEditar = (r: Rol) => {
    setEditingId(r.id); setNombre(r.nombre); setDescripcion(r.descripcion || ''); setEstado(r.estado);
    setSeleccionados(new Set(r.permisos)); setEsSistema(r.es_sistema); setFormError(null);
    setModalOpen('editar');
  };
  const closeModal = () => { setModalOpen(null); setEditingId(null); };

  const toggle = (clave: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
  };

  const toggleGrupo = (items: Permiso[]) => {
    const todosMarcados = items.every(i => seleccionados.has(i.clave));
    setSeleccionados(prev => {
      const next = new Set(prev);
      items.forEach(i => (todosMarcados ? next.delete(i.clave) : next.add(i.clave)));
      return next;
    });
  };

  const submit = async () => {
    if (!nombre.trim()) { setFormError('El nombre del rol es obligatorio.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const permisosArr = Array.from(seleccionados);
      if (modalOpen === 'crear') {
        await createRolApi({ nombre: nombre.trim(), descripcion: descripcion.trim() || undefined, estado, permisos: permisosArr });
      } else if (editingId !== null) {
        await updateRolApi(editingId, { nombre: esSistema ? undefined : nombre.trim(), descripcion: descripcion.trim() || undefined, estado, permisos: permisosArr });
      }
      closeModal();
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar el rol.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteRolApi(confirmDelete.id);
      setConfirmDelete(null);
      closeModal();
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al eliminar el rol.');
      setConfirmDelete(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '12px',
          padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="#128752" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>Roles y permisos</h3>
          </div>
          <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>Cada rol define qué pantallas y botones puede usar. "admin" y "operador" son roles de sistema — no se pueden borrar ni renombrar, pero sus permisos sí se pueden ajustar.</p>
        </div>
        {canCrear && (
          <button onClick={openCrear} style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} />
            <span>Nuevo rol</span>
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fbe9e3', border: '1px solid #eec3b5', color: '#8a3a26', borderRadius: '8px', padding: '12px 14px', fontSize: '12.5px' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e0da', backgroundColor: '#fafbfa', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', flex: '0 1 280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9aa1ab' }} />
            <input
              type="text" placeholder="Buscar en todos los campos..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '8px 10px 8px 30px', border: '1px solid #e2e0da', borderRadius: '6px', fontSize: '12.5px', boxSizing: 'border-box' }}
            />
          </div>
          {hayFiltrosActivos && (
            <button
              onClick={() => { setBusqueda(''); setFiltrosColumna({}); }}
              style={{ ...secondaryBtnStyle, padding: '7px 12px', fontSize: '12px' }}
            >
              Limpiar filtros
            </button>
          )}
          <span style={{ fontSize: '12px', color: '#9aa1ab', marginLeft: 'auto' }}>
            {rolesFiltrados.length} de {roles.length}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
              {COLUMNAS.map(col => (
                <th key={col.key} style={{ padding: '12px 16px', fontWeight: 600 }}>
                  <ExcelFilterHeader
                    label={col.label}
                    allValues={rolesAllValuesPorColumna[col.key]}
                    active={filtrosColumna[col.key] ?? null}
                    onChange={(next) => setFiltrosColumna(prev => ({ ...prev, [col.key]: next }))}
                  />
                </th>
              ))}
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Permisos</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rolesFiltrados.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f0eee8' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#22262b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {r.nombre}
                    {r.es_sistema && <Lock size={12} color="#9aa1ab" />}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: '#5c6470' }}>{r.descripcion || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: r.estado === 'activo' ? '#e8f3ec' : '#f0eee8',
                    color: r.estado === 'activo' ? '#128752' : '#9aa1ab',
                    fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                  }}>
                    {r.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#5c6470' }}>{r.permisos.length} / {permisos.length}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <button
                      onClick={() => setAuditoriaDe(r)}
                      title="Ver auditoría de este rol"
                      style={{ ...secondaryBtnStyle, padding: '6px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <Eye size={12} />
                    </button>
                    {canEditar && (
                      <button
                        onClick={() => openEditar(r)}
                        style={{ ...secondaryBtnStyle, padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Pencil size={12} />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rolesFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#9aa1ab' }}>
                  {roles.length === 0 ? 'No hay roles cargados.' : 'Ningún rol coincide con el filtro aplicado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title={modalOpen === 'crear' ? 'Nuevo rol' : 'Editar rol'} width="620px" onClose={closeModal}>
          {formError && (
            <div style={{ background: '#fbe9e3', border: '1px solid #eec3b5', color: '#8a3a26', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <label style={fieldLabelStyle}>Nombre</label>
          <input
            style={{ ...fieldInputStyle, ...(esSistema ? { background: '#f4f2ed', color: '#9aa1ab' } : {}) }}
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            disabled={esSistema}
          />

          <label style={fieldLabelStyle}>Descripción (opcional)</label>
          <input style={fieldInputStyle} value={descripcion} onChange={e => setDescripcion(e.target.value)} />

          <label style={fieldLabelStyle}>Estado</label>
          <select
            style={fieldInputStyle}
            value={estado}
            onChange={e => setEstado(e.target.value as 'activo' | 'inactivo')}
            disabled={esSistema}
            title={esSistema ? 'Los roles de sistema (admin/operador) no se pueden desactivar' : undefined}
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>

          <label style={fieldLabelStyle}>Permisos</label>
          <div style={{ border: '1px solid #e2e0da', borderRadius: '8px', padding: '4px 0', marginBottom: '14px' }}>
            {grupos.map(g => {
              const todosMarcados = g.items.every(i => seleccionados.has(i.clave));
              return (
                <div key={g.pantalla} style={{ padding: '10px 14px', borderBottom: '1px solid #f0eee8' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#22262b', cursor: 'pointer' }}>
                    <input type="checkbox" checked={todosMarcados} onChange={() => toggleGrupo(g.items)} />
                    {g.label}
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', marginLeft: '22px' }}>
                    {g.items.map(p => (
                      <label key={p.clave} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#5c6470', cursor: 'pointer' }}>
                        <input type="checkbox" checked={seleccionados.has(p.clave)} onChange={() => toggle(p.clave)} />
                        {p.tipo === 'pantalla' ? 'Ver la pantalla' : p.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {modalOpen === 'editar' && canEliminar && !esSistema && (
                <button onClick={() => setConfirmDelete(roles.find(r => r.id === editingId) || null)} style={{ ...dangerBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={14} />
                  <span>Eliminar</span>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={closeModal} style={secondaryBtnStyle}>Cancelar</button>
              <button onClick={submit} disabled={saving} style={{ ...primaryBtnStyle, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`¿Eliminar el rol "${confirmDelete.nombre}"? Solo se puede borrar si no tiene usuarios asignados.`}
          confirmLabel="Eliminar rol"
          onConfirm={doDelete}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {auditoriaDe && (
        <AuditoriaModal
          titulo={`Auditoría — ${auditoriaDe.nombre}`}
          acciones={['alta_rol', 'edicion_rol', 'baja_rol']}
          entidadId={auditoriaDe.id}
          onClose={() => setAuditoriaDe(null)}
        />
      )}
    </div>
  );
};

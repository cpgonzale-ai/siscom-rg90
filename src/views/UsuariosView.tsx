import React, { useMemo, useState } from 'react';
import { Plus, Pencil, UserX, Users as UsersIcon, Eye, EyeOff, Search } from 'lucide-react';
import { Modal, fieldLabelStyle, fieldInputStyle, primaryBtnStyle, secondaryBtnStyle, dangerBtnStyle } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { AuditoriaModal } from '../components/AuditoriaModal';
import { ExcelFilterHeader } from '../components/ExcelFilterHeader';
import type { Usuario, Rol } from '../services/api';
import { createUsuarioApi, updateUsuarioApi, deleteUsuarioApi } from '../services/api';
import { PASSWORD_HINT, validarPassword } from '../utils/password';

const COLUMNAS: { key: string; label: string; getValue: (u: Usuario) => string }[] = [
  { key: 'nombre', label: 'Nombre', getValue: u => u.nombre },
  { key: 'nro_documento', label: 'N° Documento', getValue: u => u.nro_documento },
  { key: 'email', label: 'Email', getValue: u => u.email },
  { key: 'rol', label: 'Rol', getValue: u => u.rol },
  { key: 'estado', label: 'Estado', getValue: u => (u.activo ? 'Activo' : 'Inactivo') },
];

interface UsuariosViewProps {
  usuarios: Usuario[];
  roles: Rol[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  currentUserId: number;
  canCrear: boolean;
  canEditar: boolean;
  canEliminar: boolean;
}

interface FormState {
  nombre: string;
  nro_documento: string;
  email: string;
  password: string;
  rol_id: number | '';
  estado: 'activo' | 'inactivo';
}

const EMPTY_FORM: FormState = { nombre: '', nro_documento: '', email: '', password: '', rol_id: '', estado: 'activo' };

export const UsuariosView: React.FC<UsuariosViewProps> = ({ usuarios, roles, loading, error, refetch, currentUserId, canCrear, canEditar, canEliminar }) => {
  const [modalOpen, setModalOpen] = useState<'crear' | 'editar' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Usuario | null>(null);
  const [auditoriaDe, setAuditoriaDe] = useState<Usuario | null>(null);
  const [verPassword, setVerPassword] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [filtrosColumna, setFiltrosColumna] = useState<Record<string, Set<string> | null>>({});

  const usuariosFiltrados = useMemo(() => {
    let lista = usuarios;
    for (const col of COLUMNAS) {
      const activo = filtrosColumna[col.key];
      if (activo) lista = lista.filter(u => activo.has(col.getValue(u)));
    }
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter(u => COLUMNAS.some(col => col.getValue(u).toLowerCase().includes(q)));
    }
    return lista;
  }, [usuarios, filtrosColumna, busqueda]);

  const hayFiltrosActivos = busqueda.trim() !== '' || Object.values(filtrosColumna).some(v => v !== null && v !== undefined);

  const openCrear = () => { setForm(EMPTY_FORM); setFormError(null); setVerPassword(false); setModalOpen('crear'); };
  const openEditar = (u: Usuario) => {
    setEditingId(u.id);
    setForm({ nombre: u.nombre, nro_documento: u.nro_documento, email: u.email, password: '', rol_id: u.rol_id ?? '', estado: u.activo ? 'activo' : 'inactivo' });
    setFormError(null);
    setVerPassword(false);
    setModalOpen('editar');
  };
  const closeModal = () => { setModalOpen(null); setEditingId(null); };

  const submit = async () => {
    if (!form.nombre.trim() || !form.nro_documento.trim() || !form.email.trim() || form.rol_id === '') {
      setFormError('Nombre, N° de documento, email y rol son obligatorios.');
      return;
    }
    if (modalOpen === 'crear' && !form.password) {
      setFormError('La contraseña es obligatoria.');
      return;
    }
    if (form.password) {
      const err = validarPassword(form.password);
      if (err) { setFormError(err); return; }
    }
    setSaving(true);
    setFormError(null);
    try {
      const activo = form.estado === 'activo';
      if (modalOpen === 'crear') {
        await createUsuarioApi({ nombre: form.nombre.trim(), nro_documento: form.nro_documento.trim(), email: form.email.trim(), password: form.password, rol_id: Number(form.rol_id), activo });
      } else if (editingId !== null) {
        const datos: { nombre?: string; nro_documento?: string; rol_id?: number; password?: string; activo?: boolean } = { nombre: form.nombre.trim(), nro_documento: form.nro_documento.trim(), rol_id: Number(form.rol_id), activo };
        if (form.password) datos.password = form.password;
        await updateUsuarioApi(editingId, datos);
      }
      closeModal();
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const doDeactivate = async () => {
    if (!confirmDeactivate) return;
    try {
      await deleteUsuarioApi(confirmDeactivate.id);
      setConfirmDeactivate(null);
      closeModal();
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al desactivar el usuario.');
      setConfirmDeactivate(null);
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
            <UsersIcon size={20} color="#128752" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>Usuarios</h3>
          </div>
          <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>Alta, edición y baja de usuarios del sistema — el rol asignado determina qué pantallas y botones puede usar.</p>
        </div>
        {canCrear && (
          <button onClick={openCrear} style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} />
            <span>Nuevo usuario</span>
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
            {usuariosFiltrados.length} de {usuarios.length}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
              {COLUMNAS.map(col => (
                <th key={col.key} style={{ padding: '12px 16px', fontWeight: 600 }}>
                  <ExcelFilterHeader
                    label={col.label}
                    allValues={usuarios.map(col.getValue)}
                    active={filtrosColumna[col.key] ?? null}
                    onChange={(next) => setFiltrosColumna(prev => ({ ...prev, [col.key]: next }))}
                  />
                </th>
              ))}
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0eee8' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#22262b' }}>{u.nombre}</td>
                <td style={{ padding: '12px 16px', color: '#5c6470' }}>{u.nro_documento}</td>
                <td style={{ padding: '12px 16px', color: '#5c6470' }}>{u.email}</td>
                <td style={{ padding: '12px 16px', color: '#5c6470' }}>{u.rol}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: u.activo ? '#e8f3ec' : '#fbe9e3',
                    color: u.activo ? '#128752' : '#b3402f',
                    fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                  }}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <button
                      onClick={() => setAuditoriaDe(u)}
                      title="Ver auditoría de este usuario"
                      style={{ ...secondaryBtnStyle, padding: '6px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <Eye size={12} />
                    </button>
                    {canEditar && (
                      <button
                        onClick={() => openEditar(u)}
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
            {!loading && usuariosFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#9aa1ab' }}>
                  {usuarios.length === 0 ? 'No hay usuarios cargados.' : 'Ningún usuario coincide con el filtro aplicado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title={modalOpen === 'crear' ? 'Nuevo usuario' : 'Editar usuario'} onClose={closeModal}>
          {formError && (
            <div style={{ background: '#fbe9e3', border: '1px solid #eec3b5', color: '#8a3a26', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <label style={fieldLabelStyle}>Nombre</label>
          <input style={fieldInputStyle} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />

          <label style={fieldLabelStyle}>N° de Documento (usuario de acceso)</label>
          <input
            style={fieldInputStyle}
            value={form.nro_documento}
            onChange={e => setForm({ ...form, nro_documento: e.target.value.trim() })}
            placeholder="Ej: 4567890"
          />

          <label style={fieldLabelStyle}>Email</label>
          <input
            style={{ ...fieldInputStyle, ...(modalOpen === 'editar' ? { background: '#f4f2ed', color: '#9aa1ab' } : {}) }}
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            disabled={modalOpen === 'editar'}
          />

          <label style={fieldLabelStyle}>{modalOpen === 'editar' ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
          <div style={{ position: 'relative', marginBottom: '4px' }}>
            <input
              style={{ ...fieldInputStyle, marginBottom: 0, paddingRight: '38px' }}
              type={verPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder={modalOpen === 'editar' ? 'Dejar en blanco para no cambiarla' : PASSWORD_HINT}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setVerPassword(v => !v)}
              tabIndex={-1}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9aa1ab', cursor: 'pointer', display: 'flex' }}
            >
              {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#9aa1ab', marginBottom: '14px' }}>{PASSWORD_HINT}</div>

          <label style={fieldLabelStyle}>Rol</label>
          <select style={fieldInputStyle} value={form.rol_id} onChange={e => setForm({ ...form, rol_id: e.target.value ? Number(e.target.value) : '' })}>
            <option value="">Seleccioná un rol…</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}{r.estado === 'inactivo' ? ' (inactivo)' : ''}</option>)}
          </select>

          <label style={fieldLabelStyle}>Estado</label>
          <select
            style={fieldInputStyle}
            value={form.estado}
            onChange={e => setForm({ ...form, estado: e.target.value as 'activo' | 'inactivo' })}
            disabled={modalOpen === 'editar' && editingId === currentUserId}
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <div>
              {modalOpen === 'editar' && canEliminar && editingId !== currentUserId && (
                <button onClick={() => setConfirmDeactivate(usuarios.find(u => u.id === editingId) || null)} style={{ ...dangerBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserX size={14} />
                  <span>Desactivar</span>
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

      {confirmDeactivate && (
        <ConfirmModal
          message={`¿Desactivar a "${confirmDeactivate.nombre}"? No va a poder iniciar sesión hasta que lo reactives.`}
          confirmLabel="Desactivar usuario"
          onConfirm={doDeactivate}
          onClose={() => setConfirmDeactivate(null)}
        />
      )}

      {auditoriaDe && (
        <AuditoriaModal
          titulo={`Auditoría — ${auditoriaDe.nombre}`}
          acciones={['alta_usuario', 'edicion_usuario', 'baja_usuario']}
          entidadId={auditoriaDe.id}
          onClose={() => setAuditoriaDe(null)}
        />
      )}
    </div>
  );
};

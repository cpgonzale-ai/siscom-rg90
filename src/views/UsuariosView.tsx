import React, { useState } from 'react';
import { Plus, Pencil, UserX, Users as UsersIcon, Eye } from 'lucide-react';
import { Modal, fieldLabelStyle, fieldInputStyle, primaryBtnStyle, secondaryBtnStyle, dangerBtnStyle } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { AuditoriaModal } from '../components/AuditoriaModal';
import type { Usuario, Rol } from '../services/api';
import { createUsuarioApi, updateUsuarioApi, deleteUsuarioApi } from '../services/api';

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
  email: string;
  password: string;
  rol_id: number | '';
}

const EMPTY_FORM: FormState = { nombre: '', email: '', password: '', rol_id: '' };

export const UsuariosView: React.FC<UsuariosViewProps> = ({ usuarios, roles, loading, error, refetch, currentUserId, canCrear, canEditar, canEliminar }) => {
  const [modalOpen, setModalOpen] = useState<'crear' | 'editar' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Usuario | null>(null);
  const [auditoriaDe, setAuditoriaDe] = useState<Usuario | null>(null);

  const openCrear = () => { setForm(EMPTY_FORM); setFormError(null); setModalOpen('crear'); };
  const openEditar = (u: Usuario) => {
    setEditingId(u.id);
    setForm({ nombre: u.nombre, email: u.email, password: '', rol_id: u.rol_id ?? '' });
    setFormError(null);
    setModalOpen('editar');
  };
  const closeModal = () => { setModalOpen(null); setEditingId(null); };

  const submit = async () => {
    if (!form.nombre.trim() || !form.email.trim() || form.rol_id === '') {
      setFormError('Nombre, email y rol son obligatorios.');
      return;
    }
    if (modalOpen === 'crear' && form.password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (modalOpen === 'crear') {
        await createUsuarioApi({ nombre: form.nombre.trim(), email: form.email.trim(), password: form.password, rol_id: Number(form.rol_id) });
      } else if (editingId !== null) {
        const datos: { nombre?: string; rol_id?: number; password?: string } = { nombre: form.nombre.trim(), rol_id: Number(form.rol_id) };
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
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nombre</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Email</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Rol</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Estado</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0eee8' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#22262b' }}>{u.nombre}</td>
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
            {!loading && usuarios.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#9aa1ab' }}>No hay usuarios cargados.</td>
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

          <label style={fieldLabelStyle}>Email</label>
          <input
            style={{ ...fieldInputStyle, ...(modalOpen === 'editar' ? { background: '#f4f2ed', color: '#9aa1ab' } : {}) }}
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            disabled={modalOpen === 'editar'}
          />

          <label style={fieldLabelStyle}>{modalOpen === 'editar' ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
          <input style={fieldInputStyle} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={modalOpen === 'editar' ? 'Dejar en blanco para no cambiarla' : 'mínimo 8 caracteres'} />

          <label style={fieldLabelStyle}>Rol</label>
          <select style={fieldInputStyle} value={form.rol_id} onChange={e => setForm({ ...form, rol_id: e.target.value ? Number(e.target.value) : '' })}>
            <option value="">Seleccioná un rol…</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
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

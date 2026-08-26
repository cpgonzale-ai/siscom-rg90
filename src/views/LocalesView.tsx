import React, { useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, Eye } from 'lucide-react';
import { Modal, fieldLabelStyle, fieldInputStyle, primaryBtnStyle, secondaryBtnStyle, dangerBtnStyle } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { AuditoriaModal } from '../components/AuditoriaModal';
import type { Local } from '../services/api';
import { createLocalApi, updateLocalApi, deleteLocalApi } from '../services/api';

interface LocalesViewProps {
  locales: Local[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  canCrear: boolean;
  canEditar: boolean;
  canEliminar: boolean;
}

interface FormState {
  nombre: string;
  establecimiento: string;
  punto_expedicion: string;
  codigo: string;
  abreviatura: string;
  estado: 'activo' | 'inactivo';
}

const EMPTY_FORM: FormState = { nombre: '', establecimiento: '', punto_expedicion: '', codigo: '', abreviatura: '', estado: 'activo' };

export const LocalesView: React.FC<LocalesViewProps> = ({ locales, loading, error, refetch, canCrear, canEditar, canEliminar }) => {
  const [modalOpen, setModalOpen] = useState<'crear' | 'editar' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Local | null>(null);
  const [auditoriaDe, setAuditoriaDe] = useState<Local | null>(null);

  const openCrear = () => { setForm(EMPTY_FORM); setFormError(null); setModalOpen('crear'); };
  const openEditar = (l: Local) => {
    setEditingId(l.id);
    setForm({
      nombre: l.nombre,
      establecimiento: l.establecimiento || '',
      punto_expedicion: l.punto_expedicion || '',
      codigo: l.codigo || '',
      abreviatura: l.abreviatura || '',
      estado: l.estado,
    });
    setFormError(null);
    setModalOpen('editar');
  };
  const closeModal = () => { setModalOpen(null); setEditingId(null); };

  const submit = async () => {
    if (!form.nombre.trim()) {
      setFormError('El nombre es obligatorio.');
      return;
    }
    // Establecimiento y punto de expedición van de a par — no tiene sentido cargar uno sin
    // el otro (no alcanzaría para matchear ningún comprobante en el Paso 2). Las filas de
    // marca que usa Compras (ver campo Código) legítimamente no tienen ninguno de los dos.
    if (form.establecimiento.trim() && !form.punto_expedicion.trim()) {
      setFormError('Si cargás el establecimiento, también necesitás el punto de expedición.');
      return;
    }
    if (form.punto_expedicion.trim() && !form.establecimiento.trim()) {
      setFormError('Si cargás el punto de expedición, también necesitás el establecimiento.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const datos = {
        nombre: form.nombre.trim(),
        establecimiento: form.establecimiento.trim() || null,
        punto_expedicion: form.punto_expedicion.trim() || null,
        codigo: form.codigo.trim() || null,
        abreviatura: form.abreviatura.trim() || null,
        estado: form.estado,
      };
      if (modalOpen === 'crear') {
        await createLocalApi(datos);
      } else if (editingId !== null) {
        await updateLocalApi(editingId, datos);
      }
      closeModal();
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar el local.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteLocalApi(confirmDelete.id);
      setConfirmDelete(null);
      closeModal();
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al eliminar el local.');
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
            <MapPin size={20} color="#128752" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#22262b' }}>Locales</h3>
          </div>
          <p style={{ fontSize: '12.5px', color: '#5c6470', marginTop: '2px' }}>
            El establecimiento y el punto de expedición son las dos primeras partes del número de documento (ej. "025" y "001" en 025-001-0065027) — juntos determinan automáticamente a qué local corresponde cada comprobante en el Paso 2.
          </p>
        </div>
        {canCrear && (
          <button
            onClick={openCrear}
            style={{ ...primaryBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Nuevo local</span>
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fbe9e3', border: '1px solid #eec3b5', color: '#8a3a26', borderRadius: '8px', padding: '12px 14px', fontSize: '12.5px' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e0da', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafbfa', borderBottom: '1px solid #e2e0da', color: '#5c6470' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nombre</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Establecimiento</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Punto de expedición</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Código</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Abreviatura</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Estado</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {locales.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #f0eee8' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#22262b' }}>{l.nombre}</td>
                <td style={{ padding: '12px 16px', color: '#5c6470', fontFamily: 'monospace' }}>{l.establecimiento || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#5c6470', fontFamily: 'monospace' }}>{l.punto_expedicion || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#5c6470' }}>{l.codigo || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#5c6470' }}>{l.abreviatura || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: l.estado === 'activo' ? '#e8f3ec' : '#f0eee8',
                    color: l.estado === 'activo' ? '#128752' : '#9aa1ab',
                    fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px',
                  }}>
                    {l.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <button
                      onClick={() => setAuditoriaDe(l)}
                      title="Ver auditoría de este local"
                      style={{ ...secondaryBtnStyle, padding: '6px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <Eye size={12} />
                    </button>
                    {canEditar && (
                      <button
                        onClick={() => openEditar(l)}
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
            {!loading && locales.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#9aa1ab' }}>
                  No hay locales cargados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {modalOpen && (
        <Modal title={modalOpen === 'crear' ? 'Nuevo local' : 'Editar local'} onClose={closeModal}>
          {formError && (
            <div style={{ background: '#fbe9e3', border: '1px solid #eec3b5', color: '#8a3a26', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <label style={fieldLabelStyle}>Nombre</label>
          <input style={fieldInputStyle} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="ej. Juan Valdez - Shopping del Sol" />

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabelStyle}>Establecimiento (3 dígitos)</label>
              <input style={fieldInputStyle} value={form.establecimiento} onChange={e => setForm({ ...form, establecimiento: e.target.value })} placeholder="ej. 025" maxLength={10} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={fieldLabelStyle}>Punto de expedición (3 dígitos)</label>
              <input style={fieldInputStyle} value={form.punto_expedicion} onChange={e => setForm({ ...form, punto_expedicion: e.target.value })} placeholder="ej. 001" maxLength={10} />
            </div>
          </div>

          <label style={fieldLabelStyle}>Código de sucursal (opcional — usado en Libro de Compras)</label>
          <input style={fieldInputStyle} value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="ej. 1 — dónde se recibe la factura de compra" />

          <label style={fieldLabelStyle}>Abreviatura (opcional)</label>
          <input style={fieldInputStyle} value={form.abreviatura} onChange={e => setForm({ ...form, abreviatura: e.target.value })} placeholder="ej. JV" />

          <label style={fieldLabelStyle}>Estado</label>
          <select
            style={fieldInputStyle}
            value={form.estado}
            onChange={e => setForm({ ...form, estado: e.target.value as 'activo' | 'inactivo' })}
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <div>
              {modalOpen === 'editar' && canEliminar && (
                <button onClick={() => setConfirmDelete(locales.find(l => l.id === editingId) || null)} style={{ ...dangerBtnStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          message={`¿Eliminar el local "${confirmDelete.nombre}"? Los comprobantes que ya matcheaban con su establecimiento y punto de expedición van a dejar de mostrar el local en el Paso 2.`}
          confirmLabel="Eliminar local"
          onConfirm={doDelete}
          onClose={() => setConfirmDelete(null)}
        />
      )}

      {auditoriaDe && (
        <AuditoriaModal
          titulo={`Auditoría — ${auditoriaDe.nombre}`}
          acciones={['alta_local', 'edicion_local', 'baja_local']}
          entidadId={auditoriaDe.id}
          onClose={() => setAuditoriaDe(null)}
        />
      )}
    </div>
  );
};

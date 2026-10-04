import { useEffect, useState } from 'react';
import {
  Local,
  Rol,
  Permiso,
  Usuario,
  listLocalesApi,
  listRolesApi,
  listPermisosApi,
  listUsuariosApi,
} from '../services/api';

// Estado y carga de las pantallas de administración (Locales, Roles y Permisos, Usuarios).
// Se extrajo de App.tsx sin cambiar comportamiento: los mismos efectos, en el mismo orden
// relativo, y la misma regla de cargar roles/usuarios solo al entrar a su pantalla.
// Locales se devuelve también porque lo usan Ventas y Compras para resolver el local de
// cada comprobante, no solo la pantalla de administración.
export function useAdministracion(
  screen: string,
  puede: (clave: string) => boolean,
) {
  const [locales, setLocales] = useState<Local[]>([]);
  const [localesLoading, setLocalesLoading] = useState(false);
  const [localesError, setLocalesError] = useState<string | null>(null);
  const refetchLocales = () => {
    setLocalesLoading(true);
    listLocalesApi().then(setLocales).catch(e => setLocalesError(e instanceof Error ? e.message : 'Error al cargar locales')).finally(() => setLocalesLoading(false));
  };

  const [rolesAdmin, setRolesAdmin] = useState<Rol[]>([]);
  const [permisosCatalogo, setPermisosCatalogo] = useState<Permiso[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const refetchRoles = () => {
    setRolesLoading(true);
    Promise.all([listRolesApi(), listPermisosApi()])
      .then(([r, p]) => { setRolesAdmin(r); setPermisosCatalogo(p); })
      .catch(e => setRolesError(e instanceof Error ? e.message : 'Error al cargar roles'))
      .finally(() => setRolesLoading(false));
  };

  const [usuariosAdmin, setUsuariosAdmin] = useState<Usuario[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);
  const refetchUsuarios = () => {
    setUsuariosLoading(true);
    listUsuariosApi().then(setUsuariosAdmin).catch(e => setUsuariosError(e instanceof Error ? e.message : 'Error al cargar usuarios')).finally(() => setUsuariosLoading(false));
  };

  // Roles y usuarios son admin-only y más pesados (traen el catálogo completo de
  // permisos) — se cargan recién al entrar a esas pantallas, no en cada login. La
  // pantalla de Usuarios también necesita la lista de roles para el selector del form.
  useEffect(() => {
    if (screen === 'roles' && puede('pantalla:roles')) refetchRoles();
    if (screen === 'usuarios' && puede('pantalla:usuarios')) {
      refetchUsuarios();
      if (rolesAdmin.length === 0) refetchRoles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  return {
    locales, localesLoading, localesError, refetchLocales,
    rolesAdmin, permisosCatalogo, rolesLoading, rolesError, refetchRoles,
    usuariosAdmin, usuariosLoading, usuariosError, refetchUsuarios,
  };
}

// Mismo estándar mínimo que valida el backend (ver app/schemas/auth.py, _PASSWORD_PATTERN):
// 8+ caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_HINT = 'Mínimo 8 caracteres, con mayúscula, minúscula, número y un carácter especial.';

export function isPasswordValida(password: string): boolean {
  return PASSWORD_PATTERN.test(password);
}

export function validarPassword(password: string): string | null {
  if (!isPasswordValida(password)) return PASSWORD_HINT;
  return null;
}

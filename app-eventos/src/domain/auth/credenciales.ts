export const LONGITUD_MINIMA_PASSWORD = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Credenciales {
  email: string;
  password: string;
  /** Solo en el registro: obligatorio si se informa la propiedad. */
  nombre?: string;
}

/** Devuelve el primer error de validación del formulario, o `null` si es válido. */
export function validarCredenciales({ email, password, nombre }: Credenciales): string | null {
  if (nombre !== undefined && nombre.trim().length === 0) {
    return 'Escribe tu nombre';
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    return 'Escribe un email válido';
  }
  if (password.length < LONGITUD_MINIMA_PASSWORD) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres`;
  }
  return null;
}

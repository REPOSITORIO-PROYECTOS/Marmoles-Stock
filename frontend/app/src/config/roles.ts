/** Roles del sistema MDM (depósito). */
export const ROLE_ADMIN = 'admin';
export const ROLE_DEPOSITO = 'deposito';

export type AppRole = typeof ROLE_ADMIN | typeof ROLE_DEPOSITO | 'ventas';

export const DEPOSITO_APP_ROLES: { value: AppRole; label: string }[] = [
  { value: ROLE_ADMIN, label: 'Administrador' },
  { value: ROLE_DEPOSITO, label: 'Depósito' },
];

export const FULL_APP_ROLES: { value: AppRole; label: string }[] = [
  ...DEPOSITO_APP_ROLES,
  { value: 'ventas', label: 'Ventas' },
];

export function rolesForApp(): { value: AppRole; label: string }[] {
  return import.meta.env.VITE_DEPOSITO_ONLY === 'true' ? DEPOSITO_APP_ROLES : FULL_APP_ROLES;
}

export function roleLabel(role: string): string {
  const found = FULL_APP_ROLES.find((r) => r.value === role);
  return found?.label ?? role;
}

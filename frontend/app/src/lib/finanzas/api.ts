export interface Pago {
  id: string;
  presupuesto_id: string;
  cliente_id?: string;
  monto: number;
  fecha: string;
  metodo_pago: string;
  referencia?: string;
  nota?: string;
}

export interface PagoCreate {
  presupuesto_id: string;
  cliente_id?: string;
  monto: number;
  metodo_pago: string;
  referencia?: string;
  nota?: string;
}

export interface DashboardStats {
  total_presupuestado: number;
  total_recaudado: number;
  total_pendiente: number;
}

export async function registrarPago(data: PagoCreate): Promise<Pago> {
  const { post } = await import("../../api");
  return post<Pago>("/api/finanzas/pagos", data);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { get } = await import("../../api");
  return get<DashboardStats>("/api/finanzas/dashboard");
}

export async function getPagosPresupuesto(id: string): Promise<Pago[]> {
  const { get } = await import("../../api");
  return get<Pago[]>(`/api/finanzas/presupuestos/${id}/pagos`);
}

export async function actualizarPago(id: string, data: Partial<PagoCreate>): Promise<Pago> {
  const { put } = await import("../../api");
  return put<Pago>(`/api/finanzas/pagos/${id}`, data);
}

export async function borrarPago(id: string): Promise<{ deleted: boolean }> {
  const { del } = await import("../../api");
  return del<{ deleted: boolean }>(`/api/finanzas/pagos/${id}`);
}

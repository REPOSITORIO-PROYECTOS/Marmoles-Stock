import { get, post } from "../../api";

export type N12VisitaResumen = {
  id_visita: string;
  presupuesto_id: string;
  estado: string;
  fecha?: string | null;
  medidas_confirmadas?: boolean;
};

export type N12OptInput = {
  id_opt_input: string;
  id_visita: string;
  material: string;
  espesor_mm: number | null;
  piezas_json: unknown[];
  estado: string;
  fecha_creacion?: string | null;
};

export async function fetchN12Visitas(params?: { presupuesto_id?: string; estado?: string }) {
  const sp = new URLSearchParams();
  if (params?.presupuesto_id) sp.set("presupuesto_id", params.presupuesto_id);
  if (params?.estado) sp.set("estado", params.estado);
  const q = sp.toString();
  return get<N12VisitaResumen[]>(`/api/n12/visitas${q ? `?${q}` : ""}`);
}

export async function fetchN12OptInput(visitaId: string) {
  return get<N12OptInput[]>(`/api/n12/visitas/${visitaId}/opt-input`);
}

export async function n12EvaluarOptimizacion(body: {
  visita_id: string;
  presupuesto_id?: string | null;
  grupo_tecnico: string;
  material: string;
  color?: string | null;
  espesor_mm?: number | null;
  criterio_lote?: string;
  forzar_modo?: string | null;
  observaciones?: string | null;
}) {
  return post<{ id_optimizacion: string; estado: string; modo_resolucion: string }>(
    "/api/n12/optimizaciones/evaluar",
    body,
  );
}

export async function n12AprobarOptimizacion(optimizacionId: string) {
  return post<{ id_optimizacion: string; estado: string }>(
    `/api/n12/optimizaciones/${optimizacionId}/aprobar`,
    {},
  );
}

export async function n12CrearOP(body: {
  optimizacion_id: string;
  fecha_fin_estimada?: string | null;
  prioridad?: string;
  responsable_produccion?: string | null;
}) {
  return post<{ id_op: string; estado: string }>("/api/n12/op/crear", body);
}

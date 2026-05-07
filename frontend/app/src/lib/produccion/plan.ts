
import { get, post } from "../../api";
import { packBestFit, packShelf } from "../../components/produccion/PlanchaMapa";

export type Pieza = {
  id?: string; // Agregado para manejar el ID de la pieza
  ancho: number;
  largo: number;
  cantidad: number;
  descripcion?: string;
  w?: number; // Ancho alternativo
  h?: number; // Largo alternativo
  qty?: number; // Cantidad alternativa
  nombre?: string; // Nombre de la pieza
  ubicacion?: string; // Ubicación de la pieza
};

export type TrabajoPendiente = {
  fecha_creacion: any;
  id: string;
  cliente: string;
  material: string; // Mármol/Granito/Cuarzo
  color: string;
  espesor: number; // mm
  piezas: Pieza[];
  prioridad: "alta" | "media" | "baja";
  visita_tecnica?: boolean;
  aprobado_jefe?: boolean;
  sena_abonada?: boolean;
  coordenadas?: string;
  direccion?: string; // Nueva propiedad para la dirección
  archivos_adjuntos?: string[];
  anexosImagenes?: string[];
  piezas_data?: Pieza[]; // Aseguramos que sea un array de la interfaz Pieza unificada
  fecha?: string;
  estado?: string;
  medidas_corregidas?: boolean;
};

function normalizeToMm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // Heurística de compatibilidad legacy: valores chicos suelen venir en cm.
  return value < 1000 ? Math.round(value * 10) : Math.round(value);
}

export function areaPieza(p: Pieza) {
  const ancho = normalizeToMm(Number(p?.ancho) || Number(p?.w) || 0);
  const largo = normalizeToMm(Number(p?.largo) || Number(p?.h) || 0);
  const cantidad = Number(p?.cantidad) || 0;
  return ancho * largo * cantidad;
}

export function totalAreaTrabajo(t: TrabajoPendiente) {
  const piezas = Array.isArray(t?.piezas) ? t!.piezas : [];
  return piezas.reduce((sum, p) => sum + areaPieza(p), 0);
}

export type ClaveGrupo = "material" | "material_color" | "espesor";

export function groupTrabajos(trabajos: TrabajoPendiente[], clave: ClaveGrupo) {
  const list = Array.isArray(trabajos) ? trabajos : [];
  const map = new Map<string, TrabajoPendiente[]>();
  for (const t of list) {
    const key =
      clave === "material"
        ? t.material
        : clave === "material_color"
          ? `${t.material} · ${t.color}`
          : `${t.espesor} mm`;
    const arr = map.get(key) || [];
    arr.push(t);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([key, trabajos]) => ({
    key,
    trabajos,
    totalArea: trabajos.reduce((s, t) => s + totalAreaTrabajo(t), 0),
    totalPiezas: trabajos.reduce(
      (s, t) => s + (Array.isArray(t.piezas) ? t.piezas : []).reduce((sp, p) => sp + (Number(p.cantidad) || 0), 0),
      0
    ),
  }));
}

export function prioritizeMedidas(piezas: Pieza[]) {
  const map = new Map<string, { ancho: number; largo: number; count: number; area: number }>();
  for (const p of piezas) {
    const key = `${p.ancho}×${p.largo}`;
    const prev = map.get(key) || { ancho: p.ancho, largo: p.largo, count: 0, area: 0 };
    prev.count += p.cantidad;
    prev.area += p.ancho * p.largo * p.cantidad;
    map.set(key, prev);
  }
  return Array.from(map.values()).sort((a, b) => b.area - a.area);
}

export type Strategy = "bestfit" | "shelf";

export function generatePlanLocal(width: number, height: number, piezas: Pieza[], strategy: Strategy) {
  const placements = strategy === "bestfit" ? packBestFit(width, height, piezas) : packShelf(width, height, piezas);
  const usedArea = placements.reduce((s, p) => s + p.w * p.h, 0);
  const utilization = usedArea / (width * height);
  return { placements, usedArea, utilization };
}

export type BackendPlanResponse = {
  width: number;
  height: number;
  utilization: number;
  placements: Array<{ x: number; y: number; w: number; h: number; rotado?: boolean; label?: string;[key: string]: any }>;
  cuts?: Array<{ x: number; y: number; w: number; h: number }>;
  retazos: Array<{ x: number; y: number; w: number; h: number }>;
};

export type Acumulador = {
  id: string;
  material_id?: string;
  material_nombre: string;
  espesor: number;
  estado: string; // abierto, cerrado, optimizado, listo_para_corte
  fecha_creacion: string;
  deadline?: string;
  capacidad_m2: number;
  m2_actuales: number;
  trabajos_ids: string[];
  plan_img_url?: string;
  plan_dxf_url?: string;
  utilization?: number;
  presupuesto_estimado?: number;
  moneda?: string;
  nombre?: string; // Optional helper field for frontend
};

export async function planificarBackend(materialId: string, width: number, height: number, trabajoIds: string[]) {
  const body = {
    material_id: materialId,
    width,
    height,
    trabajo_ids: trabajoIds,
    kerf: 3
  };
  const data = await post<BackendPlanResponse>('/api/produccion/plancha/planificar', body);
  return data;
}

export type TrabajosResponse = TrabajoPendiente[];

export async function fetchTrabajos() {
  const data = await get<any[]>('/api/trabajos');
  return Array.isArray(data) ? data.map(d => ({
    ...d,
    material: d.material_nombre || d.material_id || 'Sin material',
    piezas: Array.isArray(d.piezas)
      ? d.piezas.map((p: any) => ({
        ...p,
        ancho: p.ancho ?? p.w,
        largo: p.largo ?? p.h,
        cantidad: p.cantidad ?? p.qty ?? 1,
      }))
      : [],
    piezas_data: Array.isArray(d.piezas_data)
      ? d.piezas_data.map((p: any) => ({
        ...p,
        ancho: p.ancho ?? p.w,
        largo: p.largo ?? p.h,
        cantidad: p.cantidad ?? p.qty ?? 1,
      }))
      : d.piezas_data,
  })) : [];
}

export async function fetchAcumulados() {
  return await get<Acumulador[]>('/api/produccion/acumulados');
}

export async function crearAcumulado(payload: { nombre?: string, material_id: string, trabajos_ids: string[], placa_ancho?: number, placa_alto?: number }) {
  // Default values for plate size if not provided
  const body = {
    ...payload,
    placa_ancho: payload.placa_ancho || 300, // cm
    placa_alto: payload.placa_alto || 200    // cm
  };
  return await post<Acumulador>('/api/produccion/acumulados', body);
}

export async function generarPlanAcumulado(id: string) {
  return await post<any>(`/api/produccion/acumulados/${id}/generar-plan`, {});
}

export async function aprobarPlanAcumulado(id: string) {
  return await post<any>(`/api/produccion/acumulados/${id}/aprobar`, {});
}

export async function procesarDxf(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {};
  if (token && token !== "null" && token !== "undefined") {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/produccion/dxf/procesar', {
    method: 'POST',
    headers,
    body: formData
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const raw = await res.json();
  const piezas = Array.isArray(raw?.piezas) ? raw.piezas : [];
  const bbox = piezas.length > 0
    ? piezas.reduce(
      (acc: { width: number; height: number }, pieza: any) => ({
        width: Math.max(acc.width, Number(pieza?.x_cm || 0) + Number(pieza?.w_cm || 0)),
        height: Math.max(acc.height, Number(pieza?.y_cm || 0) + Number(pieza?.h_cm || 0)),
      }),
      { width: 0, height: 0 }
    )
    : null;

  return {
    ...raw,
    // Contrato canonico actual
    area_m2: Number(raw?.area_m2 || 0),
    metros_lineales: Number(raw?.metros_lineales || 0),
    items_validos: Number(raw?.items_validos || 0),
    // Compatibilidad con UI legacy
    total_area_m2: Number(raw?.area_m2 || raw?.total_area_m2 || 0),
    entity_count: Number(raw?.items_validos || raw?.entity_count || 0),
    layer_count: Number(raw?.layer_count || 0),
    units: raw?.detected_units || raw?.units || 'unknown',
    bbox,
    piezas,
  };
}

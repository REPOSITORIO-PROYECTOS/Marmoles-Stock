export type EstadoProduccionKanban =
  | "planificacion"
  | "en_acumulador"
  | "listo_para_corte"
  | "corte"
  | "pulido"
  | "control_calidad"
  | "listo_entrega"
  | "concluido";

const DET_ORDER = ["pendiente", "en_corte", "en_proceso", "terminado"] as const;

export type N12DetalleEstado = (typeof DET_ORDER)[number] | "rechazado";

export function aggregateN12KanbanEstado(
  detalles: { estado: string }[],
  opEstado: string,
): EstadoProduccionKanban {
  if (opEstado === "finalizado") return "concluido";
  if (!detalles.length) return "planificacion";
  if (detalles.some((d) => d.estado === "rechazado")) return "control_calidad";
  if (detalles.every((d) => d.estado === "terminado")) return "listo_entrega";
  if (detalles.some((d) => d.estado === "en_proceso")) return "pulido";
  if (detalles.some((d) => d.estado === "en_corte")) return "corte";
  return "planificacion";
}

export function columnaToN12Target(
  col: EstadoProduccionKanban,
): "pendiente" | "en_corte" | "en_proceso" | "terminado" | "cerrar_op" | null {
  if (col === "planificacion" || col === "en_acumulador" || col === "listo_para_corte") return "pendiente";
  if (col === "corte") return "en_corte";
  if (col === "pulido" || col === "control_calidad") return "en_proceso";
  if (col === "listo_entrega") return "terminado";
  if (col === "concluido") return "cerrar_op";
  return null;
}

export function nextN12DetalleToward(current: string, target: string): string {
  const i = DET_ORDER.indexOf(current as (typeof DET_ORDER)[number]);
  const t = DET_ORDER.indexOf(target as (typeof DET_ORDER)[number]);
  if (i < 0 || t < 0 || i >= t) return current;
  return DET_ORDER[i + 1];
}

export function estacionForN12Detalle(estado: string): string | undefined {
  if (estado === "en_corte") return "corte";
  if (estado === "en_proceso") return "pulido";
  if (estado === "terminado") return "terminado";
  return undefined;
}

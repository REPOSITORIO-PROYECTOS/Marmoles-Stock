import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { get, post } from '../api';
import { toast } from 'sonner';
import {
  aggregateN12KanbanEstado,
  columnaToN12Target,
  estacionForN12Detalle,
  nextN12DetalleToward,
} from '../lib/produccion/n12Kanban';

export type EstadoProduccion = 'planificacion' | 'en_acumulador' | 'listo_para_corte' | 'corte' | 'pulido' | 'control_calidad' | 'listo_entrega' | 'concluido';

export interface Piece {
  id: string;
  nombre: string;
  medidas: string;
  ubicacion: string;
  tipo: 'principal' | 'terminacion' | 'retazo';
}

export interface OrdenProduccion {
  id: string;
  presupuesto: string;
  cliente: string;
  material: string;
  lote: string;
  medidas: string;
  bacha: string;
  fechaCompromiso: string;
  estado: EstadoProduccion;
  prioridad: 'alta' | 'media' | 'baja';
  fechaInicio: string;
  piezas?: Piece[];
  notas?: string;
  acumuladoId?: string;
  /** Órdenes desde `/api/n12/op` (detalle de estados vía OPDetalle). */
  source?: 'trabajo' | 'n12';
}

interface ProduccionContextValue {
  ordenes: OrdenProduccion[];
  actualizarEstado: (ordenId: string, nuevoEstado: EstadoProduccion) => void;
  eliminarOrden: (ordenId: string) => void;
  agregarOrden: (orden: OrdenProduccion) => void;
  recargarOrdenes: () => void;
}

const ProduccionContext = createContext<ProduccionContextValue | undefined>(undefined);

type N12OpListResponse = {
  id_op: string;
  presupuesto_id: string;
  plano_id: string | null;
  estado: string;
  fecha_creacion: string;
  fecha_entrega_estimada?: string | null;
  cliente_nombre: string;
  detalles: Array<{
    id: string;
    nombre_pieza: string;
    largo_mm: number;
    ancho_mm: number;
    estado: string;
    estacion_actual: string;
  }>;
};

async function syncN12OpToColumna(opId: string, nuevoEstado: EstadoProduccion): Promise<void> {
  const target = columnaToN12Target(nuevoEstado);
  if (target === null) return;

  const detail = await get<N12OpListResponse>(`/api/n12/op/${opId}`);

  const postDetalle = async (detId: string, estado: string) => {
    const estacion = estacionForN12Detalle(estado);
    await post(`/api/n12/op/${opId}/detalle/${detId}/estado`, {
      estado,
      ...(estacion ? { estacion_actual: estacion } : {}),
    });
  };

  if (target === "cerrar_op") {
    for (const d of detail.detalles) {
      if (d.estado === "rechazado") continue;
      let cur = d.estado;
      while (cur !== "terminado") {
        const n = nextN12DetalleToward(cur, "terminado");
        if (n === cur) break;
        await postDetalle(d.id, n);
        cur = n;
      }
    }
    await post(`/api/n12/op/${opId}/cerrar`, {});
    return;
  }

  for (const d of detail.detalles) {
    if (d.estado === "rechazado") continue;
    let cur = d.estado;
    while (cur !== target) {
      const n = nextN12DetalleToward(cur, target);
      if (n === cur) break;
      await postDetalle(d.id, n);
      cur = n;
    }
  }
}

export function ProduccionProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const ordenesRef = useRef(ordenes);
  useEffect(() => {
    ordenesRef.current = ordenes;
  }, [ordenes]);

  const fetchOrdenes = async () => {
    try {
      const [data, n12raw] = await Promise.all([
        get<any[]>('/api/trabajos').catch(() => []),
        get<N12OpListResponse[]>('/api/n12/op').catch(() => []),
      ]);
      const filtrados = (Array.isArray(data) ? data : []).filter(item => item.estado !== 'pendiente_visita');

      const mapped: OrdenProduccion[] = filtrados.map(item => ({
        id: item.id,
        source: 'trabajo' as const,
        presupuesto: item.presupuesto_id ? item.presupuesto_id.slice(0, 8) : 'S/P',
        cliente: item.cliente,
        material: item.material_nombre || item.material_id,
        lote: item.lote || 'N/A',
        medidas: item.medidas_principales || 'Ver Plano',
        bacha: item.tipo_bacha || 'N/A',
        fechaCompromiso: item.fecha_compromiso || 'Sin fecha',
        estado: (() => {
          if (item.estado === 'pendiente') return 'planificacion';
          if (item.estado === 'en_acumulador') return 'en_acumulador';
          if (item.estado === 'listo_para_corte') return 'listo_para_corte';
          if (item.estado === 'corte') return 'corte';
          if (item.estado === 'pulido') return 'pulido';
          if (item.estado === 'control_calidad') return 'control_calidad';
          if (item.estado === 'concluido') return 'concluido';
          if (item.estado === 'listo_entrega' || item.estado === 'entregado') return 'listo_entrega';
          return 'planificacion';
        })() as EstadoProduccion,
        prioridad: (item.prioridad || 'media') as 'alta' | 'media' | 'baja',
        fechaInicio: item.fecha_creacion || new Date().toISOString().split('T')[0],
        notas: item.notas,
        acumuladoId: item.acumulado_id,
        piezas: item.piezas?.map((p: any) => ({
          id: p.id,
          nombre: p.nombre,
          medidas: `${p.w}x${p.h}`,
          ubicacion: p.ubicacion_estanteria || 'Taller',
          tipo: p.tipo || 'principal'
        }))
      }));

      const n12list = Array.isArray(n12raw) ? n12raw : [];
      const mappedN12: OrdenProduccion[] = n12list.map((op) => ({
        id: op.id_op,
        source: 'n12',
        presupuesto: op.presupuesto_id ? op.presupuesto_id.slice(0, 8) : 'N12',
        cliente: op.cliente_nombre || 'Cliente',
        material: 'OP N12',
        lote: op.plano_id ? String(op.plano_id).slice(0, 14) : 'N12',
        medidas: op.detalles?.length ? `${op.detalles.length} pieza(s)` : '—',
        bacha: 'N/A',
        fechaCompromiso: op.fecha_entrega_estimada || op.fecha_creacion || '—',
        estado: aggregateN12KanbanEstado(op.detalles || [], op.estado) as EstadoProduccion,
        prioridad: 'media',
        fechaInicio: op.fecha_creacion || new Date().toISOString().split('T')[0],
        piezas: (op.detalles || []).map((d) => ({
          id: d.id,
          nombre: d.nombre_pieza,
          medidas: `${d.largo_mm}×${d.ancho_mm} mm`,
          ubicacion: d.estacion_actual || '—',
          tipo: 'principal' as const,
        })),
      }));

      setOrdenes([...mappedN12, ...mapped]);
    } catch (error: any) {
      if (error?.message?.includes("401")) {
        // Silently handle 401 as api.ts will redirect to login
        return;
      }
      console.error("Error fetching ordenes:", error);
      // Fallback to empty or maybe local storage if offline
    }
  };

  useEffect(() => {
    fetchOrdenes();
  }, []);

  const actualizarEstado = async (ordenId: string, nuevoEstado: EstadoProduccion) => {
    const ordenActual = ordenesRef.current.find((o) => o.id === ordenId);

    if (ordenActual?.source === 'n12') {
      setOrdenes((prev) => prev.map((o) => (o.id === ordenId ? { ...o, estado: nuevoEstado } : o)));
      try {
        await syncN12OpToColumna(ordenId, nuevoEstado);
        await fetchOrdenes();
      } catch (error) {
        console.error("Error updating N12 OP:", error);
        toast.error("Error al actualizar OP N12 (revise transiciones de detalle)");
        await fetchOrdenes();
      }
      return;
    }

    setOrdenes((prev) => prev.map((o) => (o.id === ordenId ? { ...o, estado: nuevoEstado } : o)));

    try {
      await post(`/api/produccion/orden/${ordenId}/actualizar-estado`, { nuevo_estado: nuevoEstado });
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Error al actualizar estado en servidor");
      fetchOrdenes(); // Revert
    }
  };

  const eliminarOrden = (ordenId: string) => {
    // TODO: Implement delete API if needed. For now just UI remove? 
    // Usually we don't delete production orders easily.
    setOrdenes((prev) => prev.filter((o) => o.id !== ordenId));
  };

  const agregarOrden = (orden: OrdenProduccion) => {
    // This is mostly used for local mock. 
    // In real app, orders come from backend. 
    // But we can keep it for optimistic add if needed.
    setOrdenes((prev) => [orden, ...prev]);
  };

  return (
    <ProduccionContext.Provider value={{ ordenes, actualizarEstado, eliminarOrden, agregarOrden, recargarOrdenes: fetchOrdenes }}>
      {children}
    </ProduccionContext.Provider>
  );
}

export function useProduccion() {
  const ctx = useContext(ProduccionContext);
  if (!ctx) throw new Error('useProduccion debe usarse dentro de ProduccionProvider');
  return ctx;
}

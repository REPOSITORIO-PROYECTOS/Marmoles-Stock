import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { get, post } from '../api';
import { toast } from 'sonner';

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
}

interface ProduccionContextValue {
  ordenes: OrdenProduccion[];
  actualizarEstado: (ordenId: string, nuevoEstado: EstadoProduccion) => void;
  eliminarOrden: (ordenId: string) => void;
  agregarOrden: (orden: OrdenProduccion) => void;
  recargarOrdenes: () => void;
}

const ProduccionContext = createContext<ProduccionContextValue | undefined>(undefined);

export function ProduccionProvider({ children }: { children: ReactNode }) {
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);

  const fetchOrdenes = async () => {
    try {
      const data = await get<any[]>('/api/trabajos');
      const filtrados = data.filter(item => item.estado !== 'pendiente_visita');

      const mapped: OrdenProduccion[] = filtrados.map(item => ({
        id: item.id,
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
      setOrdenes(mapped);
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
    // Optimistic update
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

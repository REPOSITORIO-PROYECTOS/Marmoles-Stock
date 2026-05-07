import { useCallback, useMemo, useState } from 'react';
import { get, post, patch } from '../api';
import { toast } from 'sonner';

export type MaterialMaestro = {
  id: string;
  nombre: string;
  precio_m2: number;
  precio_mayor_m2?: number | null;
  unidad?: string;
  activo?: boolean;
};

export type ExtraMaestro = {
  id: string;
  nombre: string;
  precio_base: number;
  unidad?: string;
  /** extra_pieza | ExtraPresupuesto u otras incluidas en el maestro */
  categoria?: string | null;
};

export type ProductoAdicionalMaestro = {
  id: string;
  nombre: string;
  precio_venta: number;
  categoria?: string | null;
};

export function usePresupuestoMaestros() {
  const [loading, setLoading] = useState(false);

  const fetchMateriales = useCallback(async () => {
    const rows = await get<MaterialMaestro[]>('/api/presupuestos/maestros/materiales');
    return Array.isArray(rows) ? rows : [];
  }, []);

  const fetchExtras = useCallback(async (soloExtraPieza = true) => {
    const q = soloExtraPieza ? '' : '?solo_extra_pieza=false';
    const rows = await get<ExtraMaestro[]>(`/api/presupuestos/maestros/extras${q}`);
    return Array.isArray(rows) ? rows : [];
  }, []);

  const fetchProductosAdicionales = useCallback(async () => {
    const rows = await get<ProductoAdicionalMaestro[]>('/api/presupuestos/maestros/productos-adicionales');
    return Array.isArray(rows) ? rows : [];
  }, []);

  const crearMaterial = useCallback(async (body: { nombre: string; precio_m2: number; unidad?: string; stock_actual?: number }) => {
    const m = await post<MaterialMaestro>('/api/presupuestos/maestros/materiales', {
      nombre: body.nombre,
      precio_m2: body.precio_m2,
      unidad: body.unidad || 'm²',
      stock_actual: body.stock_actual ?? 0,
    });
    toast.success('Material creado');
    return m;
  }, []);

  const patchPrecioMaterial = useCallback(async (id: string, precio_m2: number, precio_mayor_m2?: number | null) => {
    await patch(`/api/presupuestos/maestros/materiales/${id}/precio`, {
      precio_m2,
      ...(precio_mayor_m2 != null ? { precio_mayor_m2 } : {}),
    });
    toast.success('Precio actualizado en catálogo');
  }, []);

  const crearExtra = useCallback(async (nombre: string, precio_base: number, unidad = 'unidad') => {
    const s = await post<ExtraMaestro & { id: string }>('/api/presupuestos/maestros/extras', {
      nombre,
      precio_base,
      unidad,
    });
    toast.success('Extra agregado al catálogo');
    return s;
  }, []);

  const patchPrecioExtra = useCallback(async (id: string, precio_base: number) => {
    await patch(`/api/presupuestos/maestros/extras/${id}/precio`, { precio_base });
    toast.success('Precio de extra actualizado');
  }, []);

  const crearProductoAdicional = useCallback(async (nombre: string, precio_venta: number, descripcion?: string) => {
    const p = await post<ProductoAdicionalMaestro & { id: string }>(
      '/api/presupuestos/maestros/productos-adicionales',
      {
        nombre,
        precio_venta,
        descripcion: descripcion || undefined,
      },
    );
    toast.success('Producto adicional creado');
    return p;
  }, []);

  const patchPrecioProducto = useCallback(async (id: string, precio_venta: number) => {
    await patch(`/api/presupuestos/maestros/productos-adicionales/${id}/precio`, { precio_venta });
    toast.success('Precio actualizado');
  }, []);

  const withLoading = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    try {
      return await fn();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Error de red');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return useMemo(
    () => ({
      loading,
      withLoading,
      fetchMateriales,
      fetchExtras,
      fetchProductosAdicionales,
      crearMaterial,
      patchPrecioMaterial,
      crearExtra,
      patchPrecioExtra,
      crearProductoAdicional,
      patchPrecioProducto,
    }),
    [
      loading,
      withLoading,
      fetchMateriales,
      fetchExtras,
      fetchProductosAdicionales,
      crearMaterial,
      patchPrecioMaterial,
      crearExtra,
      patchPrecioExtra,
      crearProductoAdicional,
      patchPrecioProducto,
    ],
  );
}

import { useState, useEffect, useCallback } from 'react';
import { get, post } from '../../../api';
import { ProductoEstatico, NuevoProductoForm } from '../types/compras.types';
import { notifySuccess, notifyError } from '../../../utils/notifications';

export const useProductosEstaticos = () => {
    const [productos, setProductos] = useState<ProductoEstatico[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProductos = useCallback(async () => {
        try {
            setLoading(true);
            const data = await get<ProductoEstatico[]>('/api/productos-estaticos');
            setProductos(data || []);
        } catch (err) {
            console.error('Error cargando productos:', err);
            setProductos([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProductos();
    }, [fetchProductos]);

    const crearProducto = useCallback(async (form: NuevoProductoForm): Promise<boolean> => {
        if (!form.nombre.trim()) {
            notifyError('Nombre es requerido');
            return false;
        }
        if (form.precio_venta <= 0) {
            notifyError('Precio debe ser mayor a 0');
            return false;
        }

        try {
            await post(`/api/productos-estaticos?nombre=${encodeURIComponent(form.nombre)}&precio_venta=${form.precio_venta}&descripcion=${encodeURIComponent(form.descripcion || '')}&categoria=${encodeURIComponent(form.categoria)}`);
            await fetchProductos();
            notifySuccess('Producto creado');
            return true;
        } catch (err: any) {
            notifyError(err?.message || 'Error al guardar producto');
            return false;
        }
    }, [fetchProductos]);

    return {
        productos,
        loading,
        fetchProductos,
        crearProducto,
    };
};

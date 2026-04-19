import { useState, useEffect, useCallback } from 'react';
import { get } from '../../../api';
import { Compra } from '../types/compras.types';

export const useCompras = () => {
    const [compras, setCompras] = useState<Compra[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCompras = useCallback(async () => {
        try {
            setLoading(true);
            const data = await get<Compra[]>('/api/compras');
            setCompras(data || []);
        } catch (err) {
            console.error('Error cargando compras:', err);
            setCompras([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCompras();
    }, [fetchCompras]);

    return {
        compras,
        loading,
        fetchCompras,
    };
};

import { useState, useEffect, useCallback } from 'react';
import { get, post } from '../../../api';
import { Proveedor, NuevoProveedorForm } from '../types/compras.types';
import { normalizarNombre, emailValido, telefonoValido } from '../utils/comprasUtils';
import { notifySuccess, notifyError } from '../../../utils/notifications';

export const useProveedores = () => {
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProveedores = useCallback(async () => {
        try {
            setLoading(true);
            const data = await get<Proveedor[]>('/api/proveedores');
            setProveedores(data || []);
        } catch (err) {
            console.error('Error cargando proveedores:', err);
            setProveedores([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProveedores();
    }, [fetchProveedores]);

    const crearProveedor = useCallback(async (form: NuevoProveedorForm): Promise<boolean> => {
        if (!form.nombre.trim()) {
            notifyError('Nombre del proveedor es requerido');
            return false;
        }
        if (form.email && !emailValido(form.email)) {
            notifyError('Email inválido');
            return false;
        }
        if (form.telefono && !telefonoValido(form.telefono)) {
            notifyError('Teléfono inválido (mínimo 6 caracteres)');
            return false;
        }

        const existe = proveedores.find(p => normalizarNombre(p.nombre) === normalizarNombre(form.nombre));
        if (existe) {
            notifyError('Ese proveedor ya existe');
            return false;
        }

        try {
            await post('/api/proveedores', {
                nombre: form.nombre,
                contacto: form.contacto || '',
                telefono: form.telefono || '',
                email: form.email || '',
                direccion: form.especialidad || ''
            });

            await fetchProveedores();
            notifySuccess(`Proveedor "${form.nombre}" creado y seleccionado`);
            return true;
        } catch (err: any) {
            notifyError(err?.message || 'Error al crear proveedor');
            return false;
        }
    }, [proveedores, fetchProveedores]);

    const editarProveedor = useCallback(async (id: string, form: NuevoProveedorForm): Promise<boolean> => {
        if (!form.nombre.trim()) {
            notifyError('Nombre del proveedor es requerido');
            return false;
        }
        if (form.email && !emailValido(form.email)) {
            notifyError('Email inválido');
            return false;
        }
        if (form.telefono && !telefonoValido(form.telefono)) {
            notifyError('Teléfono inválido (mínimo 6 caracteres)');
            return false;
        }

        try {
            const response = await post(`/api/proveedores/${id}`, {
                nombre: form.nombre,
                contacto: form.contacto || '',
                telefono: form.telefono || '',
                email: form.email || '',
                direccion: form.especialidad || ''
            });

            if (!response) {
                notifyError('Proveedor no encontrado');
                return false;
            }

            await fetchProveedores();
            notifySuccess(`Proveedor "${form.nombre}" actualizado correctamente`);
            return true;
        } catch (err: any) {
            notifyError(err?.message || 'Error al actualizar proveedor');
            return false;
        }
    }, [fetchProveedores]);

    const eliminarProveedor = useCallback(async (id: string, nombre: string): Promise<boolean> => {
        try {
            const response = await post(`/api/proveedores/${id}/delete`, {});

            if (!response) {
                notifyError('Proveedor no encontrado');
                return false;
            }

            await fetchProveedores();
            notifySuccess(`Proveedor "${nombre}" eliminado correctamente`);
            return true;
        } catch (err: any) {
            notifyError(err?.message || 'Error al eliminar proveedor');
            return false;
        }
    }, [fetchProveedores]);

    return {
        proveedores,
        loading,
        fetchProveedores,
        crearProveedor,
        editarProveedor,
        eliminarProveedor,
    };
};

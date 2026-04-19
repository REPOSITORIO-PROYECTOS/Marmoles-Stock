import { useState, useCallback, useEffect } from 'react';
import { post, get } from '../../../api';
import { TipoCompra, NuevaCompraForm, Material, ProductoEstatico, LoteBasic } from '../types/compras.types';
import { calcularAreaM2, normalizarNombre } from '../utils/comprasUtils';
import { notifySuccess, notifyError } from '../../../utils/notifications';

interface UseNuevaCompraProps {
    materiales: Material[];
    productosEstaticos: ProductoEstatico[];
    onCompraRegistrada: () => void;
}

const initialForm: NuevaCompraForm = {
    proveedor: '',
    material: '',
    producto: '',
    ancho_m: 0,
    alto_m: 0,
    lote: '',
    costo_m2: 0,
    monto_total: 0,
    costoMode: 'costo_m2',
    precio_venta_tipo: 'fijo',
    precio_venta_valor: 0,
    precio_venta_menor: 0,
    precio_venta_mayor: 0,
    porcentaje_ganancia: 0,
    metodo_pago: 'Transferencia',
    cantidad_producto: 1,
    cantidad_placas: 1,  // Cambio: fue 10, ahora 1 para ser consistente con el placeholder
    ubicacion: ''
};

export const useNuevaCompra = ({ materiales, productosEstaticos, onCompraRegistrada }: UseNuevaCompraProps) => {
    const [tipoCompra, setTipoCompra] = useState<TipoCompra>('material');
    const [form, setForm] = useState<NuevaCompraForm>(initialForm);
    const [loteActivo, setLoteActivo] = useState('');
    const [lotesDisponibles, setLotesDisponibles] = useState<LoteBasic[]>([]);
    const [loadingLotes, setLoadingLotes] = useState(false);

    const areaM2 = calcularAreaM2(form.ancho_m, form.alto_m);

    // Cargar lotes cuando cambia el material
    useEffect(() => {
        const fetchLotes = async () => {
            if (!form.material || tipoCompra !== 'material') {
                setLotesDisponibles([]);
                return;
            }

            // Evitar recargar si es el mismo material (aunque aquí dependemos del string nombre)
            // Podríamos optimizar, pero por ahora está bien.

            try {
                setLoadingLotes(true);
                // Usamos el endpoint que busca por nombre de material si no tenemos ID directo fácil
                // El endpoint es /api/lotes?material_nombre=...
                const lotes = await get<LoteBasic[]>(`/api/lotes?material_nombre=${encodeURIComponent(form.material)}`);
                setLotesDisponibles(lotes || []);
            } catch (error) {
                console.error("Error cargando lotes:", error);
                setLotesDisponibles([]);
            } finally {
                setLoadingLotes(false);
            }
        };

        const timeoutId = setTimeout(fetchLotes, 300); // Debounce pequeño
        return () => clearTimeout(timeoutId);
    }, [form.material, tipoCompra]);

    const materialSeleccionado = materiales.find(m =>
        normalizarNombre(m.nombre) === normalizarNombre(form.material)
    );

    const productoSeleccionado = productosEstaticos.find(p =>
        normalizarNombre(p.nombre) === normalizarNombre(form.producto)
    );

    const updateForm = useCallback((updates: Partial<NuevaCompraForm>) => {
        setForm(prev => {
            const newState = { ...prev, ...updates };

            // Auto-cálculos para material
            if (tipoCompra === 'material') {
                const area = calcularAreaM2(newState.ancho_m, newState.alto_m);

                // Si cambia el modo de costo, limpiar ambos campos
                if ('costoMode' in updates) {
                    newState.costo_m2 = 0;
                    newState.monto_total = 0;
                }

                // CASO 1: Modo costo_m2 -> calcular monto total
                if (newState.costoMode === 'costo_m2') {
                    if (('costo_m2' in updates || 'ancho_m' in updates || 'alto_m' in updates) && area > 0 && newState.costo_m2 > 0) {
                        newState.monto_total = Number((area * newState.costo_m2).toFixed(2));
                    }
                }

                // CASO 2: Modo monto_total -> calcular costo m2
                if (newState.costoMode === 'monto_total') {
                    if (('monto_total' in updates || 'ancho_m' in updates || 'alto_m' in updates) && area > 0 && newState.monto_total > 0) {
                        newState.costo_m2 = Number((newState.monto_total / area).toFixed(2));
                    }
                }

                // CASO 3: Cálculo automático de Ganancia / Precio Venta
                // Si cambia el tipo de precio, limpiar valores anteriores
                if ('precio_venta_tipo' in updates) {
                    newState.precio_venta_valor = 0;
                    newState.porcentaje_ganancia = 0;
                }

                // Si el usuario está en modo 'fijo' y cambia el precio de venta -> calcular % ganancia
                if (newState.precio_venta_tipo === 'fijo') {
                    if ('precio_venta_valor' in updates && newState.costo_m2 > 0) {
                        const precio = newState.precio_venta_valor;
                        const costo = newState.costo_m2;
                        if (costo > 0) {
                            newState.porcentaje_ganancia = Number((((precio - costo) / costo) * 100).toFixed(2));
                        }
                    }
                }
                // Si el usuario está en modo 'porcentaje' y cambia el % -> calcular precio venta
                else if (newState.precio_venta_tipo === 'porcentaje') {
                    if ('porcentaje_ganancia' in updates && newState.costo_m2 > 0) {
                        const pct = newState.porcentaje_ganancia;
                        const costo = newState.costo_m2;
                        newState.precio_venta_valor = Number((costo * (1 + pct / 100)).toFixed(2));
                    }
                }
            }

            return newState;
        });
    }, [tipoCompra]);

    const resetForm = useCallback((mantenerProveedor = true) => {
        setForm(prev => ({
            ...initialForm,
            proveedor: mantenerProveedor ? prev.proveedor : ''
        }));
        setLoteActivo('');
    }, []);

    const cambiarTipoCompra = useCallback((tipo: TipoCompra) => {
        setTipoCompra(tipo);
        if (tipo === 'material') {
            updateForm({ producto: '', cantidad_producto: 1 });
        } else {
            updateForm({ material: '', lote: '' });
            setLoteActivo('');
        }
    }, [updateForm]);

    const registrarCompra = useCallback(async (): Promise<boolean> => {
        // Validaciones comunes
        if (!form.proveedor || !form.proveedor.trim()) {
            notifyError('Selecciona un proveedor');
            return false;
        }

        if (tipoCompra === 'material') {
            // Validaciones para material
            if (!form.material || !form.material.trim()) {
                notifyError('Selecciona o crea un material');
                return false;
            }
            if (!form.lote || !form.lote.trim()) {
                notifyError('Ingresa un número de lote');
                return false;
            }
            if (areaM2 <= 0) {
                notifyError('Ancho y alto deben ser mayores a 0');
                return false;
            }
            if (form.costo_m2 <= 0) {
                notifyError('Costo m² debe ser mayor a 0');
                return false;
            }
            if ((form.precio_venta_menor || 0) <= 0 || (form.precio_venta_mayor || 0) <= 0) {
                notifyError('Debes ingresar precio por menor y mayor m²');
                return false;
            }

            try {
                const fecha = new Date().toISOString().split('T')[0];
                const cantidadPlacas = form.cantidad_placas || 1;
                const monto = form.costo_m2 * areaM2 * cantidadPlacas;

                await post('/api/compras', {
                    proveedor: form.proveedor,
                    material: form.material,
                    cantidad: cantidadPlacas,
                    monto: monto,
                    fecha: fecha,
                    // Persistir ambos precios: menor y mayor
                    precio_m2: (form.precio_venta_menor ?? form.precio_venta_valor),
                    precio_mayor_m2: (form.precio_venta_mayor ?? form.precio_venta_valor),
                    costo_m2: form.costo_m2,
                    lote: form.lote,
                    ancho_m: form.ancho_m,
                    largo_m: form.alto_m
                });

                // Disparar evento
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('marmoles:compra-registrada', {
                        detail: {
                            material: form.material,
                            costo_m2: form.costo_m2,
                            precio_m2: form.precio_venta_menor ?? form.precio_venta_valor,
                            precio_mayor_m2: form.precio_venta_mayor ?? form.precio_venta_valor,
                            fecha,
                            lote: form.lote,
                            ancho_m: form.ancho_m,
                            alto_m: form.alto_m,
                            area_m2: areaM2,
                            monto
                        }
                    }));
                }

                onCompraRegistrada();
                resetForm(true);
                notifySuccess(`Compra del lote "${form.lote}" registrada correctamente`);
                return true;
            } catch (err: any) {
                notifyError(err?.message || 'Error al registrar compra');
                return false;
            }
        } else {
            // Validaciones para producto
            if (!form.producto || !form.producto.trim()) {
                notifyError('Selecciona un producto');
                return false;
            }
            if (form.cantidad_producto <= 0) {
                notifyError('Cantidad debe ser mayor a 0');
                return false;
            }
            if (form.cantidad_placas <= 0) {
                notifyError('Cantidad de placas debe ser mayor a 0');
                return false;
            }

            try {
                const monto = (productoSeleccionado?.precio_venta || 0) * form.cantidad_producto * form.cantidad_placas;
                const fecha = new Date().toISOString().split('T')[0];
                const totalPlacas = form.cantidad_producto * form.cantidad_placas;

                await post('/api/compras', {
                    proveedor: form.proveedor,
                    material: `${form.producto} (${form.cantidad_producto} x ${form.cantidad_placas} placas = ${totalPlacas})`,
                    cantidad: totalPlacas,
                    monto: monto,
                    fecha: fecha,
                    precio_m2: productoSeleccionado?.precio_venta || 0
                });

                // Disparar evento
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('marmoles:compra-registrada', {
                        detail: {
                            tipo: 'producto',
                            producto: form.producto,
                            cantidad: form.cantidad_producto,
                            cantidad_placas: form.cantidad_placas,
                            total_placas: totalPlacas,
                            precio_unitario: productoSeleccionado?.precio_venta,
                            fecha,
                            monto
                        }
                    }));
                }

                onCompraRegistrada();
                resetForm(true);
                notifySuccess(`Compra de ${form.cantidad_producto} x ${form.cantidad_placas} = ${totalPlacas} placas de ${form.producto} registrada`);
                return true;
            } catch (err: any) {
                notifyError(err?.message || 'Error al registrar compra');
                return false;
            }
        }
    }, [tipoCompra, form, areaM2, productoSeleccionado, onCompraRegistrada, resetForm]);

    return {
        tipoCompra,
        form,
        loteActivo,
        areaM2,
        materialSeleccionado,
        productoSeleccionado,
        lotesDisponibles,
        loadingLotes,
        setTipoCompra: cambiarTipoCompra,
        updateForm,
        setLoteActivo,
        resetForm,
        registrarCompra,
    };
};

import { useState, useEffect } from 'react';
import { get, post } from '../../api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useCompras } from './hooks/useCompras';
import { useProveedores } from './hooks/useProveedores';
import { useProductosEstaticos } from './hooks/useProductosEstaticos';
import { useNuevaCompra } from './hooks/useNuevaCompra';
import { Material, NuevoMaterialForm } from './types/compras.types';
import { TabHistorial } from './components/compras/TabHistorial';
import { TabProveedores } from './components/compras/TabProveedores';
import { TabProductos } from './components/compras/TabProductos';
import { FormularioCompra } from './components/compras/FormularioCompra';
import { DialogCrearMaterial } from './components/compras/DialogCrearMaterial';
import { notifySuccess, notifyError } from '../../utils/notifications';

export function ComprasProveedoresRefactored() {
    const [tab, setTab] = useState<'compras' | 'proveedores' | 'productos' | 'historial'>('compras');
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);

    const { compras, loading: loadingCompras, fetchCompras } = useCompras();
    const { proveedores, loading: loadingProveedores, crearProveedor, editarProveedor, eliminarProveedor } = useProveedores();
    const { productos, loading: loadingProductos, fetchProductos, crearProducto } = useProductosEstaticos();

    const handleCompraRegistrada = async () => {
        await Promise.all([
            fetchCompras(),
            cargarMateriales()
        ]);
        setTab('historial');
    };

    const nuevaCompra = useNuevaCompra({
        materiales,
        productosEstaticos: productos,
        onCompraRegistrada: handleCompraRegistrada
    });

    const cargarMateriales = async () => {
        try {
            const data = await get<Material[]>('/api/materiales');
            setMateriales(data || []);
        } catch (err) {
            console.error('Error cargando materiales:', err);
        }
    };

    const handleCrearMaterial = async (form: NuevoMaterialForm) => {
        try {
            await post('/api/materiales', {
                nombre: form.nombre,
                espesor_mm: form.espesor_mm,
                ancho_m: form.ancho_m,
                alto_m: form.alto_m,
                precio_m2: 0 // Se actualizará con la primera compra
            });
            notifySuccess('Material creado exitosamente');
            await cargarMateriales();
            // Despachar evento para que GestionInventario se actualice
            window.dispatchEvent(new Event('marmoles:material-creado'));
        } catch (error: any) {
            notifyError(error?.message || 'Error al crear material');
            throw error;
        }
    };

    useEffect(() => {
        cargarMateriales();
    }, []);

    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-foreground mb-2">Compras y Proveedores</h1>
                <p className="text-muted-foreground">Gestión centralizada de compras, materiales, productos y proveedores</p>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-6">
                <TabsList>
                    <TabsTrigger value="compras">Registrar Compra</TabsTrigger>
                    <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
                    <TabsTrigger value="productos">Stock de Insumos</TabsTrigger>
                    <TabsTrigger value="historial">Historial</TabsTrigger>
                </TabsList>

                <TabsContent value="compras">
                    <FormularioCompra
                        proveedores={proveedores}
                        materiales={materiales}
                        productosEstaticos={productos}
                        onRegistrarCompra={nuevaCompra.registrarCompra}
                        tipoCompra={nuevaCompra.tipoCompra}
                        form={nuevaCompra.form}
                        areaM2={nuevaCompra.areaM2}
                        loteActivo={nuevaCompra.loteActivo}
                        materialSeleccionado={nuevaCompra.materialSeleccionado}
                        productoSeleccionado={nuevaCompra.productoSeleccionado}
                        updateForm={nuevaCompra.updateForm}
                        cambiarTipoCompra={nuevaCompra.setTipoCompra}
                        onCrearMaterial={() => setIsMaterialDialogOpen(true)}
                        lotesDisponibles={nuevaCompra.lotesDisponibles}
                        loadingLotes={nuevaCompra.loadingLotes}
                    />
                </TabsContent>

                <TabsContent value="proveedores">
                    <TabProveedores
                        proveedores={proveedores}
                        onCrearProveedor={crearProveedor}
                        onEditarProveedor={editarProveedor}
                        onEliminarProveedor={eliminarProveedor}
                        loading={loadingProveedores}
                    />
                </TabsContent>

                <TabsContent value="productos">
                    <TabProductos
                        productos={productos}
                        onCrearProducto={crearProducto}
                        loading={loadingProductos}
                    />
                </TabsContent>

                <TabsContent value="historial">
                    <TabHistorial
                        compras={compras}
                        loading={loadingCompras}
                    />
                </TabsContent>
            </Tabs>

            <DialogCrearMaterial
                isOpen={isMaterialDialogOpen}
                onClose={() => setIsMaterialDialogOpen(false)}
                onCrearMaterial={handleCrearMaterial}
            />
        </div>
    );
}

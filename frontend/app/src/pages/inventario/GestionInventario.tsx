import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Package } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { useMateriales } from './hooks/useMateriales';
import { useLotes } from './hooks/useLotes';
import { MaterialFilters } from './components/MaterialFilters';
import { MaterialesTable } from './components/MaterialesTable';
import { DeleteMaterialDialog } from './components/DeleteMaterialDialog';
import { normalizarNombre } from './utils/materialUtils';
import { Material } from './types';
import { useProductosEstaticos } from './hooks/useProductosEstaticos';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { del, get } from '../../api';
import { toast } from 'sonner';

export function GestionInventario() {
  const [materialParaEliminar, setMaterialParaEliminar] = useState<Material | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vista, setVista] = useState<'materiales' | 'productos'>('materiales');
  const [articulos, setArticulos] = useState<any[]>([]);
  const [extrasCatalogo, setExtrasCatalogo] = useState<any[]>([]);
  const [loadingInsumos, setLoadingInsumos] = useState(false);

  const {
    allMateriales,
    filteredMateriales,
    precioCostoPorNombre,
    highlightNombre,
    searchTerm,
    setSearchTerm,
    handleToggleDisponibilidad,
    handleEliminarMaterial,
  } = useMateriales();

  const {
    expandedMaterials,
    lotesPorMaterial,
    loadingLotes,
    toggleExpand,
    fetchLotesForMaterial,
  } = useLotes(allMateriales);
  const { productos, loading: loadingProductos, fetchProductos } = useProductosEstaticos();

  // Scroll al material resaltado
  useEffect(() => {
    const key = normalizarNombre(highlightNombre || '');
    try {
      const el = document.querySelector(`[data-material-key="${key}"]`) as HTMLElement | null;
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch { }
  }, [highlightNombre]);

  const handleEliminarClick = (material: Material) => {
    setMaterialParaEliminar(material);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async (material: Material) => {
    await handleEliminarMaterial(material);
    setShowDeleteConfirm(false);
    setMaterialParaEliminar(null);
  };

  const handleEliminarLote = async (material: Material, loteId: string) => {
    if (!loteId) return;
    if (!confirm('¿Eliminar este lote?')) return;
    try {
      await del(`/api/lotes/${loteId}`);
      toast.success('Lote eliminado correctamente');
      await fetchLotesForMaterial(material);
    } catch (error: any) {
      const errorMsg = error?.detail || error?.message || 'No se pudo eliminar el lote';
      toast.error(errorMsg);
      console.error('Error al eliminar lote:', error);
    }
  };

  const handleActualizarLote = async (material: Material) => {
    await fetchLotesForMaterial(material);
  };

  const fetchInsumos = async () => {
    setLoadingInsumos(true);
    setArticulos([]);
    setExtrasCatalogo([]);
    try {
      const arts = await get<any[]>('/api/articulos');
      setArticulos(Array.isArray(arts) ? arts : []);
    } catch {
      setArticulos([]);
    }
    try {
      const extras = await get<any[]>('/api/servicios?categoria=ExtraPresupuesto');
      setExtrasCatalogo(Array.isArray(extras) ? extras : []);
    } catch {
      setExtrasCatalogo([]);
    } finally {
      setLoadingInsumos(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader
        icon={Package}
        title="Gestión de Inventario"
        description="Control de materiales y niveles de stock"
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <MaterialFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {/* Toggle de vista: Materiales vs Stock de Insumos */}
        <div className="mb-4">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <Button
              variant={vista === 'materiales' ? 'default' : 'outline'}
              onClick={() => setVista('materiales')}
              className="rounded-none"
            >
              Stock de Materiales
            </Button>
            <Button
              variant={vista === 'productos' ? 'default' : 'outline'}
              onClick={() => {
                setVista('productos');
                fetchProductos();
                fetchInsumos();
              }}
              className="rounded-none border-l"
            >
              Stock de Insumos
            </Button>
          </div>
        </div>

        {/* Contenido según vista */}
        {vista === 'materiales' ? (
          <>
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 items-start">
              <Card className="border-border hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm">Total Materiales</CardTitle>
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-primary text-2xl">{allMateriales.length}</div>
                  <p className="text-muted-foreground text-sm mt-1">En inventario</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabla de materiales */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <MaterialesTable
                  materiales={filteredMateriales}
                  expandedMaterials={expandedMaterials}
                  lotesPorMaterial={lotesPorMaterial}
                  loadingLotes={loadingLotes}
                  precioCostoPorNombre={precioCostoPorNombre}
                  highlightNombre={highlightNombre}
                  onToggleExpand={toggleExpand}
                  onToggleDisponibilidad={handleToggleDisponibilidad}
                  onEliminar={handleEliminarClick}
                  onEliminarLote={handleEliminarLote}
                />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Lista de Stock de Insumos */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Stock de Insumos</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingProductos ? (
                  <div className="text-sm text-muted-foreground">Cargando productos…</div>
                ) : loadingInsumos ? (
                  <div className="text-sm text-muted-foreground">Cargando artículos y extras…</div>
                ) : productos.length === 0 && articulos.length === 0 && extrasCatalogo.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay insumos activos</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Artículos</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Precio</TableHead>
                            <TableHead>Categoría</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {articulos.map((p) => (
                            <TableRow key={`art-${p.id}`}>
                              <TableCell className="font-medium">{p.nombre}</TableCell>
                              <TableCell>{p.descripcion || '-'}</TableCell>
                              <TableCell>${Number(p.precio_unitario || 0).toLocaleString()}</TableCell>
                              <TableCell>{p.categoria || '-'}</TableCell>
                            </TableRow>
                          ))}
                          {articulos.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-sm text-muted-foreground">Sin artículos activos.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-2">Extras de presupuesto (opcional)</h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        Si el módulo comercial está desactivado en el servidor, esta lista puede quedar vacía.
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Precio</TableHead>
                            <TableHead>Unidad</TableHead>
                            <TableHead>Categoría</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {extrasCatalogo.map((e) => (
                            <TableRow key={`ext-${e.id}`}>
                              <TableCell className="font-medium">{e.nombre}</TableCell>
                              <TableCell>${Number(e.precio_base || 0).toLocaleString()}</TableCell>
                              <TableCell>{e.unidad || 'u'}</TableCell>
                              <TableCell>{e.categoria || 'ExtraPresupuesto'}</TableCell>
                            </TableRow>
                          ))}
                          {extrasCatalogo.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-sm text-muted-foreground">Sin extras activos.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
      <DeleteMaterialDialog
        open={showDeleteConfirm}
        material={materialParaEliminar}
        onClose={() => {
          setShowDeleteConfirm(false);
          setMaterialParaEliminar(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

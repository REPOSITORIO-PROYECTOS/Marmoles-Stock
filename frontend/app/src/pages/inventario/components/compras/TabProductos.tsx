import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { Plus, Package } from 'lucide-react';
import type { ProductoEstatico, NuevoProductoForm } from '../../types/compras.types';

interface TabProductosProps {
    productos: ProductoEstatico[];
    onCrearProducto: (form: NuevoProductoForm) => Promise<boolean>;
    loading: boolean;
}

export function TabProductos({ productos, onCrearProducto, loading }: TabProductosProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<NuevoProductoForm>({
        nombre: '',
        descripcion: '',
        precio_venta: 0,
        categoria: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onCrearProducto(form);
            setForm({ nombre: '', descripcion: '', precio_venta: 0, categoria: '' });
            setIsDialogOpen(false);
        } catch (error) {
            // Error ya manejado en el hook
        } finally {
            setIsSaving(false);
        }
    };

    const updateForm = (updates: Partial<NuevoProductoForm>) => {
        setForm(prev => ({ ...prev, ...updates }));
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-8">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="ml-3 text-muted-foreground">Cargando productos...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Stock de Insumos
                </CardTitle>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <Button onClick={() => setIsDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Producto
                    </Button>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Insumo</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="nombre">Nombre *</Label>
                                <Input
                                    id="nombre"
                                    value={form.nombre}
                                    onChange={(e) => updateForm({ nombre: e.target.value })}
                                    placeholder="Ej: Bisagra de acero inoxidable"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="descripcion">Descripción</Label>
                                <Input
                                    id="descripcion"
                                    value={form.descripcion}
                                    onChange={(e) => updateForm({ descripcion: e.target.value })}
                                    placeholder="Descripción del producto"
                                />
                            </div>

                            <div>
                                <Label htmlFor="precio">Precio de Venta *</Label>
                                <Input
                                    id="precio"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={form.precio_venta || ''}
                                    onChange={(e) => updateForm({ precio_venta: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="categoria">Categoría *</Label>
                                <Input
                                    id="categoria"
                                    value={form.categoria}
                                    onChange={(e) => updateForm({ categoria: e.target.value })}
                                    placeholder="Ej: Herrajes, Adhesivos, Herramientas"
                                    required
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                    disabled={isSaving}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSaving || !form.nombre || !form.categoria || form.precio_venta <= 0}
                                    className="flex-1"
                                >
                                    {isSaving ? 'Guardando...' : 'Crear Producto'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {productos.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No hay insumos registrados</p>
                        <p className="text-sm mt-2">Los productos aparecerán aquí después de crearlos</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Precio Venta</TableHead>
                                <TableHead>Categoría</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {productos.map((producto) => (
                                <TableRow key={producto.id}>
                                    <TableCell className="font-medium">{producto.nombre}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {producto.descripcion || '-'}
                                    </TableCell>
                                    <TableCell className="font-semibold text-success">
                                        ${producto.precio_venta.toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-block px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                                            {producto.categoria}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

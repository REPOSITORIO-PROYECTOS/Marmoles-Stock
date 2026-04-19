import { useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import type { NuevoProductoForm } from '../../types/compras.types';

interface DialogCrearProductoProps {
    isOpen: boolean;
    onClose: () => void;
    onCrearProducto: (form: NuevoProductoForm) => Promise<void>;
}

export function DialogCrearProducto({ isOpen, onClose, onCrearProducto }: DialogCrearProductoProps) {
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
            onClose();
        } catch (error) {
            // Error ya manejado en el callback
        } finally {
            setIsSaving(false);
        }
    };

    const updateForm = (updates: Partial<NuevoProductoForm>) => {
        setForm(prev => ({ ...prev, ...updates }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Insumo</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="prod-nombre">Nombre del Producto *</Label>
                        <Input
                            id="prod-nombre"
                            value={form.nombre}
                            onChange={(e) => updateForm({ nombre: e.target.value })}
                            placeholder="Ej: Bisagra de acero inoxidable"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="prod-descripcion">Descripción</Label>
                        <Input
                            id="prod-descripcion"
                            value={form.descripcion}
                            onChange={(e) => updateForm({ descripcion: e.target.value })}
                            placeholder="Descripción del producto"
                        />
                    </div>

                    <div>
                        <Label htmlFor="prod-precio">Precio de Venta *</Label>
                        <Input
                            id="prod-precio"
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
                        <Label htmlFor="prod-categoria">Categoría *</Label>
                        <Input
                            id="prod-categoria"
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
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                isSaving ||
                                !form.nombre ||
                                !form.categoria ||
                                form.precio_venta <= 0
                            }
                            className="flex-1"
                        >
                            {isSaving ? 'Creando...' : 'Crear Producto'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

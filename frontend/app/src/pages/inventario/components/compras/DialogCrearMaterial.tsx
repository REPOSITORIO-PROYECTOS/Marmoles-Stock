import { useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import type { NuevoMaterialForm } from '../../types/compras.types';

interface DialogCrearMaterialProps {
    isOpen: boolean;
    onClose: () => void;
    onCrearMaterial: (form: NuevoMaterialForm) => Promise<void>;
}

export function DialogCrearMaterial({ isOpen, onClose, onCrearMaterial }: DialogCrearMaterialProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [nombre, setNombre] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) {
            alert('El nombre es requerido');
            return;
        }

        setIsSaving(true);
        try {
            // Solo nombre, todo lo demás será 0/vacío - se actualizará en la compra
            await onCrearMaterial({
                nombre: nombre.trim(),
                precio_m2: 0,
                espesor_mm: 0,
                ancho_m: 0,
                alto_m: 0
            });
            setNombre('');
            onClose();
        } catch (error) {
            // Error ya manejado en el callback
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Material</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="mat-nombre">Nombre del Material *</Label>
                        <Input
                            id="mat-nombre"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ej: Granito Negro Absoluto"
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSaving || !nombre.trim()}>
                            {isSaving ? 'Guardando...' : 'Crear Material'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

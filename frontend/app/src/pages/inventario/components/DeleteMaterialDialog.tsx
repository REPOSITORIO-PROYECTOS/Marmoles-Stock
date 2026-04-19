import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { AlertCircle } from 'lucide-react';
import { Material } from '../types';

interface DeleteMaterialDialogProps {
    open: boolean;
    material: Material | null;
    onClose: () => void;
    onConfirm: (material: Material) => void;
}

export const DeleteMaterialDialog: React.FC<DeleteMaterialDialogProps> = ({
    open,
    material,
    onClose,
    onConfirm,
}) => {
    if (!material) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-destructive/10">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                        </div>
                        <DialogTitle>Archivar Material</DialogTitle>
                    </div>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-foreground mb-2">
                            ¿Estás seguro de que deseas archivar el material <span className="font-bold">{material.nombre}</span>?
                        </p>
                        <p className="text-xs text-muted-foreground">
                            El material será archivado y no aparecerá en la tabla de inventario. Se pueden eliminar los lotes asociados primero si lo necesitas. El material puede ser recuperado desde el sistema si es necesario.
                        </p>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <Button variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={() => onConfirm(material)}>
                            Archivar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

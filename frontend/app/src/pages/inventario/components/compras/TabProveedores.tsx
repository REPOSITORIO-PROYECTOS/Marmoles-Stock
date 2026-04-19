import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Proveedor, NuevoProveedorForm } from '../../types/compras.types';
import { emailValido, telefonoValido } from '../../utils/comprasUtils';

interface TabProveedoresProps {
    proveedores: Proveedor[];
    onCrearProveedor: (form: NuevoProveedorForm) => Promise<boolean>;
    onEditarProveedor?: (id: string, form: NuevoProveedorForm) => Promise<boolean>;
    onEliminarProveedor?: (id: string, nombre: string) => Promise<boolean>;
    loading?: boolean;
}

const initialForm: NuevoProveedorForm = {
    nombre: '',
    contacto: '',
    telefono: '',
    email: '',
    especialidad: ''
};

export const TabProveedores: React.FC<TabProveedoresProps> = ({
    proveedores,
    onCrearProveedor,
    onEditarProveedor,
    onEliminarProveedor,
    loading
}) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<NuevoProveedorForm>(initialForm);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deleteTargetName, setDeleteTargetName] = useState<string>('');

    const handleSubmit = async () => {
        setIsSaving(true);

        let success = false;
        if (isEditing && editingId && onEditarProveedor) {
            success = await onEditarProveedor(editingId, form);
        } else {
            success = await onCrearProveedor(form);
        }

        setIsSaving(false);

        if (success) {
            setForm(initialForm);
            setIsDialogOpen(false);
            setIsEditing(false);
            setEditingId(null);
        }
    };

    const handleEdit = (proveedor: Proveedor) => {
        setForm({
            nombre: proveedor.nombre,
            contacto: proveedor.contacto,
            telefono: proveedor.telefono,
            email: proveedor.email,
            especialidad: proveedor.especialidad
        });
        setEditingId(proveedor.id);
        setIsEditing(true);
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (id: string, nombre: string) => {
        setDeleteTargetId(id);
        setDeleteTargetName(nombre);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (deleteTargetId && onEliminarProveedor) {
            setIsSaving(true);
            const success = await onEliminarProveedor(deleteTargetId, deleteTargetName);
            setIsSaving(false);

            if (success) {
                setIsDeleteDialogOpen(false);
                setDeleteTargetId(null);
                setDeleteTargetName('');
            }
        }
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setIsEditing(false);
        setEditingId(null);
        setForm(initialForm);
    };

    const isFormValid = form.nombre.trim() &&
        (!form.email || emailValido(form.email)) &&
        (!form.telefono || telefonoValido(form.telefono));

    return (
        <Card>
            <CardHeader className="flex justify-between items-center">
                <CardTitle>Proveedores</CardTitle>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => {
                            setIsEditing(false);
                            setEditingId(null);
                            setForm(initialForm);
                            setIsDialogOpen(true);
                        }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Proveedor
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>{isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="nombre-prov">Nombre *</Label>
                                <Input
                                    id="nombre-prov"
                                    value={form.nombre}
                                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                    placeholder="Nombre de la empresa"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <Label htmlFor="contacto-prov">Contacto</Label>
                                <Input
                                    id="contacto-prov"
                                    value={form.contacto}
                                    onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                                    placeholder="Nombre de contacto"
                                />
                            </div>
                            <div>
                                <Label htmlFor="telefono-prov">Teléfono</Label>
                                <Input
                                    id="telefono-prov"
                                    type="tel"
                                    value={form.telefono}
                                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                    placeholder="+56 9 XXXX XXXX"
                                />
                            </div>
                            <div>
                                <Label htmlFor="email-prov">Email</Label>
                                <Input
                                    id="email-prov"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="contacto@proveedor.cl"
                                />
                            </div>
                            <div>
                                <Label htmlFor="especialidad-prov">Dirección</Label>
                                <Input
                                    id="especialidad-prov"
                                    value={form.especialidad}
                                    onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                                    placeholder="Dirección (opcional)"
                                />
                            </div>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSaving || !isFormValid}
                                className="w-full"
                            >
                                {isSaving ? '⟳ Guardando...' : isEditing ? 'Actualizar Proveedor' : 'Crear Proveedor'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Contacto</TableHead>
                                    <TableHead>Teléfono</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {proveedores.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            No hay proveedores registrados
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    proveedores.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">{p.nombre}</TableCell>
                                            <TableCell>{p.contacto}</TableCell>
                                            <TableCell>{p.telefono}</TableCell>
                                            <TableCell>{p.email}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEdit(p)}
                                                        title="Editar proveedor"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDeleteClick(p.id, p.nombre)}
                                                        className="text-destructive hover:text-destructive"
                                                        title="Eliminar proveedor"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle>Eliminar Proveedor</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                ¿Estás seguro de que deseas eliminar al proveedor "<strong>{deleteTargetName}</strong>"?
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Esta acción no se puede deshacer.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsDeleteDialogOpen(false)}
                                    disabled={isSaving}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleConfirmDelete}
                                    disabled={isSaving}
                                >
                                    {isSaving ? '⟳ Eliminando...' : 'Eliminar'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
};

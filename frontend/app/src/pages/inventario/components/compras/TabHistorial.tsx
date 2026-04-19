import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { Compra } from '../../types/compras.types';
import { formatearFecha } from '../../utils/comprasUtils';

interface TabHistorialProps {
    compras: Compra[];
    loading?: boolean;
}

export const TabHistorial: React.FC<TabHistorialProps> = ({ compras, loading }) => {
    const [overrides, setOverrides] = useState<Record<string, { menor?: number; mayor?: number; costo?: number }>>({});

    useEffect(() => {
        const handler = (ev: any) => {
            const d = ev?.detail || {};
            const mat = (d.material || '').toString();
            setOverrides(prev => {
                const curr = prev[mat] || {};
                const next = { ...curr };
                if (typeof d.precio_m2 === 'number') next.menor = d.precio_m2;
                if (typeof d.precio_mayor_m2 === 'number') next.mayor = d.precio_mayor_m2;
                if (typeof d.costo_m2 === 'number') next.costo = d.costo_m2;
                return { ...prev, [mat]: next };
            });
        };
        window.addEventListener('marmoles:precio-venta-actualizado', handler);
        return () => window.removeEventListener('marmoles:precio-venta-actualizado', handler);
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Historial de Compras</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Proveedor</TableHead>
                                    <TableHead>Material/Producto</TableHead>
                                    <TableHead>Lote</TableHead>
                                    <TableHead>Precio por menor m²</TableHead>
                                    <TableHead>Precio por mayor m²</TableHead>
                                    <TableHead>Costo m²</TableHead>
                                    <TableHead>Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {compras.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            No hay compras registradas
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    compras.map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell>{formatearFecha(c.fecha)}</TableCell>
                                            <TableCell>{c.proveedor}</TableCell>
                                            <TableCell>{c.material}</TableCell>
                                            <TableCell>{c.lote || '-'}</TableCell>
                                            <TableCell className="text-black">
                                                {(() => {
                                                    const ov = overrides[c.material || ''] || {};
                                                    const menorVal = (ov.menor ?? c.precio_m2 ?? 0);
                                                    return `$${menorVal.toFixed(2)}`;
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-black">
                                                {(() => {
                                                    const ov = overrides[c.material || ''] || {};
                                                    const menorVal = (ov.menor ?? c.precio_m2 ?? 0);
                                                    const mayorVal = ov.mayor ?? c.precio_mayor_m2;
                                                    if (mayorVal != null) return `$${(mayorVal || 0).toFixed(2)}`;
                                                    return `$${menorVal.toFixed(2)}`;
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-black">
                                                {(() => {
                                                    const ov = overrides[c.material || ''] || {};
                                                    const costoVal = (ov.costo ?? c.costo_m2 ?? 0);
                                                    return `$${costoVal.toFixed(2)}`;
                                                })()}
                                            </TableCell>
                                            <TableCell className="font-bold">
                                                {(() => {
                                                    const area = (c.ancho_m || 0) * (c.largo_m || 0);
                                                    const unit = (c.costo_m2 || 0) * area;
                                                    const cantidad = c.cantidad || 1;
                                                    const totalCalc = unit * cantidad;
                                                    const montoDisplay =
                                                        cantidad > 1 && Math.abs(c.monto - unit) < 0.01
                                                            ? totalCalc
                                                            : c.monto;
                                                    return <>${montoDisplay.toFixed(2)}</>;
                                                })()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

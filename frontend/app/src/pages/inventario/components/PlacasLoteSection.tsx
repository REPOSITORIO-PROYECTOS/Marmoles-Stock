import React, { useCallback, useEffect, useState } from 'react';
import { PackageOpen, RefreshCw, Truck, Trash2 } from 'lucide-react';
import { get, post, del } from '../../../api';
import { Placa } from '../types';
import { Button } from '../../../components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../../components/ui/table';
import { notifyError, notifySuccess } from '../../../utils/notifications';

interface PlacasLoteSectionProps {
    loteId: string;
    codigoLote: string;
    onLoteActualizado?: () => void;
}

const estadoBadgeClass = (estado: string) => {
    switch (estado) {
        case 'disponible':
            return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
        case 'despachado':
            return 'bg-slate-500/15 text-slate-600 border-slate-500/30';
        case 'vendido':
            return 'bg-amber-500/15 text-amber-700 border-amber-500/30';
        case 'reservado':
            return 'bg-blue-500/15 text-blue-700 border-blue-500/30';
        default:
            return 'bg-muted text-muted-foreground border-border';
    }
};

export const PlacasLoteSection: React.FC<PlacasLoteSectionProps> = ({
    loteId,
    codigoLote,
    onLoteActualizado,
}) => {
    const [placas, setPlacas] = useState<Placa[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const fetchPlacas = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await get<Placa[]>(
                `/api/placas?lote_id=${encodeURIComponent(loteId)}`
            );
            setPlacas(Array.isArray(rows) ? rows : []);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error al cargar placas';
            notifyError(msg);
            setPlacas([]);
        } finally {
            setLoading(false);
        }
    }, [loteId]);

    useEffect(() => {
        fetchPlacas();
    }, [fetchPlacas]);

    const disponibles = placas.filter(
        (p) =>
            p.estado === 'disponible' &&
            !p.plano_tecnico_id &&
            !p.reservado_por
    );
    const m2Disponibles = disponibles.reduce((acc, p) => acc + (p.m2 ?? 0), 0);

    const handleDespachar = async () => {
        if (disponibles.length === 0) {
            notifyError('No hay placas disponibles para despachar en este lote');
            return;
        }
        if (
            !confirm(
                `¿Despachar ${disponibles.length} placa(s) disponible(s) del lote ${codigoLote}? (${m2Disponibles.toFixed(3)} m²)`
            )
        ) {
            return;
        }
        setBusy(true);
        try {
            const res = await post<{
                despachadas: number;
                m2_despachado: number;
            }>(`/api/lotes/${loteId}/despachar-placas`);
            notifySuccess(
                `Despachadas ${res.despachadas} placa(s) · ${res.m2_despachado?.toFixed(3) ?? 0} m²`
            );
            await fetchPlacas();
            onLoteActualizado?.();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'No se pudo despachar';
            notifyError(msg);
        } finally {
            setBusy(false);
        }
    };

    const handleSincronizar = async () => {
        setBusy(true);
        try {
            const res = await post<{
                cantidad: number;
                stock_actual: number;
                placas_disponibles: number;
            }>(`/api/lotes/${loteId}/sincronizar-placas`);
            notifySuccess(
                `Stock del lote actualizado: ${res.placas_disponibles} placa(s) · ${res.stock_actual?.toFixed(3)} m²`
            );
            onLoteActualizado?.();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'No se pudo sincronizar';
            notifyError(msg);
        } finally {
            setBusy(false);
        }
    };

    const handleEliminarPlaca = async (placa: Placa) => {
        const codigo = placa.codigo || placa.id.slice(0, 8);
        if (!confirm(`¿Eliminar la placa ${codigo}?`)) return;
        setBusy(true);
        try {
            await del(`/api/placas/${placa.id}`);
            notifySuccess(`Placa ${codigo} eliminada`);
            await fetchPlacas();
            onLoteActualizado?.();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'No se pudo eliminar';
            notifyError(msg);
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <p className="text-xs text-muted-foreground py-2 pl-2">
                Cargando placas del lote…
            </p>
        );
    }

    if (placas.length === 0) {
        return (
            <p className="text-xs text-muted-foreground italic py-2 pl-2">
                Sin placas individuales registradas para este lote.
            </p>
        );
    }

    return (
        <div className="mt-3 border-t border-dashed border-muted-foreground/25 pt-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <PackageOpen className="h-3.5 w-3.5" />
                    Placas de este lote · medidas en mm · m² por placa · bloque
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={busy || disponibles.length === 0}
                        onClick={handleDespachar}
                        title="Marcar como despachadas todas las placas disponibles"
                    >
                        <Truck className="h-3 w-3 mr-1" />
                        Despachar disponibles ({disponibles.length})
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={busy}
                        onClick={handleSincronizar}
                        title="Recalcular cantidad y m² del lote desde las placas (quita stock agregado duplicado)"
                    >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Sincronizar stock
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-md border bg-muted/20">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-[10px] h-8">Código</TableHead>
                            <TableHead className="text-[10px] h-8">Material</TableHead>
                            <TableHead className="text-[10px] h-8">Largo × Ancho (mm)</TableHead>
                            <TableHead className="text-[10px] h-8">Esp. mm</TableHead>
                            <TableHead className="text-[10px] h-8">m²</TableHead>
                            <TableHead className="text-[10px] h-8">Bloque</TableHead>
                            <TableHead className="text-[10px] h-8">Estado</TableHead>
                            <TableHead className="text-[10px] h-8 w-[72px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {placas.map((p) => {
                            const puedeEliminar =
                                p.estado === 'disponible' &&
                                !p.plano_tecnico_id &&
                                !p.reservado_por;
                            return (
                                <TableRow key={p.id} className="text-xs">
                                    <TableCell className="font-mono font-medium py-1.5">
                                        {p.codigo || '—'}
                                    </TableCell>
                                    <TableCell className="py-1.5 max-w-[140px] truncate">
                                        {p.material_nombre || '—'}
                                    </TableCell>
                                    <TableCell className="py-1.5 whitespace-nowrap">
                                        {p.largo} × {p.ancho}
                                    </TableCell>
                                    <TableCell className="py-1.5">{p.espesor ?? '—'}</TableCell>
                                    <TableCell className="py-1.5 font-medium">
                                        {(p.m2 ?? 0).toFixed(3)}
                                    </TableCell>
                                    <TableCell className="py-1.5">{p.ubicacion || '—'}</TableCell>
                                    <TableCell className="py-1.5">
                                        <span
                                            className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${estadoBadgeClass(p.estado)}`}
                                        >
                                            {p.estado}
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-1.5">
                                        {puedeEliminar && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                disabled={busy}
                                                onClick={() => handleEliminarPlaca(p)}
                                                title="Eliminar placa"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {disponibles.length > 0 && (
                <p className="text-[10px] text-muted-foreground pl-1">
                    En almacén: {disponibles.length} placa(s) · {m2Disponibles.toFixed(3)} m²
                    disponibles para despacho.
                </p>
            )}
        </div>
    );
};

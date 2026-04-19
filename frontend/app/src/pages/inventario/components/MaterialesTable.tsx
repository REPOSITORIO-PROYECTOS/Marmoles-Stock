import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { ChevronDown, ChevronRight, Eye, EyeOff, Trash2, Printer } from 'lucide-react';
import { Material, Lote } from '../types';
import { normalizarNombre, formatearFecha } from '../utils/materialUtils';
import { LotesExpandableRow } from './LotesExpandableRow';

interface MaterialesTableProps {
    materiales: Material[];
    expandedMaterials: Set<string>;
    lotesPorMaterial: Record<string, Lote[]>;
    loadingLotes: Record<string, boolean>;
    precioCostoPorNombre: Record<string, number>;
    highlightNombre: string;
    onToggleExpand: (material: Material) => void;
    onToggleDisponibilidad: (material: Material) => void;
    onEliminar: (material: Material) => void;
    onEliminarLote?: (material: Material, loteId: string) => void;
    onActualizarLote?: (material: Material) => void;
}

export const MaterialesTable: React.FC<MaterialesTableProps> = ({
    materiales,
    expandedMaterials,
    lotesPorMaterial,
    loadingLotes,
    precioCostoPorNombre,
    highlightNombre,
    onToggleExpand,
    onToggleDisponibilidad,
    onEliminar,
    onEliminarLote,
    onActualizarLote,
}) => {
    const getLoteInfo = (material: Material) => {
        const key = normalizarNombre(material.nombre);
        const lotes = lotesPorMaterial[key] || [];
        const uniqueCodes = new Set(lotes.map(l => l.codigo_lote).filter(Boolean));
        const totalItems = lotes.reduce((acc, l) => acc + (l.cantidad || 0), 0);

        if (uniqueCodes.size === 0) {
            return { text: 'Sin registro', isItalic: true };
        }

        if (uniqueCodes.size === 1) {
            const lastLote = [...lotes].sort((a, b) =>
                (b.fecha_ingreso || '').localeCompare(a.fecha_ingreso || '')
            )[0];
            const code = Array.from(uniqueCodes)[0];
            const dateStr = lastLote?.fecha_ingreso
                ? new Date(lastLote.fecha_ingreso).toLocaleDateString('es-AR')
                : '';
            return {
                code,
                totalItems: totalItems > 1 ? ` (x${totalItems})` : '',
                date: dateStr,
            };
        }

        const lastLote = [...lotes].sort((a, b) =>
            (b.fecha_ingreso || '').localeCompare(a.fecha_ingreso || '')
        )[0];
        const lastDate = lastLote?.fecha_ingreso
            ? new Date(lastLote.fecha_ingreso).toLocaleDateString('es-AR')
            : '';

        return {
            count: `${uniqueCodes.size} lotes (${totalItems} items)`,
            lastDate: lastDate ? `Último: ${lastDate}` : '',
        };
    };

    const getUltimaActualizacion = (material: Material) => {
        const lotes = lotesPorMaterial[normalizarNombre(material.nombre)] || [];
        if (lotes.length > 0) {
            const sorted = [...lotes].sort((a, b) =>
                (b.fecha_ingreso || '').localeCompare(a.fecha_ingreso || '')
            );
            const lastDate = sorted[0]?.fecha_ingreso;
            if (lastDate) return formatearFecha(lastDate);
        }

        return formatearFecha(material.ultimaActualizacion);
    };

    const handleImprimirTicket = (material: Material) => {
        const key = normalizarNombre(material.nombre);
        const lotes = lotesPorMaterial[key] || [];
        const totalItems = lotes.reduce((acc, l) => acc + (l.cantidad || 0), 0);
        const precioCosto = (precioCostoPorNombre[key] ?? 0).toLocaleString();
        const precioM2 = (material.precioM2 ?? 0).toLocaleString();
        const ultima = getUltimaActualizacion(material);
        const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Ticket Material</title>
          <style>
            body { font-family: Arial, sans-serif; color: #333; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
            .title { font-size: 18px; font-weight: 800; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .item { background: #f7f7f7; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
            .label { font-size: 11px; color: #666; }
            .value { font-size: 14px; font-weight: 700; }
            .footer { margin-top: 16px; text-align: center; font-size: 12px; color: #555; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Ticket de Material</div>
            <div>${new Date().toLocaleString()}</div>
          </div>
          <div class="grid">
            <div class="item"><div class="label">Material</div><div class="value">${material.nombre}</div></div>
            <div class="item"><div class="label">Última Actualización</div><div class="value">${ultima}</div></div>
            <div class="item"><div class="label">Costo m²</div><div class="value">$${precioCosto}</div></div>
            <div class="item"><div class="label">Precio m²</div><div class="value">$${precioM2}</div></div>
            <div class="item"><div class="label">Lotes</div><div class="value">${lotes.length} (${totalItems} items)</div></div>
          </div>
          <div class="footer">Sistema de Inventario</div>
          <script>window.onload = function(){ window.print(); }</script>
        </body>
        </html>
        `;
        const w = window.open('', '_blank', 'width=420,height=600');
        if (w) {
            w.document.open();
            w.document.write(html);
            w.document.close();
        }
    };

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Número Lote</TableHead>
                        <TableHead>Costo m²</TableHead>
                        <TableHead>Precio por menor m²</TableHead>
                        <TableHead>Precio por mayor m²</TableHead>
                        <TableHead>Última Actualización</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {materiales.map((material) => {
                        const key = normalizarNombre(material.nombre);
                        const isExpanded = expandedMaterials.has(key);
                        const isHighlighted = key === normalizarNombre(highlightNombre);
                        const loteInfo = getLoteInfo(material);
                        const lotes = lotesPorMaterial[key] || [];
                        const isLoading = loadingLotes[key];

                        return (
                            <React.Fragment key={material.id}>
                                <TableRow
                                    data-material-key={key}
                                    className={`hover:bg-muted/50 transition-colors ${isHighlighted ? 'bg-primary/10' : ''
                                        }`}
                                >
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => onToggleExpand(material)}
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="font-medium">{material.nombre}</TableCell>
                                    <TableCell>
                                        {isLoading ? (
                                            <span className="text-muted-foreground text-xs italic">Cargando…</span>
                                        ) : (
                                            <span className="text-sm">
                                                {'isItalic' in loteInfo ? (
                                                    <span className="text-muted-foreground italic">{loteInfo.text}</span>
                                                ) : 'code' in loteInfo ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">
                                                            {loteInfo.code}
                                                            {loteInfo.totalItems}
                                                        </span>
                                                        {loteInfo.date && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {loteInfo.date}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{loteInfo.count}</span>
                                                        {loteInfo.lastDate && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {loteInfo.lastDate}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-black">
                                            ${(precioCostoPorNombre[key] ?? 0).toLocaleString()}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-black font-medium">
                                            ${(material.precioM2 ?? 0).toLocaleString()}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-black font-medium">
                                            ${Number((material.precioMayorM2 ?? material.precioM2 ?? 0)).toLocaleString()}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-black">
                                        {getUltimaActualizacion(material)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 items-center justify-end">
                                            <Button
                                                variant={material.disponibleParaVenta ? 'outline' : 'destructive'}
                                                size="sm"
                                                onClick={() => onToggleDisponibilidad(material)}
                                                className="gap-2"
                                                title={
                                                    material.disponibleParaVenta
                                                        ? 'Deshabilitar para venta'
                                                        : 'Habilitar para venta'
                                                }
                                            >
                                                {material.disponibleParaVenta ? (
                                                    <Eye className="h-3 w-3" />
                                                ) : (
                                                    <EyeOff className="h-3 w-3" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleImprimirTicket(material)}
                                                className="gap-2"
                                                title="Imprimir ticket de material"
                                            >
                                                <Printer className="h-3 w-3" />
                                            </Button>
                                            {!material.disponibleParaVenta && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onEliminar(material)}
                                                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    title="Eliminar material"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && (
                                    <TableRow className="bg-muted/30">
                                        <TableCell colSpan={8} className="p-0">
                                            <LotesExpandableRow
                                                material={material}
                                                lotes={lotes}
                                                loading={isLoading}
                                                onEliminarLote={onEliminarLote}
                                                onActualizarLote={() => onActualizarLote?.(material)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

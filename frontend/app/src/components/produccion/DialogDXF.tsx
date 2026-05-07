import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Upload, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { procesarDxf } from '../../lib/produccion/plan';

interface DialogDXFProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DialogDXF({ open, onOpenChange }: DialogDXFProps) {
    const [dxfLoading, setDxfLoading] = useState(false);
    const [dxfResult, setDxfResult] = useState<any>(null);

    const handleDxfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        setDxfLoading(true);
        setDxfResult(null);
        try {
            const res = await procesarDxf(file);
            setDxfResult(res);
            toast.success("DXF procesado correctamente");
        } catch (err: any) {
            toast.error("Error al procesar DXF: " + err.message);
        } finally {
            setDxfLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Análisis y Procesamiento de DXF</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors">
                        <Label htmlFor="dxf-upload" className="cursor-pointer block w-full h-full">
                            <div className="flex flex-col items-center gap-2">
                                <Upload className="h-8 w-8 text-gray-400" />
                                <span className="text-sm text-gray-600">Click para seleccionar archivo DXF/DWG</span>
                            </div>
                            <Input
                                id="dxf-upload"
                                type="file"
                                accept=".dxf,.dwg"
                                className="hidden"
                                onChange={handleDxfUpload}
                                disabled={dxfLoading}
                            />
                        </Label>
                    </div>

                    {dxfLoading && (
                        <div className="flex items-center justify-center py-4">
                            <span className="text-sm text-muted-foreground">Procesando archivo...</span>
                        </div>
                    )}

                    {dxfResult && (
                        <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                            <div className="flex items-center gap-2 text-green-700 font-medium">
                                <CheckCircle2 className="h-5 w-5" />
                                <span>Análisis Completado</span>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-medium text-sm mb-2">Vista Previa</h4>
                                    {dxfResult.img_url ? (
                                        <div className="border rounded bg-white p-2">
                                            <img src={dxfResult.img_url} alt="DXF Preview" className="w-full h-auto object-contain max-h-[300px]" />
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-500 italic">No hay vista previa disponible</div>
                                    )}
                                </div>
                                <div className="space-y-2 text-sm">
                                    <h4 className="font-medium text-sm mb-2">Estadísticas</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-white p-2 rounded border">
                                            <div className="text-gray-500 text-xs">Entidades</div>
                                            <div className="font-mono text-lg">{dxfResult.entity_count || dxfResult.items_validos || 0}</div>
                                        </div>
                                        <div className="bg-white p-2 rounded border">
                                            <div className="text-gray-500 text-xs">Capas</div>
                                            <div className="font-mono text-lg">{dxfResult.layer_count || 0}</div>
                                        </div>
                                        <div className="col-span-2 bg-white p-2 rounded border">
                                            <div className="text-gray-500 text-xs">Dimensiones (aprox)</div>
                                            <div className="font-mono">
                                                {dxfResult.bbox ?
                                                    `${Math.round(dxfResult.bbox.width)}×${Math.round(dxfResult.bbox.height)} ${dxfResult.units || 'mm'}`
                                                    : 'N/A'}
                                            </div>
                                        </div>
                                        <div className="col-span-2 bg-white p-2 rounded border">
                                            <div className="text-gray-500 text-xs">Área Total Calculada</div>
                                            <div className="font-mono text-lg font-bold text-blue-600">
                                                {(dxfResult.total_area_m2 ?? dxfResult.area_m2 ?? 0).toFixed(2)} m²
                                            </div>
                                            <div className="text-xs text-gray-400">Unidades: {dxfResult.units || 'desconocido'}</div>
                                        </div>
                                    </div>

                                    {dxfResult.piezas && dxfResult.piezas.length > 0 && (
                                        <div className="mt-4 border rounded bg-white overflow-hidden">
                                            <div className="bg-gray-100 px-2 py-1 text-xs font-bold border-b">
                                                Piezas Detectadas ({dxfResult.piezas.length})
                                            </div>
                                            <div className="max-h-[200px] overflow-y-auto">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-gray-50 sticky top-0">
                                                        <tr>
                                                            <th className="px-2 py-1 text-left">#</th>
                                                            <th className="px-2 py-1 text-left">Largo</th>
                                                            <th className="px-2 py-1 text-left">Ancho</th>
                                                            <th className="px-2 py-1 text-left">Área</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {dxfResult.piezas.map((p: any, i: number) => (
                                                            <tr key={i} className="border-t hover:bg-gray-50">
                                                                <td className="px-2 py-1">{i + 1}</td>
                                                                <td className="px-2 py-1">{p.h || p.largo}cm</td>
                                                                <td className="px-2 py-1">{p.w || p.ancho}cm</td>
                                                                <td className="px-2 py-1">{((p.w * p.h) / 10000).toFixed(3)}m²</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-4">
                                        <p className="text-xs text-muted-foreground">
                                            Este archivo puede ser utilizado para generar piezas de producción.
                                            Asegúrese de que las unidades sean correctas (mm/cm).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

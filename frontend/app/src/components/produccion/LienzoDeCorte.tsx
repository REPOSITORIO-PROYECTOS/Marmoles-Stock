import { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertCircle, Plus, Trash2, Play, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { post, get } from '../../api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

interface LineaDeCorte {
  id: string;
  tipo: 'ORTOGONAL_VERTICAL' | 'ORTOGONAL_HORIZONTAL';
  posicion_mm: number;
  espesor_corte_mm: number;
}

interface ResultadoCorte {
  exito: boolean;
  acumulado_id: string;
  estado_nuevo: string;
  resultado_corte: {
    pieza_principal: {
      ancho: number;
      alto: number;
      area_mm2: number;
    };
    remanentes: Array<{
      ancho: number;
      alto: number;
      area_mm2: number;
      origen_x: number;
      origen_y: number;
    }>;
    area_total_mm2: number;
    invariante_valida: boolean;
    error_invariante_mm2: number;
  };
  retazos_creados: string[];
  cantidad_retazos: number;
  area_retazos_mm2: number;
}

interface LienzoDeCorteProps {
  acumuladoId: string;
  acumuladoDimensiones: {
    ancho: number;
    alto: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProcesado?: (resultado: ResultadoCorte) => void;
}

export function LienzoDeCorte({
  acumuladoId,
  acumuladoDimensiones,
  open,
  onOpenChange,
  onProcesado
}: LienzoDeCorteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lineas, setLineas] = useState<LineaDeCorte[]>([]);
  const [nuevaLinea, setNuevaLinea] = useState({
    tipo: 'ORTOGONAL_VERTICAL' as const,
    posicion: 0,
    espesor: 3.2,
  });
  const [mode, setMode] = useState<'draw' | 'preview' | 'result'>('draw');
  const [preview, setPreview] = useState<ResultadoCorte | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [notas, setNotas] = useState('');

  // Dibujar canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = Math.min(
      canvas.width / acumuladoDimensiones.ancho,
      canvas.height / acumuladoDimensiones.alto
    );

    // Limpiar
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar borde del acumulado
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    const w = acumuladoDimensiones.ancho * scale;
    const h = acumuladoDimensiones.alto * scale;
    ctx.strokeRect(10, 10, w, h);

    // Dibujar grid (referencia)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      // Verticales
      const x = 10 + (w / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, 10 + h);
      ctx.stroke();

      // Horizontales
      const y = 10 + (h / 10) * i;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(10 + w, y);
      ctx.stroke();
    }

    // Dibujar líneas de corte
    lineas.forEach((linea) => {
      ctx.strokeStyle = linea.tipo === 'ORTOGONAL_VERTICAL' ? '#ef4444' : '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      if (linea.tipo === 'ORTOGONAL_VERTICAL') {
        const x = 10 + (linea.posicion_mm * scale);
        ctx.beginPath();
        ctx.moveTo(x, 10);
        ctx.lineTo(x, 10 + h);
        ctx.stroke();
      } else {
        const y = 10 + (linea.posicion_mm * scale);
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(10 + w, y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    });

    // Etiquetas
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.fillText(`${acumuladoDimensiones.ancho}mm`, 10 + w / 2 - 20, 30);
    ctx.fillText(`${acumuladoDimensiones.alto}mm`, 25, 10 + h / 2);
  }, [lineas, acumuladoDimensiones]);

  const agregarLinea = () => {
    if (nuevaLinea.posicion <= 0 || nuevaLinea.posicion >= (
      nuevaLinea.tipo === 'ORTOGONAL_VERTICAL' ? acumuladoDimensiones.ancho : acumuladoDimensiones.alto
    )) {
      toast.error('Posición fuera de rango');
      return;
    }

    const linea: LineaDeCorte = {
      id: Math.random().toString(36).substr(2, 9),
      tipo: nuevaLinea.tipo,
      posicion_mm: nuevaLinea.posicion,
      espesor_corte_mm: nuevaLinea.espesor,
    };

    setLineas([...lineas, linea]);
    toast.success('Línea de corte agregada');
  };

  const eliminarLinea = (id: string) => {
    setLineas(lineas.filter(l => l.id !== id));
  };

  const handlePreview = async () => {
    if (lineas.length === 0) {
      toast.error('Debe agregar al menos una línea de corte');
      return;
    }

    setProcesando(true);
    try {
      const response = await get(
        `/api/produccion/acumulados/${acumuladoId}/preview-corte?lineas_json=${encodeURIComponent(JSON.stringify(lineas))}`
      );

      if (response.exito) {
        setPreview(response);
        setMode('preview');
        toast.success('Preview generado');
      } else {
        toast.error(response.errores?.[0] || 'Error en preview');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error generando preview');
    } finally {
      setProcesando(false);
    }
  };

  const handleProcesar = async () => {
    if (lineas.length === 0) {
      toast.error('Debe agregar al menos una línea de corte');
      return;
    }

    if (!window.confirm(`¿Procesar corte con ${lineas.length} línea(s)? Esto creará los retazos en BD.`)) {
      return;
    }

    setProcesando(true);
    try {
      const payload = {
        lineas_corte: lineas,
        pieza_principal_bounds: [0, 0, acumuladoDimensiones.ancho, acumuladoDimensiones.alto],
        usuario_id: localStorage.getItem('userId') || 'system',
        notas: notas || undefined,
      };

      const response = await post(
        `/api/produccion/acumulados/${acumuladoId}/procesar-corte`,
        payload
      );

      if (response.exito) {
        setPreview(response);
        setMode('result');
        toast.success(`Corte procesado: ${response.cantidad_retazos} retazos creados`);
        if (onProcesado) {
          onProcesado(response);
        }
      } else {
        toast.error(response.errores?.[0] || 'Error procesando corte');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error procesando corte');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-blue-600" />
            Lienzo de Corte — Acumulado {acumuladoId.slice(0, 8)}
          </DialogTitle>
          <DialogDescription>
            Dimensiones: {acumuladoDimensiones.ancho}×{acumuladoDimensiones.alto} mm
            {mode === 'draw' && ' — Modo Dibujo'}
            {mode === 'preview' && ' — Modo Preview'}
            {mode === 'result' && ' — Resultado del Corte'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
          {/* CANVAS */}
          <div className="lg:col-span-2">
            <div className="bg-white border rounded-lg p-4">
              <canvas
                ref={canvasRef}
                width={600}
                height={400}
                className="w-full border-2 border-slate-300 rounded"
              />
              <div className="mt-2 text-xs text-slate-500 text-center">
                Escala adaptada a pantalla. Rojo = Vertical, Azul = Horizontal
              </div>
            </div>
          </div>

          {/* PANEL DERECHO */}
          <div className="space-y-4">
            {mode === 'draw' && (
              <>
                {/* AGREGAR LÍNEA */}
                <div className="bg-slate-50 p-4 rounded-lg border space-y-3">
                  <h4 className="text-sm font-bold">Agregar Corte</h4>

                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <select
                      className="w-full h-8 text-sm border rounded px-2"
                      value={nuevaLinea.tipo}
                      onChange={(e) =>
                        setNuevaLinea({
                          ...nuevaLinea,
                          tipo: e.target.value as 'ORTOGONAL_VERTICAL' | 'ORTOGONAL_HORIZONTAL',
                          posicion: 0,
                        })
                      }
                    >
                      <option value="ORTOGONAL_VERTICAL">Vertical</option>
                      <option value="ORTOGONAL_HORIZONTAL">Horizontal</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs">
                      Posición (0-{nuevaLinea.tipo === 'ORTOGONAL_VERTICAL' ? acumuladoDimensiones.ancho : acumuladoDimensiones.alto})
                    </Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={nuevaLinea.posicion}
                      onChange={(e) =>
                        setNuevaLinea({
                          ...nuevaLinea,
                          posicion: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="mm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Espesor Corte</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-8 text-sm"
                      value={nuevaLinea.espesor}
                      onChange={(e) =>
                        setNuevaLinea({
                          ...nuevaLinea,
                          espesor: parseFloat(e.target.value) || 3.2,
                        })
                      }
                      placeholder="mm"
                    />
                  </div>

                  <Button
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                    onClick={agregarLinea}
                  >
                    <Plus className="h-4 w-4" /> Agregar
                  </Button>
                </div>

                {/* NOTAS */}
                <div className="bg-slate-50 p-4 rounded-lg border space-y-2">
                  <Label className="text-xs">Notas de Corte</Label>
                  <textarea
                    className="w-full h-20 text-xs border rounded p-2"
                    placeholder="Anotaciones adicionales..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* LISTA DE LÍNEAS */}
            <div className="bg-white p-4 rounded-lg border space-y-2 max-h-[300px] overflow-auto">
              <h4 className="text-sm font-bold sticky top-0 bg-white">
                Cortes ({lineas.length})
              </h4>

              {lineas.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Agregue cortes arriba</p>
              ) : (
                <div className="space-y-2">
                  {lineas.map((linea) => (
                    <div
                      key={linea.id}
                      className="flex items-center justify-between bg-slate-50 p-2 rounded border text-xs"
                    >
                      <div>
                        <Badge className={linea.tipo === 'ORTOGONAL_VERTICAL' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>
                          {linea.tipo === 'ORTOGONAL_VERTICAL' ? 'V' : 'H'}
                        </Badge>
                        <span className="ml-2 font-mono">{linea.posicion_mm}mm</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => eliminarLinea(linea.id)}
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PREVIEW / RESULTADO */}
            {preview && mode === 'preview' && (
              <div className="bg-cyan-50 p-4 rounded-lg border space-y-2">
                <h4 className="text-sm font-bold">Preview de Corte</h4>
                <div className="text-xs space-y-1">
                  <p>
                    <strong>Pieza principal:</strong> {preview.resultado_corte.pieza_principal.ancho}×
                    {preview.resultado_corte.pieza_principal.alto}mm
                  </p>
                  <p>
                    <strong>Remanentes:</strong> {preview.resultado_corte.remanentes.length}
                  </p>
                  <p>
                    <strong>Invariante:</strong>{' '}
                    {preview.resultado_corte.invariante_valida ? (
                      <span className="text-green-600">✓ Válido</span>
                    ) : (
                      <span className="text-red-600">✗ Error {preview.resultado_corte.error_invariante_mm2.toFixed(1)}mm²</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {preview && mode === 'result' && (
              <div className="bg-green-50 p-4 rounded-lg border space-y-2">
                <h4 className="text-sm font-bold text-green-700">✓ Corte Procesado</h4>
                <div className="text-xs space-y-1">
                  <p>
                    <strong>Retazos creados:</strong> {preview.cantidad_retazos}
                  </p>
                  <p>
                    <strong>Área total:</strong> {(preview.area_retazos_mm2 / 1000000).toFixed(2)}m²
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* WARNINGS */}
        {!preview?.resultado_corte?.invariante_valida && mode !== 'draw' && (
          <div className="flex gap-2 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Advertencia de área:</strong> Error en invariante de{' '}
              {preview?.resultado_corte?.error_invariante_mm2.toFixed(2)}mm². Revise las dimensiones.
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {mode === 'draw' && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="secondary"
                onClick={handlePreview}
                disabled={lineas.length === 0 || procesando}
                className="gap-2"
              >
                <Eye className="h-4 w-4" /> Preview
              </Button>
              <Button
                onClick={handleProcesar}
                disabled={lineas.length === 0 || procesando}
                className="gap-2"
              >
                {procesando ? 'Procesando...' : 'Procesar Corte'}
              </Button>
            </>
          )}

          {mode === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setMode('draw')}>
                Volver
              </Button>
              <Button
                onClick={handleProcesar}
                disabled={procesando}
                className="gap-2"
              >
                {procesando ? 'Procesando...' : 'Confirmar Corte'}
              </Button>
            </>
          )}

          {mode === 'result' && (
            <Button
              onClick={() => onOpenChange(false)}
              className="gap-2 bg-green-600 hover:bg-green-700 w-full"
            >
              ✓ Corte Registrado - Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Badge component simple
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
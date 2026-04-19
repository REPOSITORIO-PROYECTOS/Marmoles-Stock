import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { notifyInfo } from '../../utils/notifications';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { CheckCircle, X, RotateCcw } from 'lucide-react';

interface FirmaDigitalProps {
  nombreCliente: string;
  ordenId: string;
  onFirmar: (firma: string, nombre: string) => void;
  onCancelar: () => void;
  open?: boolean;
}

export function FirmaDigital({ nombreCliente, ordenId, onFirmar, onCancelar, open = true }: FirmaDigitalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [nombreFirmante, setNombreFirmante] = useState(nombreCliente);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasSignature(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };

  const handleFirmar = () => {
    if (!hasSignature || !nombreFirmante) {
      notifyInfo('Por favor, ingrese su nombre y firme');
      return;
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const firmaDataURL = canvas.toDataURL();
      onFirmar(firmaDataURL, nombreFirmante);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancelar()}>
      <DialogContent className="max-w-2xl w-full h-fit max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Firma Digital - Entrega #{ordenId}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="nombre">Nombre Completo del Receptor</Label>
            <Input
              id="nombre"
              value={nombreFirmante}
              onChange={(e) => setNombreFirmante(e.target.value)}
              placeholder="Nombre y apellido"
            />
          </div>

          <div>
            <Label>Firma en el recuadro</Label>
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={700}
                height={200}
                className="cursor-crosshair w-full h-auto min-h-[150px]"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSignature}
              className="mt-2"
            >
              <RotateCcw className="h-3 w-3 mr-2" />
              Limpiar Firma
            </Button>
          </div>

          <Separator />

          <div className="p-4 bg-cyan-50 border border-cyan-200 rounded">
            <p className="text-sm text-cyan-900">
              Al firmar, confirmo que he recibido el trabajo en conformidad y de acuerdo con lo especificado en el presupuesto.
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={handleFirmar}
              className="flex-1"
              disabled={!hasSignature || !nombreFirmante}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Entrega
            </Button>
            <Button variant="outline" onClick={onCancelar} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

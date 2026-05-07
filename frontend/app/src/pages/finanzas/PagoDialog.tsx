import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { actualizarPago, borrarPago, registrarPago, PagoCreate } from '../../lib/finanzas/api';
import { openReciboPagoPrint } from '../../lib/finanzas/reciboPagoPrint';
import { toast } from 'sonner';

interface PagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagoId?: string;
  initialPago?: {
    monto: number;
    metodo_pago: string;
    referencia?: string;
    nota?: string;
    fecha?: string;
  };
  presupuestoId: string;
  clienteId?: string;
  /** Para el comprobante impreso (ej. nombre del cliente). */
  clienteNombre?: string;
  /** Código o id legible en el comprobante (default: presupuestoId). */
  presupuestoDisplay?: string;
  totalPresupuesto: number;
  saldoPendiente: number;
  onPagoSuccess: () => void;
}

export function PagoDialog({
  open,
  onOpenChange,
  pagoId,
  initialPago,
  presupuestoId,
  clienteId,
  clienteNombre = '',
  presupuestoDisplay,
  totalPresupuesto,
  saldoPendiente,
  onPagoSuccess
}: PagoDialogProps) {
  const [monto, setMonto] = useState<string>('');
  const [metodo, setMetodo] = useState<string>('efectivo');
  const [referencia, setReferencia] = useState<string>('');
  const [nota, setNota] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (pagoId && initialPago) {
      setMonto(String(initialPago.monto ?? ""));
      setMetodo(initialPago.metodo_pago ?? "efectivo");
      setReferencia(initialPago.referencia ?? "");
      setNota(initialPago.nota ?? "");
      return;
    }
    setMonto("");
    setMetodo("efectivo");
    setReferencia("");
    setNota("");
  }, [open, pagoId, initialPago]);

  const handleSubmit = async () => {
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    if (montoNum > saldoPendiente) {
      toast.warning('El monto supera el saldo pendiente');
    }

    setLoading(true);
    try {
      if (pagoId) {
        await actualizarPago(pagoId, {
          monto: montoNum,
          metodo_pago: metodo,
          referencia,
          nota,
        });
        toast.success('Pago actualizado correctamente');
      } else {
        const data: PagoCreate = {
          presupuesto_id: presupuestoId,
          cliente_id: clienteId,
          monto: montoNum,
          metodo_pago: metodo,
          referencia,
          nota
        };
        const creado = await registrarPago(data);
        toast.success('Pago confirmado correctamente');
        openReciboPagoPrint({
          pago: creado,
          clienteNombre: clienteNombre.trim() || 'Cliente',
          presupuestoDisplay: (presupuestoDisplay || presupuestoId).trim(),
        });
      }
      onPagoSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(pagoId ? 'Error al actualizar el pago' : 'Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintRecibo = () => {
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingrese un monto válido para el comprobante');
      return;
    }
    const fechaIso =
      (pagoId && initialPago?.fecha) ? initialPago.fecha : new Date().toISOString();
    openReciboPagoPrint({
      pago: {
        id: pagoId || 'preview',
        presupuesto_id: presupuestoId,
        cliente_id: clienteId,
        monto: montoNum,
        fecha: fechaIso,
        metodo_pago: metodo,
        referencia,
        nota,
      },
      clienteNombre: clienteNombre.trim() || 'Cliente',
      presupuestoDisplay: (presupuestoDisplay || presupuestoId).trim(),
    });
  };

  const handleDelete = async () => {
    if (!pagoId) return;
    const ok = window.confirm("¿Eliminar este pago? Esta acción no se puede deshacer.");
    if (!ok) return;
    setLoading(true);
    try {
      await borrarPago(pagoId);
      toast.success("Pago eliminado");
      onPagoSuccess();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar el pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full h-fit max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pagoId ? "Editar Pago" : "Registrar Pago"}</DialogTitle>
          <DialogDescription className="sr-only">
            Formulario para registrar o editar pagos del presupuesto.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Presupuesto</Label>
              <div className="text-lg font-semibold">${totalPresupuesto.toLocaleString()}</div>
            </div>
            <div>
              <Label>Saldo Pendiente</Label>
              <div className="text-lg font-semibold text-red-600">${saldoPendiente.toLocaleString()}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monto">Monto a Pagar</Label>
            <Input
              id="monto"
              type="number"
              value={monto}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMonto(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metodo">Método de Pago</Label>
            <Select value={metodo} onValueChange={setMetodo}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="referencia">Referencia (Opcional)</Label>
            <Input
              id="referencia"
              value={referencia}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferencia(e.target.value)}
              placeholder="Nro. Comprobante / Transacción"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nota">Nota (Opcional)</Label>
            <Textarea
              id="nota"
              value={nota}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNota(e.target.value)}
              placeholder="Observaciones..."
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {pagoId ? (
            <>
              <Button type="button" variant="outline" onClick={handlePrintRecibo} disabled={loading} className="sm:mr-auto">
                Imprimir comprobante
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                Eliminar
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (pagoId ? "Guardando..." : "Registrando...") : (pagoId ? "Guardar Cambios" : "Confirmar Pago")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

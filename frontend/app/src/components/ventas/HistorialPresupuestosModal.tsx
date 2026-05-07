import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Search, Fingerprint, History, Pencil, FileText, Trash2 } from 'lucide-react';
import { del, get } from '../../api';
import { toast } from 'sonner';
import type { Lead } from '../../hook/usePipelineLeads';

export interface PresupuestoHistory {
  id: string;
  codigo?: string | null;
  cliente_nombre: string;
  direccion?: string | null;
  direccion_obra_texto?: string | null;
  total: number;
  estado: string;
  estado_pago?: string;
  pipeline_estado?: string;
  tipo_cobro?: string | null;
  plazo_pago_nombre?: string | null;
  condiciones_comerciales?: {
    plazo_pago?: string;
    descuento?: string;
  } | null;
  fecha_creacion?: string;
  createdAt?: string;
  archivado?: boolean;
  lead_id?: string | null;
  items?: { descripcion: string; cantidad: number; precio: number }[];
}

export function HistorialPresupuestosModal({
  isOpen,
  onClose,
  onDownloadPresupuesto,
  onEditLead,
  onEditPresupuesto,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDownloadPresupuesto: (presupuestoId: string, lead: Lead) => Promise<void>;
  onEditLead: (presupuesto: PresupuestoHistory) => Promise<void>;
  onEditPresupuesto: (presupuesto: PresupuestoHistory) => Promise<void>;
}) {
  const [presupuestos, setPresupuestos] = useState<PresupuestoHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterId, setFilterId] = useState('');

  useEffect(() => {
    if (isOpen) {
      void fetchPresupuestos();
    }
  }, [isOpen]);

  const fetchPresupuestos = async () => {
    setLoading(true);
    try {
      const data = await get<PresupuestoHistory[]>('/api/presupuestos?incluir_archivados=true');
      setPresupuestos(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al cargar historial de presupuestos');
    } finally {
      setLoading(false);
    }
  };

  const filteredPresupuestos = useMemo(() => {
    return presupuestos.filter((p) => {
      const estado = p.pipeline_estado || p.estado || p.estado_pago || 'pendiente';
      const matchesSearch = p.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || estado === filterStatus;
      const matchesId = filterId === '' || p.id.includes(filterId);
      return matchesSearch && matchesStatus && matchesId;
    });
  }, [presupuestos, searchTerm, filterStatus, filterId]);

  const getEstadoHistorial = (p: PresupuestoHistory) =>
    p.pipeline_estado || p.estado || p.estado_pago || 'pendiente';

  const formaPagoLabel = (p: PresupuestoHistory) => {
    const fromCond = p.condiciones_comerciales?.plazo_pago;
    const fromMeta = p.plazo_pago_nombre;
    const fromTipo = p.tipo_cobro;
    return String(fromCond || fromMeta || fromTipo || 'No definida');
  };

  const handleDeletePresupuesto = async (presupuestoId: string) => {
    const accepted = window.confirm('Esta seguro de que quiere eliminar el presupuesto?');
    if (!accepted) return;

    const clave = window.prompt('Para confirmar escriba ELIMINAR');
    if (clave !== 'ELIMINAR') {
      toast.error('Clave de confirmacion incorrecta');
      return;
    }

    try {
      await del(`/api/presupuestos/${presupuestoId}`);
      setPresupuestos((prev) => prev.filter((p) => p.id !== presupuestoId));
      toast.success('Presupuesto eliminado');
    } catch {
      toast.error('No se pudo eliminar el presupuesto');
    }
  };

  const syntheticLeadForPdf = (p: PresupuestoHistory): Lead => ({
    id: `presup:${p.id}`,
    nombre: p.cliente_nombre,
    telefono: '',
    email: '',
    direccion: '',
    estado: 'convertido',
    canales: [],
    prioridad: 'medio',
    comentario: '',
    createdAt: Date.now(),
    cliente_id: null,
    presupuesto_relacionado_id: null,
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historial de Presupuestos Generados
          </DialogTitle>
          <DialogDescription className="sr-only">
            Historial de presupuestos con filtros y acciones para descargar, editar o eliminar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Buscar por Cliente</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Nombre del cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Filtrar por ID</Label>
              <div className="relative">
                <Fingerprint className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="ID Presupuesto..."
                  value={filterId}
                  onChange={(e) => setFilterId(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <select
                className="w-full p-2 border rounded-md"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm font-semibold">Fecha</TableHead>
                  <TableHead className="text-sm font-semibold">Cliente</TableHead>
                  <TableHead className="text-sm font-semibold">ID</TableHead>
                  <TableHead className="text-sm font-semibold">Forma de pago</TableHead>
                  <TableHead className="text-sm font-semibold">Total</TableHead>
                  <TableHead className="text-sm font-semibold">Estado</TableHead>
                  <TableHead className="text-sm font-semibold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-base">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filteredPresupuestos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-base text-gray-500">
                      No se encontraron presupuestos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPresupuestos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="py-3 text-sm">
                        {new Date(p.createdAt || p.fecha_creacion || Date.now()).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="py-3 text-sm font-medium">{p.cliente_nombre}</TableCell>
                      <TableCell className="py-3 text-sm font-mono">
                        {(p.codigo && String(p.codigo).trim()) || p.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        <div className="max-w-[180px]">
                          <div>{formaPagoLabel(p)}</div>
                          {(p.direccion_obra_texto || p.direccion) && (
                            <div className="text-xs text-muted-foreground line-clamp-2" title={String(p.direccion_obra_texto || p.direccion)}>
                              {String(p.direccion_obra_texto || p.direccion)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm font-medium">${p.total.toLocaleString()}</TableCell>
                      <TableCell className="py-3 text-sm">
                        {(() => {
                          const estado = getEstadoHistorial(p);
                          return (
                            <Badge
                              variant={
                                estado === 'convertido' || estado === 'aprobado'
                                  ? 'default'
                                  : estado === 'pendiente' || estado === 'contactado'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {estado}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="ghost" size="default" onClick={() => void onEditLead(p)}>
                            <Pencil className="w-4 h-4 mr-1" />
                            Editar Lead
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => void onEditPresupuesto(p)}>
                            Editar Prespup
                          </Button>
                          <Button
                            variant="ghost"
                            size="default"
                            onClick={() => void onDownloadPresupuesto(p.id, syntheticLeadForPdf(p))}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            PDF
                          </Button>
                          <Button
                            variant="ghost"
                            size="default"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => void handleDeletePresupuesto(p.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

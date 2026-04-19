import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useDrag, useDrop } from 'react-dnd';

import {
  Plus, Phone, Mail, MapPin, Users, CheckCircle2, UserPlus, Pencil, Save, Clock, XCircle,
  AlertTriangle, Search, Filter, Paperclip, Upload, Fingerprint, Trash2, FileText, ArrowRight, ArrowLeft, History
} from 'lucide-react';
import { LocationPicker } from '../common/LocationPicker';
import { PageHeader } from '../common/PageHeader';
import { Badge } from '../ui/badge';
import { get } from '../../api';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Lead, usePipelineLeads } from '../../hook/usePipelineLeads';

interface PresupuestoHistory {
  id: string;
  cliente_nombre: string;
  total: number;
  estado: string;
  fecha_creacion?: string;
  createdAt?: string;
  items: { descripcion: string; cantidad: number; precio: number }[];
}

function HistorialPresupuestosModal({
  isOpen,
  onClose,
  onDownloadPresupuesto
}: {
  isOpen: boolean;
  onClose: () => void;
  onDownloadPresupuesto: (presupuestoId: string, lead: Lead) => Promise<void>;
}) {
  const [presupuestos, setPresupuestos] = useState<PresupuestoHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterId, setFilterId] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchPresupuestos();
    }
  }, [isOpen]);

  const fetchPresupuestos = async () => {
    setLoading(true);
    try {
      const data = await get<PresupuestoHistory[]>('/api/presupuestos');
      setPresupuestos(data);
    } catch (error) {
      toast.error('Error al cargar historial de presupuestos');
    } finally {
      setLoading(false);
    }
  };

  const filteredPresupuestos = useMemo(() => {
    return presupuestos.filter(p => {
      const matchesSearch = p.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || p.estado === filterStatus;
      const matchesId = filterId === '' || p.id.includes(filterId);
      return matchesSearch && matchesStatus && matchesId;
    });
  }, [presupuestos, searchTerm, filterStatus, filterId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historial de Presupuestos Generados
          </DialogTitle>
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

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filteredPresupuestos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No se encontraron presupuestos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPresupuestos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.createdAt || p.fecha_creacion || Date.now()).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{p.cliente_nombre}</TableCell>
                      <TableCell className="text-xs font-mono">{p.id.slice(0, 8)}</TableCell>
                      <TableCell>${p.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={
                          p.estado === 'aprobado' ? 'default' :
                            p.estado === 'pendiente' ? 'secondary' :
                              'outline'
                        }>
                          {p.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDownloadPresupuesto(p.id, {
                            id: `presup:${p.id}`,
                            nombre: p.cliente_nombre,
                            telefono: '',
                            email: '',
                            direccion: '',
                            estado: 'convertido',
                            canales: [],
                            prioridad: 'medio',
                            comentario: '',
                            archivos: [],
                            createdAt: Date.now()
                          })}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
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

const COMUNAS = [
  'Capital', 'Rivadavia', 'Rawson', 'Chimbas', 'Santa Lucía',
  'Pocito', 'Caucete', 'Albardón', 'Jáchal', 'Sarmiento',
  '25 de Mayo', 'San Martín', 'Angaco', '9 de Julio', 'Ullum', 'Zonda', 'Otro'
];

const CANALES_CONTACTO = [
  'Web (Formulario)', 'WhatsApp', 'Redes Sociales', 'Mostrador físico', 'Referido'
];

const PRIORIDADES = {
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
  alto: { label: 'Alto', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle },
  medio: { label: 'Medio', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  bajo: { label: 'Bajo', color: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: Clock },
};

const DraggableLead = ({ lead, children }: { lead: Lead, children: React.ReactNode }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'LEAD',
    item: { id: lead.id, estado: lead.estado },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [lead.id, lead.estado]);
  return (
    <div ref={drag as unknown as React.LegacyRef<HTMLDivElement>} style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}>
      {children}
    </div>
  );
};

const DroppableColumn = ({
  columnaId,
  onDropLead,
  children,
  className
}: {
  columnaId: string,
  onDropLead: (id: string, newStatus: any) => void,
  children: React.ReactNode,
  className?: string
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'LEAD',
    drop: (item: { id: string, estado: string }) => {
      if (item.estado !== columnaId) {
        onDropLead(item.id, columnaId);
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }), [columnaId, onDropLead]);

  return (
    <div ref={drop as unknown as React.LegacyRef<HTMLDivElement>} className={`${className} transition-colors ${isOver ? 'bg-primary/5 ring-2 ring-primary/20 rounded-xl' : ''}`}>
      {children}
    </div>
  );
};

export function PipelineLeads() {
  const {
    isDialogOpen,
    setIsDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isAdmin,
    loading,
    searchTerm,
    setSearchTerm,
    filterPriority,
    setFilterPriority,
    filterChannel,
    setFilterChannel,
    filterDate,
    setFilterDate,
    filterStatus,
    setFilterStatus,
    showMapPicker,
    setShowMapPicker,
    isFilterDialogOpen,
    setIsFilterDialogOpen,
    isHistoryDialogOpen,
    setIsHistoryDialogOpen,
    newLead,
    setNewLead,
    editingLead,
    setEditingLead,
    errors,
    handleInputChange,
    handleChannelToggle,
    handleFileChange,
    openWhatsApp,
    handleCreateLead,
    handleUpdateLead,
    handleEstadoChange,
    openEditDialog,
    openGoogleMaps,
    handleDownloadPresupuesto,
    leadsByEstado,
  } = usePipelineLeads();

  const columnas = [
    {
      id: 'recibir_posible' as const,
      titulo: 'Nuevos Leads',
      icon: UserPlus,
      color: 'border-cyan-200 bg-cyan-50/50'
    },
    {
      id: 'contactado' as const,
      titulo: 'En Contacto',
      icon: Phone,
      color: 'border-amber-200 bg-amber-50/50'
    },
    {
      id: 'seguimiento' as const,
      titulo: 'En Seguimiento',
      icon: Clock,
      color: 'border-purple-200 bg-purple-50/50'
    },
    {
      id: 'convertido' as const,
      titulo: 'Convertidos',
      icon: CheckCircle2,
      color: 'border-emerald-200 bg-emerald-50/50'
    },
    {
      id: 'perdido' as const,
      titulo: 'Perdidos / Baja',
      icon: XCircle,
      color: 'border-red-200 bg-red-50/50'
    }
  ];

  const handleLocationSelect = (address: string, comuna?: string) => {
    if (isEditDialogOpen && editingLead) {
      setEditingLead(prev => prev ? ({ ...prev, direccion: address, comuna: comuna || prev.comuna }) : null);
    } else {
      setNewLead(prev => ({ ...prev, direccion: address, comuna: comuna || prev.comuna }));
    }
    setShowMapPicker(false);
  };

  const renderLeadForm = (isEdit: boolean) => {
    const data = isEdit ? editingLead! : newLead;
    return (
      <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto px-1">
        {/* Info Básica */}
        <div className="space-y-3 border-b pb-4">
          <h4 className="font-medium text-sm text-muted-foreground">Información Básica</h4>
          <div className="space-y-1">
            <Label className="text-xs">Nombre Completo *</Label>
            <Input
              value={data.nombre}
              onChange={(e) => handleInputChange('nombre', e.target.value, isEdit)}
              className={errors.nombre ? 'border-red-500' : ''}
              placeholder="Ej: Juan Pérez"
            />
            {errors.nombre && <span className="text-xs text-red-500">{errors.nombre}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Teléfono *</Label>
              <Input
                value={data.telefono}
                onChange={(e) => handleInputChange('telefono', e.target.value, isEdit)}
                className={errors.telefono ? 'border-red-500' : ''}
                placeholder="+56 9..."
              />
              {errors.telefono && <span className="text-xs text-red-500">{errors.telefono}</span>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                value={data.email}
                onChange={(e) => handleInputChange('email', e.target.value, isEdit)}
                className={errors.email ? 'border-red-500' : ''}
                type="email"
                placeholder="correo@ejemplo.com"
              />
              {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">DNI / CUIL</Label>
              <Input
                value={data.dni || ''}
                onChange={(e) => handleInputChange('dni', e.target.value, isEdit)}
                placeholder="Documento del cliente"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comuna</Label>
              <select
                title="Seleccionar comuna"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={data.comuna || ''}
                onChange={(e) => handleInputChange('comuna', e.target.value, isEdit)}
              >
                <option value="">Seleccionar...</option>
                {COMUNAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dirección</Label>
            <div className="flex gap-2">
              <Input
                value={data.direccion}
                onChange={(e) => handleInputChange('direccion', e.target.value, isEdit)}
                placeholder="Calle, número..."
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Seleccionar en Mapa"
                onClick={() => setShowMapPicker(true)}
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Clasificación */}
        <div className="space-y-3 border-b pb-4">
          <h4 className="font-medium text-sm text-muted-foreground">Clasificación</h4>
          <div className="space-y-1">
            <Label className="text-xs">Prioridad</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(PRIORIDADES).map(([key, config]) => (
                <div
                  key={key}
                  className={`cursor-pointer rounded-md border p-2 text-center text-xs transition-all ${data.prioridad === key
                    ? config.color + ' ring-2 ring-offset-1 ring-primary'
                    : 'bg-background hover:bg-accent'
                    }`}
                  onClick={() => handleInputChange('prioridad', key, isEdit)}
                >
                  {config.label}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Canales de Contacto</Label>
            <div className="grid grid-cols-2 gap-2">
              {CANALES_CONTACTO.map(canal => (
                <label key={canal} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={(data.canales || []).includes(canal)}
                    onChange={() => handleChannelToggle(canal, isEdit)}
                  />
                  <span className="text-xs">{canal}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Detalles */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Detalles Adicionales</h4>
          <div className="space-y-1">
            <Label className="text-xs">Comentario / Motivo (Mín. 20 carac.)</Label>
            <textarea
              className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errors.comentario ? 'border-red-500' : ''}`}
              value={data.comentario}
              onChange={(e) => handleInputChange('comentario', e.target.value, isEdit)}
              placeholder="Detalle la solicitud..."
            />
            {errors.comentario && <span className="text-xs text-red-500">{errors.comentario}</span>}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Adjuntar Archivos</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                multiple
                className="text-xs"
                onChange={(e) => handleFileChange(e, isEdit)}
              />
            </div>
            {data.archivos && data.archivos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {data.archivos.map((file, idx) => (
                  <Badge key={idx} variant="secondary" className="text-[10px] gap-1">
                    <Paperclip className="h-3 w-3" />
                    {file}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {isEdit && (
            <div className="space-y-1">
              <Label className="text-xs">Estado Pipeline</Label>
              <select
                title="Estado del pipeline"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={data.estado}
                onChange={(e) => handleInputChange('estado', e.target.value, isEdit)}
              >
                <option value="recibir_posible">Nuevos Leads</option>
                <option value="contactado">En Contacto</option>
                <option value="seguimiento">En Seguimiento</option>
                <option value="convertido">Convertidos</option>
                <option value="perdido">Perdidos / Baja</option>
              </select>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader
        icon={Users}
        title="Pipeline de Leads"
        description="Gestión avanzada de prospectos y oportunidades"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsHistoryDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              Historial Presupuestos
            </Button>

          </div>
        }
      />

      <HistorialPresupuestosModal
        isOpen={isHistoryDialogOpen}
        onClose={() => setIsHistoryDialogOpen(false)}
        onDownloadPresupuesto={handleDownloadPresupuesto}
      />

      <div className="px-4 sm:px-6 py-2 border-b bg-muted/20 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, teléfono, ID..."
            className="h-8 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={() => setIsFilterDialogOpen(true)}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>


        </div>
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtros de Leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <option value="all">Todas las prioridades</option>
                {Object.entries(PRIORIDADES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Canal</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
              >
                <option value="all">Todos los canales</option>
                {CANALES_CONTACTO.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fecha Creación</Label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado Pipeline</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="recibir_posible">Nuevos Leads</option>
                <option value="contactado">En Contacto</option>
                <option value="seguimiento">En Seguimiento</option>
                <option value="convertido">Convertidos</option>
                <option value="perdido">Perdidos / Baja</option>
              </select>
            </div>
            <Button variant="ghost" className="w-full mt-4" onClick={() => {
              setFilterPriority('all');
              setFilterChannel('all');
              setFilterDate('');
              setFilterStatus('all');
            }}>
              Limpiar Filtros
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl w-full h-fit max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>
          {editingLead && (
            <>
              {renderLeadForm(true)}
              <Button onClick={handleUpdateLead} className="w-full mt-2">
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:flex gap-6">
          {columnas.map((columna) => {
            const Icon = columna.icon;
            const leadsColumna = leadsByEstado[columna.id];

            return (
              <DroppableColumn
                key={columna.id}
                columnaId={columna.id}
                onDropLead={handleEstadoChange}
                className="flex flex-col min-w-[280px] lg:w-[320px] lg:flex-shrink-0"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-foreground font-medium">{columna.titulo}</h3>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {leadsColumna.length}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {leadsColumna.length === 0 ? (
                    <div className={`rounded-xl border-2 border-dashed ${columna.color} p-8 text-center opacity-70`}>
                      <p className="text-muted-foreground text-sm">
                        Sin leads
                      </p>
                    </div>
                  ) : (
                    leadsColumna.map((lead) => {
                      const PriorityIcon = PRIORIDADES[lead.prioridad]?.icon || AlertTriangle;
                      return (
                        <DraggableLead key={lead.id} lead={lead}>
                          <Card className="hover:shadow-lg transition-all duration-200 border-border group relative overflow-hidden">
                            {/* Priority Indicator Strip */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${PRIORIDADES[lead.prioridad]?.color.split(' ')[0].replace('bg-', 'bg-') || 'bg-gray-300'}`} />

                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 z-10"
                                onClick={() => openEditDialog(lead)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}

                            <CardHeader className="pb-2 pt-4 pl-5 pr-8">
                              <div className="flex justify-between items-start mb-1">
                                <Badge variant="outline" className={`text-[10px] px-1 py-0 h-5 ${PRIORIDADES[lead.prioridad]?.color}`}>
                                  {PRIORIDADES[lead.prioridad]?.label}
                                </Badge>
                                <div className="flex items-center gap-2">
                                  {lead.id.startsWith('client:') && (
                                    <Badge variant="secondary" className="text-[10px] h-5 bg-cyan-100 text-cyan-700">Cliente</Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(lead.createdAt).toLocaleDateString()} {new Date(lead.createdAt).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                              <CardTitle className="text-foreground text-base truncate" title={lead.nombre}>
                                {lead.nombre}
                              </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-2 pl-5 pb-3">
                              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                <Phone className="h-3.5 w-3.5 text-primary/70" />
                                <span>{lead.telefono}</span>
                              </div>
                              {lead.dni && (
                                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                  <Fingerprint className="h-3.5 w-3.5 text-primary/70" />
                                  <span>{lead.dni}</span>
                                </div>
                              )}
                              {lead.comuna && (
                                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                  <MapPin className="h-3.5 w-3.5 text-primary/70" />
                                  <span>{lead.comuna}</span>
                                </div>
                              )}
                              {lead.canales && lead.canales.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {lead.canales.slice(0, 2).map(c => (
                                    <span key={c} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">
                                      {c}
                                    </span>
                                  ))}
                                  {lead.canales.length > 2 && (
                                    <span className="text-[10px] text-muted-foreground">+{lead.canales.length - 2}</span>
                                  )}
                                </div>
                              )}

                              {lead.presupuesto_info && (lead.presupuesto_info.material || lead.presupuesto_info.metros !== undefined || lead.presupuesto_info.total !== undefined) && (
                                <div className="rounded-md bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground space-y-0.5">
                                  {lead.presupuesto_info.material && (
                                    <div>
                                      Material: <span className="text-foreground">{lead.presupuesto_info.material}</span>
                                    </div>
                                  )}
                                  {lead.presupuesto_info.metros !== undefined && lead.presupuesto_info.metros !== null && (
                                    <div>
                                      Superficie: <span className="text-foreground">{Number(lead.presupuesto_info.metros).toFixed(2)} m²</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {lead.presupuesto_relacionado_id && (
                                <div className="mt-2">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="w-full h-7 text-xs gap-2 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200"
                                    onClick={() => handleDownloadPresupuesto(lead.presupuesto_relacionado_id!, lead)}
                                  >
                                    <FileText className="h-3 w-3" />
                                    Ver Presupuesto
                                  </Button>
                                </div>
                              )}

                              <div className="mt-3 pt-2 border-t space-y-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full h-7 text-xs"
                                  onClick={() => openGoogleMaps(lead)}
                                >
                                  Mapa
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 text-xs"
                                  disabled={!lead.telefono}
                                  onClick={() => openWhatsApp(lead)}
                                >
                                  WhatsApp
                                </Button>
                              </div>

                              {/* Navegación por Pasos (Acciones Rápidas) */}
                              <div className="flex items-center justify-between gap-1 mt-3 pt-2 border-t">
                                {/* Botón Atrás */}
                                {columna.id !== 'recibir_posible' && columna.id !== 'perdido' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-gray-500 hover:text-gray-900"
                                    title="Volver al paso anterior"
                                    onClick={() => {
                                      const prevMap: Record<string, any> = {
                                        'contactado': 'recibir_posible',
                                        'seguimiento': 'contactado',
                                        'convertido': 'seguimiento'
                                      };
                                      if (prevMap[columna.id]) handleEstadoChange(lead, prevMap[columna.id]);
                                    }}
                                  >
                                    <ArrowLeft className="h-3 w-3 mr-1" />
                                    Atrás
                                  </Button>
                                )}

                                {/* Espaciador si no hay botón atrás */}
                                {(columna.id === 'recibir_posible' || columna.id === 'perdido') && <div />}

                                {/* Botón Avanzar */}
                                {columna.id === 'recibir_posible' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                                    onClick={() => handleEstadoChange(lead, 'contactado')}
                                  >
                                    Contactar
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                  </Button>
                                )}

                                {columna.id === 'contactado' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                                    onClick={() => handleEstadoChange(lead, 'seguimiento')}
                                  >
                                    Seguimiento
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                  </Button>
                                )}

                                {columna.id === 'seguimiento' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleEstadoChange(lead, 'convertido')}
                                  >
                                    Convertir
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                  </Button>
                                )}

                                {columna.id !== 'perdido' && columna.id !== 'convertido' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-gray-400 hover:text-red-600"
                                    title="Marcar como Perdido"
                                    onClick={() => handleEstadoChange(lead, 'perdido')}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </DraggableLead>
                      );
                    })
                  )}
                </div>
              </DroppableColumn>
            );
          })}
        </div>
      </div>   <HistorialPresupuestosModal
        isOpen={isHistoryDialogOpen}
        onClose={() => setIsHistoryDialogOpen(false)}
        onDownloadPresupuesto={handleDownloadPresupuesto}
      />

      <Dialog open={showMapPicker} onOpenChange={setShowMapPicker}>
        <DialogContent className="max-w-3xl w-full h-fit max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Seleccionar Ubicación</DialogTitle>
          </DialogHeader>
          <LocationPicker
            onConfirm={handleLocationSelect}
            onCancel={() => setShowMapPicker(false)}
          />
        </DialogContent>
      </Dialog>
    </div >
  );
}

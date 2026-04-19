import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { MapPin, Map as MapIcon, Check, ChevronsUpDown, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { LocationPicker } from '../../components/common/LocationPicker';
import { useMemo, useState } from 'react';
import { cn } from '../ui/utils';

interface Props {
  clientes: any[];
  clienteId: string;
  formCliente: {
    nombre: string;
    email: string;
    telefono: string;
    direccion: string;
    coordenadas?: string;
  };
  editingExisting: boolean;
  onSelect: (id: string) => void;
  onFormChange: (data: any) => void;
  onGuardarNuevo: () => void;
  onEditarExistente: () => void;
}

export function ClienteForm({
  clientes,
  clienteId,
  formCliente,
  editingExisting,
  onSelect,
  onFormChange,
  onGuardarNuevo,
  onEditarExistente
}: Props) {

  const [mapOpen, setMapOpen] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const abrirEnMaps = () => {
    if (!formCliente.coordenadas) return;
    const coords = formCliente.coordenadas.replace(/\s/g, '');
    window.open(`https://www.google.com/maps/search/?api=1&query=${coords}`, '_blank');
  };

  const uniqueClientes = useMemo(() => {
    const map: Record<string, any> = {};
    const norm = (c: any) => {
      const base =
        (c.dni_cuit || c.cuit || c.dni || c.email || c.telefono || c.nombre || '').toString().toLowerCase();
      return base.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    };
    for (const c of clientes || []) {
      const k = norm(c) || c.id?.toString() || Math.random().toString();
      if (!map[k]) map[k] = c;
    }
    return Object.values(map);
  }, [clientes]);
  const duplicatesDetected = useMemo(() => {
    return (clientes?.length || 0) > (uniqueClientes?.length || 0);
  }, [clientes, uniqueClientes]);
  const conflictsWithExisting = useMemo(() => {
    const normFromForm = () => {
      const base =
        (formCliente?.email || formCliente?.telefono || formCliente?.nombre || '').toString().toLowerCase();
      return base.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    };
    const key = normFromForm();
    if (!key) return false;
    const set = new Set(
      (uniqueClientes || []).map((c: any) => {
        const base =
          (c.dni_cuit || c.cuit || c.dni || c.email || c.telefono || c.nombre || '').toString().toLowerCase();
        return base.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      })
    );
    return set.has(key);
  }, [uniqueClientes, formCliente]);

  const selectedCliente = clientes.find(c => c.id === clienteId);

  const isFormValid = useMemo(() => {
    return formCliente.nombre.trim().length >= 3;
  }, [formCliente.nombre]);

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0">
        <CardTitle>1. Datos del Cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        <div>
          <Label>Seleccionar Cliente</Label>
          <div className="space-y-2">
            {duplicatesDetected && (
              <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded">
                Se detectaron posibles duplicados. La lista muestra una sola entrada por cliente.
              </div>
            )}
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between h-12 text-lg font-normal"
                >
                  {clienteId === 'nuevo'
                    ? "+ Nuevo Cliente"
                    : selectedCliente
                      ? (selectedCliente.nombre + (selectedCliente.id.toString().startsWith('lead:') ? ' (Lead)' : ''))
                      : "Buscar cliente..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nombre, teléfono..." />
                  <CommandList>
                    <CommandEmpty>
                      <div className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-2">No se encontró el cliente.</p>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            onSelect('nuevo');
                            setOpenCombobox(false);
                          }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Crear Nuevo Cliente
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup heading="Acciones">
                      <CommandItem
                        value="crear_nuevo_cliente_action"
                        onSelect={() => {
                          onSelect('nuevo');
                          setOpenCombobox(false);
                        }}
                        className="text-cyan-600 font-semibold cursor-pointer"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        + Nuevo Cliente
                      </CommandItem>
                    </CommandGroup>
                    <CommandGroup heading="Clientes Existentes">
                      {uniqueClientes.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.nombre} ${c.telefono || ''} ${c.email || ''}`}
                          onSelect={() => {
                            onSelect(c.id);
                            setOpenCombobox(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              clienteId === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{c.nombre}</span>
                            {c.telefono && <span className="text-xs text-muted-foreground">{c.telefono}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {clienteId ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Nombre Completo <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formCliente.nombre}
                  onChange={e => onFormChange({ ...formCliente, nombre: e.target.value })}
                  disabled={!editingExisting && clienteId !== 'nuevo'}
                  placeholder="Ej: Juan Pérez"
                  className={cn(
                    clienteId === 'nuevo' && formCliente.nombre.trim().length > 0 && formCliente.nombre.trim().length < 3 && "border-red-300 focus-visible:ring-red-100"
                  )}
                />
                {clienteId === 'nuevo' && formCliente.nombre.trim().length > 0 && formCliente.nombre.trim().length < 3 && (
                  <p className="text-[10px] text-red-500">Mínimo 3 caracteres</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Teléfono
                </Label>
                <Input
                  value={formCliente.telefono}
                  onChange={e => onFormChange({ ...formCliente, telefono: e.target.value })}
                  disabled={!editingExisting && clienteId !== 'nuevo'}
                  placeholder="Ej: 264 4567890"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input
                  value={formCliente.direccion}
                  onChange={e => onFormChange({ ...formCliente, direccion: e.target.value })}
                  disabled={!editingExisting && clienteId !== 'nuevo'}
                  placeholder="Calle, Altura, Localidad"
                />
              </div>

              <div className="space-y-2">
                <Label>Coordenadas (GPS)</Label>
                <div className="flex gap-2">
                  <Input
                    value={formCliente.coordenadas || ''}
                    onChange={e => onFormChange({ ...formCliente, coordenadas: e.target.value })}
                    disabled={!editingExisting && clienteId !== 'nuevo'}
                    placeholder="-31.528067, -68.546379"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={abrirEnMaps}
                    disabled={!formCliente.coordenadas}
                    title="Abrir en Google Maps"
                    type="button"
                  >
                    <MapPin className="h-4 w-4 text-cyan-600" />
                  </Button>

                  <Dialog open={mapOpen} onOpenChange={setMapOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Seleccionar en Mapa"
                        type="button"
                        className="bg-green-50 hover:bg-green-100 border-green-200"
                      >
                        <MapIcon className="h-4 w-4 text-green-600" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl h-[70vh] rounded-xl">
                      <DialogHeader>
                        <DialogTitle>Seleccionar Ubicación</DialogTitle>
                      </DialogHeader>
                      <div className="flex-1 h-full min-h-0">
                        <LocationPicker
                          initialCoordinates={formCliente.coordenadas}
                          onConfirm={(address, comuna) => {
                            // address already contains [lat, lng] from LocationPicker
                            const coordsMatch = address.match(/\[(.*?)\]/);
                            const coords = coordsMatch ? coordsMatch[1] : "";
                            const cleanAddress = address.replace(/\s\[.*?\]/, "");

                            onFormChange({
                              ...formCliente,
                              direccion: cleanAddress || formCliente.direccion,
                              coordenadas: coords || formCliente.coordenadas
                            });
                            setMapOpen(false);
                          }}
                          onCancel={() => setMapOpen(false)}
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={formCliente.email}
                onChange={e => onFormChange({ ...formCliente, email: e.target.value })}
                disabled={!editingExisting && clienteId !== 'nuevo'}
              />
            </div>

            <div className="pt-2">
              {clienteId === 'nuevo' ? (
                <>
                  {conflictsWithExisting && (
                    <div className="text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-2">
                      Ya existe un cliente con datos similares. Seleccione el existente para evitar duplicados.
                    </div>
                  )}
                  <Button
                    onClick={onGuardarNuevo}
                    className={cn(
                      "w-full transition-all duration-200",
                      isFormValid ? "bg-cyan-600 hover:bg-cyan-700" : "bg-gray-400 cursor-not-allowed opacity-70"
                    )}
                    disabled={conflictsWithExisting || !isFormValid}
                  >
                    {isFormValid ? "Guardar Nuevo Cliente" : "Complete los campos obligatorios"}
                  </Button>
                </>
              ) : (
                !editingExisting ? (
                  <Button variant="outline" className="w-full" onClick={onEditarExistente}>
                    Editar Datos
                  </Button>
                ) : (
                  <Button 
                    onClick={onGuardarNuevo} 
                    className={cn(
                      "w-full transition-all duration-200",
                      isFormValid ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed opacity-70"
                    )}
                    disabled={!isFormValid}
                  >
                    {isFormValid ? "Guardar Cambios" : "Complete los campos obligatorios"}
                  </Button>
                )
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

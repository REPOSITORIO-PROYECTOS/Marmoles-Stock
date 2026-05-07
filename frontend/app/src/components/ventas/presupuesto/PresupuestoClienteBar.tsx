import { useMemo, useState } from 'react';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../ui/command';
import { Check, ChevronsUpDown, UserPlus, Pencil } from 'lucide-react';
import { cn } from '../../ui/utils';

type Props = {
  clientes: any[];
  clienteId: string;
  formCliente: {
    nombre: string;
    email: string;
    telefono: string;
    direccion: string;
    coordenadas?: string;
  };
  onSelectCliente: (id: string) => void;
  onAltaRapida: () => void;
  onEditarCliente: () => void;
};

export function PresupuestoClienteBar({
  clientes,
  clienteId,
  formCliente,
  onSelectCliente,
  onAltaRapida,
  onEditarCliente,
}: Props) {
  const [open, setOpen] = useState(false);

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

  const selected = clientes.find((c) => c.id === clienteId);
  const hasRealCliente = Boolean(clienteId && clienteId !== 'nuevo');

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
      <div className="flex-1 min-w-[200px] space-y-1">
        <Label className="text-xs text-muted-foreground">Cliente</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between h-10 font-normal"
              type="button"
            >
              {clienteId === 'nuevo'
                ? '+ Nuevo cliente'
                : selected
                  ? selected.nombre
                  : 'Buscar cliente…'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(100vw-2rem,400px)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Nombre, teléfono…" />
              <CommandList>
                <CommandEmpty>No hay resultados.</CommandEmpty>
                <CommandGroup heading="Acciones">
                  <CommandItem
                    value="__nuevo__"
                    onSelect={() => {
                      onSelectCliente('nuevo');
                      setOpen(false);
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Nuevo cliente (formulario abajo o alta rápida)
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Clientes">
                  {uniqueClientes.map((c: any) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.nombre} ${c.telefono || ''}`}
                      onSelect={() => {
                        onSelectCliente(c.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn('mr-2 h-4 w-4', clienteId === c.id ? 'opacity-100' : 'opacity-0')}
                      />
                      <div className="flex flex-col">
                        <span>{c.nombre}</span>
                        {c.telefono ? (
                          <span className="text-xs text-muted-foreground">{c.telefono}</span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" className="h-10" onClick={onAltaRapida}>
          <UserPlus className="w-4 h-4 mr-1" />
          Alta rápida
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10"
          disabled={!hasRealCliente}
          onClick={onEditarCliente}
        >
          <Pencil className="w-4 h-4 mr-1" />
          Editar cliente
        </Button>
      </div>
      {hasRealCliente && (
        <div className="w-full text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
          <span className="font-medium text-foreground">{formCliente.nombre || selected?.nombre}</span>
          {formCliente.telefono ? <span className="mx-2">· {formCliente.telefono}</span> : null}
          {formCliente.email ? (
            <span className="block sm:inline sm:mt-0 mt-1 sm:ml-2 truncate">{formCliente.email}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

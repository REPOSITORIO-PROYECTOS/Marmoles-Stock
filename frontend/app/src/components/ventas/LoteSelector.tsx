import React, { useState } from 'react';
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Check, ChevronsUpDown, CheckCircle2 } from "lucide-react";
import { cn } from "../../components/ui/utils";
import { Button } from "../../components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";

interface LoteSelectorProps {
  materiales: any[];
  lotes: any[];
  selectedMaterialId: string;
  selectedLoteId: string;
  precioBase: number;
  precioTipo: 'menor' | 'mayor';
  hideLotes?: boolean;
  onMaterialChange: (id: string) => void;
  onLoteChange: (id: string) => void;
  onPrecioTipoChange: (tipo: 'menor' | 'mayor') => void;
  onProductoSelect?: (producto: { id: string; nombre: string; precio_venta?: number; unidad?: string }) => void;
}

export function LoteSelector({
  materiales,
  lotes,
  selectedMaterialId,
  selectedLoteId,
  precioBase,
  precioTipo,
  hideLotes,
  onMaterialChange,
  onLoteChange,
  onPrecioTipoChange,
  onProductoSelect
}: LoteSelectorProps) {

  const [openMaterial, setOpenMaterial] = useState(false);
  const [openLote, setOpenLote] = useState(false);

  const manualMaterial = { id: '__manual__', nombre: 'Material Manual (sin stock)', precio_m2: null, unidad: 'm²' };
  const sinMaterial = { id: '__sin_material__', nombre: 'Sin material (presupuesto libre)', precio_m2: 0, unidad: 'm²' };
  const selectedMaterial = selectedMaterialId === manualMaterial.id
    ? manualMaterial
    : selectedMaterialId === sinMaterial.id
      ? sinMaterial
      : materiales.find(m => m.id === selectedMaterialId);
  const selectedLote = lotes.find(l => l.id === selectedLoteId);
  const precioMenor = selectedMaterial ? Number(selectedMaterial.precio_m2 || 0) : 0;
  const precioMayor = selectedMaterial
    ? (selectedMaterial.precio_mayor_m2 != null ? Number(selectedMaterial.precio_mayor_m2 || 0) : precioMenor)
    : 0;
  const precioActual = precioTipo === 'mayor' ? precioMayor : precioMenor;
  const shouldShowLotes =
    !hideLotes &&
    !!selectedMaterialId &&
    selectedMaterialId !== manualMaterial.id &&
    selectedMaterialId !== sinMaterial.id;

  return (
    <div className="space-y-6">
      {/* 1. SELECCIÓN DE MATERIAL */}
      <div className="space-y-2">
        <Label className="text-base font-black uppercase tracking-tight text-primary">1. Seleccionar Material</Label>

        <Popover open={openMaterial} onOpenChange={setOpenMaterial}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openMaterial}
              className={cn(
                "w-full justify-between h-16 bg-white border-2 transition-all",
                selectedMaterialId ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
              )}
            >
              {selectedMaterial ? (
                <div className="flex min-w-0 flex-col items-start">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Material Seleccionado</span>
                  <div className="flex w-full items-center gap-2">
                    <span className="truncate text-lg font-black">{selectedMaterial.nombre}</span>
                    {typeof selectedMaterial.precio_m2 === 'number' ? (
                      <span className="shrink-0 text-sm font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        ${precioActual.toLocaleString()} / {selectedMaterial.unidad || 'm²'}
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Sin precio
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-base font-semibold text-muted-foreground">Elegir material...</span>
              )}
              <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <>
                <CommandInput placeholder="Buscar material..." className="h-12" />
                <CommandList className="max-h-75">
                  <CommandEmpty>No se encontró material.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value={sinMaterial.nombre}
                      onSelect={() => {
                        onMaterialChange(sinMaterial.id);
                        setOpenMaterial(false);
                      }}
                      className="cursor-pointer p-3"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-5 w-5 text-primary",
                          selectedMaterialId === sinMaterial.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex justify-between w-full items-center">
                        <span className="font-bold text-base">{sinMaterial.nombre}</span>
                        <span className="font-black text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">
                          Libre
                        </span>
                      </div>
                    </CommandItem>
                    <CommandItem
                      value={manualMaterial.nombre}
                      onSelect={() => {
                        onMaterialChange(manualMaterial.id);
                        setOpenMaterial(false);
                      }}
                      className="cursor-pointer p-3"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-5 w-5 text-primary",
                          selectedMaterialId === manualMaterial.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex justify-between w-full items-center">
                        <span className="font-bold text-base">{manualMaterial.nombre}</span>
                        <span className="font-black text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">
                          Manual
                        </span>
                      </div>
                    </CommandItem>
                    {materiales.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={m.nombre}
                        onSelect={() => {
                          onMaterialChange(m.id);
                          setOpenMaterial(false);
                        }}
                        className="cursor-pointer p-3"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-5 w-5 text-primary",
                            selectedMaterialId === m.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex justify-between w-full items-center">
                          <span className="font-bold text-base">{m.nombre}</span>
                          <span className="font-black text-primary bg-primary/10 px-3 py-1 rounded-full text-sm">
                            ${m.precio_m2?.toLocaleString()} / {m.unidad || 'm²'}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedMaterialId && selectedMaterial && (
          <div className="mt-3 p-3 border rounded-lg bg-muted/30">
            <div className="text-xs font-semibold text-muted-foreground">Precio a utilizar</div>
            <div className="flex gap-2 mt-2">
              <Button
                variant={precioTipo === 'menor' ? 'default' : 'outline'}
                onClick={() => onPrecioTipoChange('menor')}
                className="flex-1 text-sm"
              >
                Por menor
              </Button>
              <Button
                variant={precioTipo === 'mayor' ? 'default' : 'outline'}
                onClick={() => onPrecioTipoChange('mayor')}
                className="flex-1 text-sm"
              >
                Por mayor
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Menor: ${precioMenor.toLocaleString()} · Mayor: ${precioMayor.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* 2. SELECCIÓN DE LOTE */}
      {shouldShowLotes && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
          <Label className="text-base font-black uppercase tracking-tight text-primary">2. Seleccionar Lote / Placa</Label>

          <Popover open={openLote} onOpenChange={setOpenLote}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openLote}
                className={cn(
                  "w-full justify-between min-h-20 h-auto p-4 bg-white border-2 transition-all",
                  selectedLoteId ? "border-emerald-500/50 bg-emerald-50/30" : "border-border hover:border-primary/30"
                )}
              >
                {selectedLote ? (
                  <div className="flex flex-col items-start w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-100 px-2 py-0.5 rounded">Lote Seleccionado</span>
                      <span className="text-sm font-black text-foreground">{selectedLote.codigo_lote}</span>
                    </div>
                    <div className="flex gap-4 text-xs font-bold text-muted-foreground">
                      <span>{selectedLote.largo} x {selectedLote.ancho} cm</span>
                      <span className="text-emerald-600">
                        {((selectedLote.ancho * selectedLote.largo) / 10000).toFixed(2)} m²
                      </span>
                      <span className="truncate max-w-37.5">{selectedLote.ubicacion}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-start">
                    <span className="text-base font-semibold text-muted-foreground">Seleccionar una placa disponible</span>
                    <span className="text-xs text-muted-foreground/70 italic">Se muestran lotes de {selectedMaterial.nombre}</span>
                  </div>
                )}
                <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(700px,95vw)] p-0" align="start" side="bottom">
              <Command>
                <CommandInput placeholder="Filtrar por código, medidas..." className="h-12" />
                <CommandList className="max-h-125 overflow-y-auto">
                  <CommandEmpty>No hay lotes disponibles para este material.</CommandEmpty>
                  <CommandGroup>
                    {lotes.map((l) => (
                      <CommandItem
                        key={l.id}
                        value={`${l.codigo_lote} ${l.largo}x${l.ancho} ${l.ubicacion}`}
                        onSelect={() => {
                          onLoteChange(l.id);
                          setOpenLote(false);
                        }}
                        className="p-0 mb-1 cursor-pointer hover:bg-transparent aria-selected:bg-transparent"
                      >
                        <div className={cn(
                          "group relative w-full border rounded-lg p-4 transition-all duration-200 overflow-hidden m-1",
                          selectedLoteId === l.id
                            ? "bg-primary/5 border-primary shadow-md ring-1 ring-primary/20"
                            : "bg-white hover:border-primary/50 hover:shadow-md border-border"
                        )}>
                          {/* Decoración lateral */}
                          <div className={cn(
                            "absolute left-0 top-0 bottom-0 w-1 transition-colors",
                            selectedLoteId === l.id ? "bg-primary" : "bg-primary/20 group-hover:bg-primary"
                          )}></div>

                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Código Identificador</span>
                                <span className="text-base font-black tracking-tight text-foreground">
                                  {l.codigo_lote || 'SIN_LOTE'}
                                </span>
                              </div>
                              {l.tipo && (
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full",
                                  l.tipo === 'retazo' ? "bg-orange-500 text-white" : "bg-emerald-600 text-white"
                                )}>
                                  {l.tipo}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fecha Ingreso</span>
                              <span className="text-xs font-semibold">
                                {l.fecha_ingreso || 'N/A'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-3 rounded-lg border border-muted-foreground/10">
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Dimensiones</span>
                              <div className="text-xs font-bold flex items-center gap-1">
                                {l.ancho && l.largo ? (
                                  <>
                                    <span>{l.largo}</span>
                                    <span className="text-muted-foreground text-[10px]">x</span>
                                    <span>{l.ancho}</span>
                                    <span className="text-[10px] text-muted-foreground ml-0.5">cm</span>
                                  </>
                                ) : 'N/A'}
                              </div>
                            </div>

                            <div className="space-y-0.5 border-l border-muted-foreground/20 pl-4">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Superficie</span>
                              <div className="text-xs font-bold text-primary">
                                {((l.ancho * l.largo) / 10000).toFixed(2)} <span className="text-[10px] font-medium">m²</span>
                              </div>
                            </div>

                            <div className="space-y-0.5 border-l border-muted-foreground/20 pl-4">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Proveedor</span>
                              <div className="text-[10px] font-bold truncate max-w-20">
                                {l.proveedor_nombre || 'S/P'}
                              </div>
                            </div>

                            <div className="space-y-0.5 border-l border-muted-foreground/20 pl-4">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Ubicación</span>
                              <div className="text-[10px] font-bold truncate">
                                {l.ubicacion || 'DEPÓSITO'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

        </div>
      )}
    </div>
  );
}

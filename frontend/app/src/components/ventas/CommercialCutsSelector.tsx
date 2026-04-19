import React, { useState, useEffect } from 'react';
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Card, CardContent } from "../ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Check, ChevronsUpDown, Plus, ShoppingCart } from "lucide-react";

interface CommercialCut {
  id: string;
  name: string;
}

interface CommercialCutsSelectorProps {}

export function CommercialCutsSelector() {
  const [cuts, setCuts] = useState<CommercialCut[]>([]);
  const [selectedCutId, setSelectedCutId] = useState<string>('');
  const [openCombobox, setOpenCombobox] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const savedCuts = localStorage.getItem('commercial_cuts_presets');
    if (savedCuts) {
      try {
        setCuts(JSON.parse(savedCuts));
      } catch (e) {
        console.error("Error loading commercial cuts", e);
      }
    } else {
      const defaults = [
        { id: '1', name: 'Vanitorio' },
        { id: '2', name: 'Mesada' },
        { id: '3', name: 'Isla' },
        { id: '4', name: 'Frente' },
        { id: '5', name: 'Zócalo' }
      ];
      setCuts(defaults);
      localStorage.setItem('commercial_cuts_presets', JSON.stringify(defaults));
    }
  }, []);

  const saveCuts = (newCuts: CommercialCut[]) => {
    setCuts(newCuts);
    localStorage.setItem('commercial_cuts_presets', JSON.stringify(newCuts));
  };

  const selectedCut = cuts.find(c => c.id === selectedCutId);

  return (
    <Card className="border-cyan-100 bg-cyan-50/30 mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-cyan-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Producto
            </h3>
          </div>

          <div className="flex flex-col gap-4">
            <div className="w-full space-y-2">
              <Label>Seleccionar Producto</Label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between bg-white"
                  >
                    {selectedCut ? selectedCut.name : "Seleccionar producto..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar o crear producto..."
                      value={searchTerm}
                      onValueChange={setSearchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {searchTerm.trim() && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              const name = searchTerm.trim();
                              const existing = cuts.find(c => c.name.toLowerCase() === name.toLowerCase());
                              if (existing) {
                                setSelectedCutId(existing.id);
                              } else {
                                const newCut: CommercialCut = {
                                  id: Date.now().toString(),
                                  name
                                };
                                saveCuts([...cuts, newCut]);
                                setSelectedCutId(newCut.id);
                              }
                              setOpenCombobox(false);
                              setSearchTerm('');
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Crear "{searchTerm.trim()}"
                          </Button>
                        )}
                      </CommandEmpty>
                      <CommandGroup heading="Productos">
                        {cuts.map(cut => (
                          <CommandItem
                            key={cut.id}
                            value={cut.name}
                            onSelect={() => {
                              setSelectedCutId(cut.id);
                              setOpenCombobox(false);
                              setSearchTerm('');
                            }}
                          >
                            <Check className={selectedCutId === cut.id ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                            {cut.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Label } from '../../../../components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../../../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../components/ui/popover';
import { ShoppingCart, DollarSign, TrendingUp, Package, Check, ChevronsUpDown, Plus, AlertCircle } from 'lucide-react';
import type { Proveedor, Material, ProductoEstatico, LoteBasic } from '../../types/compras.types';
import { obtenerOpcionesUnicas } from '../../utils/comprasUtils';
import { cn } from '../../../../components/ui/utils';

interface FormularioCompraProps {
    proveedores: Proveedor[];
    materiales: Material[];
    productosEstaticos: ProductoEstatico[];
    onRegistrarCompra: () => void;
    tipoCompra: 'material' | 'producto';
    form: any;
    areaM2: number;
    loteActivo: string;
    materialSeleccionado: Material | null;
    productoSeleccionado: ProductoEstatico | null;
    updateForm: (updates: any) => void;
    cambiarTipoCompra: (tipo: 'material' | 'producto') => void;
    onCrearMaterial?: () => void;
    lotesDisponibles: LoteBasic[];
    loadingLotes: boolean;
}

export function FormularioCompra({
    proveedores,
    materiales,
    productosEstaticos,
    onRegistrarCompra,
    tipoCompra,
    form,
    areaM2,
    loteActivo,
    materialSeleccionado,
    productoSeleccionado,
    updateForm,
    cambiarTipoCompra,
    onCrearMaterial,
    lotesDisponibles = [],
    loadingLotes = false
}: FormularioCompraProps) {
    const materialesOpciones = obtenerOpcionesUnicas(materiales);
    const [openLote, setOpenLote] = useState(false);
    const [searchLote, setSearchLote] = useState("");
    const [openMaterial, setOpenMaterial] = useState(false);
    const [searchMaterial, setSearchMaterial] = useState("");
    const [openProducto, setOpenProducto] = useState(false);
    const [searchProducto, setSearchProducto] = useState("");

    const handleMaterialChange = (valor: string) => {
        if (valor === '__nuevo__' && onCrearMaterial) {
            onCrearMaterial();
        } else {
            updateForm({ material: valor });
        }
    };

    const esProveedorSeleccionado = !!form.proveedor;
    const esMaterialSeleccionado = tipoCompra === 'material' ? !!form.material : !!form.producto;
    const esFormularioValido = () => {
        if (!form.proveedor) return false;
        if (tipoCompra === 'material') {
            return !!(
                form.material &&
                form.lote &&
                areaM2 > 0 &&
                form.costo_m2 > 0 &&
                (form.precio_venta_menor || 0) > 0 &&
                (form.precio_venta_mayor || 0) > 0
            );
        } else {
            return !!(
                form.producto &&
                form.cantidad_producto > 0
            );
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Nueva Compra - Cálculos Automáticos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* SELECTOR DE TIPO: MATERIAL O PRODUCTO */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <Label className="block mb-3 font-semibold text-blue-900">Tipo de Compra</Label>
                    <div className="flex gap-2">
                        <Button
                            variant={tipoCompra === 'material' ? 'default' : 'outline'}
                            onClick={() => cambiarTipoCompra('material')}
                            className="flex-1 text-sm"
                        >
                            📦 Material
                        </Button>
                        <Button
                            variant={tipoCompra === 'producto' ? 'default' : 'outline'}
                            onClick={() => cambiarTipoCompra('producto')}
                            className="flex-1 text-sm"
                        >
                            📦 Producto
                        </Button>
                    </div>
                </div>

                {/* PASO 1: PROVEEDOR - OBLIGATORIO */}
                <div className="space-y-3">
                    <div>
                        <Label htmlFor="proveedor" className="font-semibold flex gap-2">
                            <span>1. Proveedor</span>
                            <span className="text-red-500">*</span>
                        </Label>
                        <p className="text-xs text-gray-500 mb-2">Campo requerido</p>
                        <Select
                            value={form.proveedor || ''}
                            onValueChange={(val) => updateForm({ proveedor: val })}
                        >
                            <SelectTrigger id="proveedor" className="w-full">
                                <SelectValue placeholder="Seleccionar proveedor" />
                            </SelectTrigger>
                            <SelectContent>
                                {proveedores.map(p => (
                                    <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Mostrar mensaje si no hay proveedor */}
                {!esProveedorSeleccionado && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-800">
                            Debes seleccionar un proveedor antes de continuar
                        </p>
                    </div>
                )}

                {/* PASO 2: MATERIAL/PRODUCTO - OBLIGATORIO (solo si hay proveedor) */}
                {esProveedorSeleccionado && (
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor={tipoCompra === 'material' ? 'material' : 'producto'} className="font-semibold flex gap-2">
                                <span>2. {tipoCompra === 'material' ? 'Material' : 'Producto'}</span>
                                <span className="text-red-500">*</span>
                            </Label>
                            <p className="text-xs text-gray-500 mb-2">Campo requerido</p>
                            {tipoCompra === 'material' ? (
                                <Popover open={openMaterial} onOpenChange={setOpenMaterial}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openMaterial}
                                            className="w-full justify-between text-left h-16"
                                        >
                                            {form.material
                                                ? form.material
                                                : "Elegir Mármol, Granito, Cuarzo..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput
                                                placeholder="Buscar material..."
                                                value={searchMaterial}
                                                onValueChange={setSearchMaterial}
                                            />
                                            <CommandList>
                                                {onCrearMaterial && (
                                                    <CommandGroup heading="Acciones">
                                                        <CommandItem
                                                            value="__nuevo__"
                                                            onSelect={() => {
                                                                onCrearMaterial?.();
                                                                setOpenMaterial(false);
                                                            }}
                                                        >
                                                            <Plus className="mr-2 h-4 w-4" />
                                                            Nuevo Material
                                                        </CommandItem>
                                                    </CommandGroup>
                                                )}
                                                <CommandGroup heading="Materiales">
                                                    {materialesOpciones.map((nombre) => (
                                                        <CommandItem
                                                            key={nombre}
                                                            value={nombre}
                                                            onSelect={() => {
                                                                cambiarTipoCompra('material');
                                                                updateForm({ material: nombre, producto: '' });
                                                                setOpenMaterial(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    form.material === nombre ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {nombre}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <Popover open={openProducto} onOpenChange={setOpenProducto}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openProducto}
                                            className="w-full justify-between text-left h-16"
                                        >
                                            {form.producto
                                                ? form.producto
                                                : "Seleccionar insumo del stock"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0" align="start">
                                        <Command>
                                            <CommandInput
                                                placeholder="Buscar producto..."
                                                value={searchProducto}
                                                onValueChange={setSearchProducto}
                                            />
                                            <CommandList>
                                                <CommandEmpty>Sin resultados</CommandEmpty>
                                                <CommandGroup heading="Stock de Insumos">
                                                    {productosEstaticos.map((p) => (
                                                        <CommandItem
                                                            key={p.id}
                                                            value={p.nombre}
                                                            onSelect={() => {
                                                                updateForm({ producto: p.nombre, material: '' });
                                                                setOpenProducto(false);
                                                            }}
                                                        >
                                                            {p.nombre} - ${p.precio_venta.toFixed(2)}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    </div>
                )}

                {!esMaterialSeleccionado && esProveedorSeleccionado && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-800">
                            Debes seleccionar {tipoCompra === 'material' ? 'un material' : 'un producto'} antes de continuar
                        </p>
                    </div>
                )}

                {/* FLUJO PARA MATERIAL (solo si proveedor y material seleccionados) */}
                {tipoCompra === 'material' && esProveedorSeleccionado && esMaterialSeleccionado && (
                    <>
                        {/* PASO 3: LOTE */}
                        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                            <Label htmlFor="lote" className="font-semibold flex gap-2">
                                <span>3. Lote</span>
                                <span className="text-red-500">*</span>
                            </Label>
                            <Popover open={openLote} onOpenChange={setOpenLote}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openLote}
                                        className="w-full justify-between text-left"
                                        disabled={loadingLotes}
                                    >
                                        {form.lote
                                            ? form.lote
                                            : (loadingLotes ? "Cargando lotes..." : "Seleccionar o crear lote...")}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput
                                            placeholder="Buscar o crear lote..."
                                            value={searchLote}
                                            onValueChange={setSearchLote}
                                        />
                                        <CommandList>
                                            <CommandEmpty className="py-2 px-2">
                                                {searchLote && (
                                                    <>
                                                        <p className="text-sm text-muted-foreground mb-2 text-center">No encontrado.</p>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="w-full"
                                                            onClick={() => {
                                                                updateForm({ lote: searchLote.trim() });
                                                                setOpenLote(false);
                                                            }}
                                                        >
                                                            Crear "{searchLote}"
                                                        </Button>
                                                    </>
                                                )}
                                            </CommandEmpty>
                                            {lotesDisponibles.length > 0 && (
                                                <CommandGroup heading="Lotes Existentes">
                                                    {lotesDisponibles.map((lote) => (
                                                        <CommandItem
                                                            key={lote.id}
                                                            value={lote.codigo_lote}
                                                            onSelect={() => {
                                                                updateForm({
                                                                    lote: lote.codigo_lote,
                                                                    ancho_m: lote.ancho_m || form.ancho_m,
                                                                    alto_m: lote.largo_m || form.alto_m,
                                                                    costo_m2: lote.costo_m2 || form.costo_m2
                                                                });
                                                                setOpenLote(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    form.lote === lote.codigo_lote ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {lote.codigo_lote} ({lote.ancho_m}×{lote.largo_m}m)
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            )}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* PASO 4: DIMENSIONES */}
                        {form.lote && (
                            <>
                                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                                    <Label className="font-semibold flex gap-2">
                                        <span>4. Dimensiones</span>
                                    </Label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div>
                                            <Label htmlFor="ancho" className="text-xs">Ancho (m)</Label>
                                            <Input
                                                id="ancho"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={form.ancho_m || ''}
                                                onChange={(e) => updateForm({ ancho_m: parseFloat(e.target.value) || 0 })}
                                                placeholder="0.00"
                                                className="text-sm"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="largo" className="text-xs">Largo (m)</Label>
                                            <Input
                                                id="largo"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={form.alto_m || ''}
                                                onChange={(e) => updateForm({ alto_m: parseFloat(e.target.value) || 0 })}
                                                placeholder="0.00"
                                                className="text-sm"
                                            />
                                        </div>

                                        <div>
                                            <Label className="text-xs">Área (m²)</Label>
                                            <div className="p-2 bg-white rounded-md border border-primary/20 text-sm font-bold text-primary text-center">
                                                {areaM2.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ubicación */}
                                    <div>
                                        <Label htmlFor="ubicacion" className="text-xs">Ubicación (Opcional)</Label>
                                        <Input
                                            id="ubicacion"
                                            type="text"
                                            value={form.ubicacion || ''}
                                            onChange={(e) => updateForm({ ubicacion: e.target.value })}
                                            placeholder="Ej: Galpón A, Estante 3"
                                            className="text-sm"
                                        />
                                    </div>

                                    {/* Cantidad de Placas */}
                                    <div>
                                        <Label htmlFor="cantidad-placas" className="text-xs">Cantidad de Placas por Lote</Label>
                                        <Input
                                            id="cantidad-placas"
                                            type="number"
                                            step="1"
                                            min="1"
                                            value={form.cantidad_placas || ''}
                                            onChange={(e) => updateForm({ cantidad_placas: parseInt(e.target.value) || 1 })}
                                            placeholder="1"
                                            className="text-sm"
                                        />
                                        <p className="text-xs text-gray-600 mt-1">
                                            ¿Cuántas placas físicas compraste en esta compra?
                                        </p>
                                    </div>
                                </div>

                                {/* PASO 5: COSTO - SELECTOR DE MODO */}
                                <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <Label className="font-semibold flex gap-2">
                                        <span>5. Costo de Compra</span>
                                        <span className="text-red-500">*</span>
                                    </Label>

                                    {/* Switch entre costo/m² y monto total */}
                                    <div className="flex gap-2">
                                        <Button
                                            variant={form.costoMode === 'costo_m2' ? 'default' : 'outline'}
                                            onClick={() => updateForm({ costoMode: 'costo_m2' })}
                                            className="flex-1 text-sm"
                                        >
                                            Costo/m²
                                        </Button>
                                        <Button
                                            variant={form.costoMode === 'monto_total' ? 'default' : 'outline'}
                                            onClick={() => updateForm({ costoMode: 'monto_total' })}
                                            className="flex-1 text-sm"
                                        >
                                            Monto Total
                                        </Button>
                                    </div>

                                    {/* Campos según modo */}
                                    <div className="space-y-2">
                                        {form.costoMode === 'costo_m2' ? (
                                            <div>
                                                <Label htmlFor="costo" className="text-sm">Costo por m²</Label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                                    <Input
                                                        id="costo"
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={form.costo_m2 || ''}
                                                        onChange={(e) => {
                                                            const v = parseFloat(e.target.value) || 0;
                                                            updateForm({ costo_m2: v });
                                                            if (typeof window !== 'undefined' && form.material) {
                                                                window.dispatchEvent(new CustomEvent('marmoles:precio-venta-actualizado', {
                                                                    detail: {
                                                                        material: form.material,
                                                                        material_id: materialSeleccionado?.id,
                                                                        costo_m2: v
                                                                    }
                                                                }));
                                                            }
                                                        }}
                                                        placeholder="0.00"
                                                        className="pl-8 text-sm"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    Monto total: ${(form.costo_m2 * areaM2).toFixed(2)}
                                                </p>
                                            </div>
                                        ) : (
                                            <div>
                                                <Label htmlFor="monto" className="text-sm">Monto Total</Label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                                    <Input
                                                        id="monto"
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={form.monto_total || ''}
                                                        onChange={(e) => {
                                                            const v = parseFloat(e.target.value) || 0;
                                                            updateForm({ monto_total: v });
                                                            const costoCalc = areaM2 > 0 ? v / areaM2 : 0;
                                                            if (typeof window !== 'undefined' && form.material) {
                                                                window.dispatchEvent(new CustomEvent('marmoles:precio-venta-actualizado', {
                                                                    detail: {
                                                                        material: form.material,
                                                                        material_id: materialSeleccionado?.id,
                                                                        costo_m2: costoCalc
                                                                    }
                                                                }));
                                                            }
                                                        }}
                                                        placeholder="0.00"
                                                        className="pl-8 text-sm"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {areaM2 > 0 ? `Costo/m²: $${(form.monto_total / areaM2).toFixed(2)}` : 'Costo/m²: ---'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* PASO 6: PRECIO DE VENTA */}
                                <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
                                    <Label className="font-semibold flex gap-2">
                                        <span>6. Precio de Venta</span>
                                        <span className="text-red-500">*</span>
                                    </Label>

                                    {/* Apartados independientes: menor y mayor */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-sm">Precio por menor m²</Label>
                                            <div className="relative mt-1">
                                                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-green-600" />
                                                <Input
                                                    id="precio-menor"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={form.precio_venta_menor || ''}
                                                    onChange={(e) => {
                                                        const v = parseFloat(e.target.value) || 0;
                                                        const shouldDefaultMayor = !(form.precio_venta_mayor && form.precio_venta_mayor > 0);
                                                        updateForm({
                                                            precio_venta_menor: v,
                                                            // Mantener compatibilidad con cálculo de ganancia
                                                            precio_venta_valor: v,
                                                            precio_venta_mayor: shouldDefaultMayor ? v : form.precio_venta_mayor
                                                        });
                                                        if (typeof window !== 'undefined' && form.material) {
                                                            window.dispatchEvent(new CustomEvent('marmoles:precio-venta-actualizado', {
                                                                detail: {
                                                                    material: form.material,
                                                                    material_id: materialSeleccionado?.id,
                                                                    precio_m2: v
                                                                }
                                                            }));
                                                            if (shouldDefaultMayor) {
                                                                window.dispatchEvent(new CustomEvent('marmoles:precio-venta-actualizado', {
                                                                    detail: {
                                                                        material: form.material,
                                                                        material_id: materialSeleccionado?.id,
                                                                        precio_mayor_m2: v
                                                                    }
                                                                }));
                                                            }
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    className="pl-8 text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="text-sm">Precio por mayor m²</Label>
                                            <div className="relative mt-1">
                                                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-green-600" />
                                                <Input
                                                    id="precio-mayor"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={form.precio_venta_mayor || ''}
                                                    onChange={(e) => {
                                                        const v = parseFloat(e.target.value) || 0;
                                                        updateForm({
                                                            precio_venta_mayor: v
                                                        });
                                                        if (typeof window !== 'undefined' && form.material) {
                                                            window.dispatchEvent(new CustomEvent('marmoles:precio-venta-actualizado', {
                                                                detail: {
                                                                    material: form.material,
                                                                    material_id: materialSeleccionado?.id,
                                                                    precio_mayor_m2: v
                                                                }
                                                            }));
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    className="pl-8 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Switch entre fijo y porcentaje */}
                                    <div className="flex gap-2">
                                        <Button
                                            variant={form.precio_venta_tipo === 'fijo' ? 'default' : 'outline'}
                                            onClick={() => updateForm({ precio_venta_tipo: 'fijo' })}
                                            className="flex-1 text-sm"
                                        >
                                            Precio Fijo
                                        </Button>
                                        <Button
                                            variant={form.precio_venta_tipo === 'porcentaje' ? 'default' : 'outline'}
                                            onClick={() => updateForm({ precio_venta_tipo: 'porcentaje' })}
                                            className="flex-1 text-sm"
                                        >
                                            Por %
                                        </Button>
                                    </div>

                                    {/* Campos según modo (solo informativos para cálculo rápido) */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {form.precio_venta_tipo === 'fijo' ? (
                                            <>
                                                <div>
                                                    <Label className="text-sm">Ganancia % (base menor)</Label>
                                                    <div className="p-2 bg-white rounded-md border text-sm font-bold text-green-600 text-center">
                                                        {form.porcentaje_ganancia.toFixed(2)}%
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-sm">Precio/m² (base menor)</Label>
                                                    <div className="p-2 bg-white rounded-md border text-sm font-bold text-green-600 text-center">
                                                        ${form.precio_venta_menor?.toFixed(2) || '0.00'}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <Label htmlFor="porcentaje" className="text-sm">Ganancia %</Label>
                                                    <div className="relative">
                                                        <TrendingUp className="absolute left-3 top-3 h-4 w-4 text-green-600" />
                                                        <Input
                                                            id="porcentaje"
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            value={form.porcentaje_ganancia || ''}
                                                            onChange={(e) => updateForm({ porcentaje_ganancia: parseFloat(e.target.value) || 0 })}
                                                            placeholder="0.00"
                                                            className="pl-8 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label className="text-sm">Precio/m²</Label>
                                                    <div className="p-2 bg-white rounded-md border text-sm font-bold text-green-600 text-center">
                                                        ${form.precio_venta_valor.toFixed(2)}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Método de pago */}
                                <div className="space-y-2">
                                    <Label htmlFor="metodo" className="text-sm font-semibold">Método de Pago</Label>
                                    <Select
                                        value={form.metodo_pago}
                                        onValueChange={(val) => updateForm({ metodo_pago: val })}
                                    >
                                        <SelectTrigger id="metodo" className="text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Transferencia">Transferencia</SelectItem>
                                            <SelectItem value="Efectivo">Efectivo</SelectItem>
                                            <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                            <SelectItem value="Cheque">Cheque</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Resumen final */}
                                <div className="p-4 bg-slate-100 rounded-lg border border-slate-300">
                                    <p className="text-sm font-semibold text-slate-900 mb-3">📋 Resumen</p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Lote:</span>
                                            <span className="font-bold">{form.lote}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Cantidad de Placas:</span>
                                            <span className="font-bold">{form.cantidad_placas}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Área por Placa:</span>
                                            <span className="font-bold">{areaM2.toFixed(2)} m²</span>
                                        </div>
                                        <div className="flex justify-between bg-blue-100 p-2 rounded font-bold">
                                            <span className="text-slate-700">Total m² (Placas × Área):</span>
                                            <span className="text-blue-600">{(areaM2 * form.cantidad_placas).toFixed(2)} m²</span>
                                        </div>
                                        <div className="flex justify-between text-blue-600 font-bold border-t pt-2">
                                            <span>Costo/m²:</span>
                                            <span>${form.costo_m2.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-blue-600 font-bold">
                                            <span>Total a Pagar:</span>
                                            <span>${(form.costo_m2 * areaM2 * form.cantidad_placas).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-green-600 font-bold border-t pt-2">
                                            <span>Precio Venta/m²:</span>
                                            <span>${form.precio_venta_valor.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-green-600 font-bold">
                                            <span>Ganancia/m²:</span>
                                            <span>${(form.precio_venta_valor - form.costo_m2).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* FLUJO PARA INSUMO */}
                {tipoCompra === 'producto' && esProveedorSeleccionado && esMaterialSeleccionado && (
                    <>
                        <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg border">
                            <div className="space-y-3">
                                <Label htmlFor="cantidad" className="font-semibold">Cantidad</Label>
                                <Input
                                    id="cantidad"
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={form.cantidad_producto || ''}
                                    onChange={(e) => updateForm({ cantidad_producto: parseInt(e.target.value) || 1 })}
                                    placeholder="1"
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-3">
                                <Label htmlFor="placas" className="font-semibold">Placas por Unidad</Label>
                                <Input
                                    id="placas"
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={form.cantidad_placas || ''}
                                    onChange={(e) => updateForm({ cantidad_placas: parseInt(e.target.value) || 1 })}
                                    placeholder="10"
                                    className="text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="metodo-prod" className="text-sm font-semibold">Método de Pago</Label>
                            <Select
                                value={form.metodo_pago}
                                onValueChange={(val) => updateForm({ metodo_pago: val })}
                            >
                                <SelectTrigger id="metodo-prod" className="text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                                    <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                    <SelectItem value="Cheque">Cheque</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {productoSeleccionado && (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-muted-foreground mb-3">📦 Resumen:</p>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Producto:</span>
                                        <span className="font-bold">{form.producto}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Precio Unitario:</span>
                                        <span className="font-bold text-primary">${productoSeleccionado.precio_venta.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Cantidad:</span>
                                        <span className="font-bold">{form.cantidad_producto}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Placas por Unidad:</span>
                                        <span className="font-bold">{form.cantidad_placas}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Total Placas:</span>
                                        <span className="font-bold text-blue-600">{form.cantidad_producto * form.cantidad_placas}</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2 text-primary font-bold">
                                        <span>Total a Pagar:</span>
                                        <span>${(productoSeleccionado.precio_venta * form.cantidad_producto * form.cantidad_placas).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Botón Registrar */}
                {esProveedorSeleccionado && esMaterialSeleccionado && (
                    <Button
                        onClick={onRegistrarCompra}
                        disabled={!esFormularioValido()}
                        className="w-full h-12 text-base font-semibold"
                    >
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Registrar Compra
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

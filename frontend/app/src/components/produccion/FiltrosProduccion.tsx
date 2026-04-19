import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePickerWithRange } from '../common/DateRangePicker';
import { Button } from '../ui/button';
import { Search, Filter, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';

interface FiltrosProduccionProps {
    busqueda: string;
    onBusquedaChange: (value: string) => void;
    filtroPrioridad: string;
    onFiltroPrioridadChange: (value: string) => void;
    filtroMaterial: string;
    onFiltroMaterialChange: (value: string) => void;
    filtroEstado: string;
    onFiltroEstadoChange: (value: string) => void;
    dateRange?: DateRange;
    onDateRangeChange: (range?: DateRange) => void;
    materialesDisponibles: string[];
    onLimpiarFiltros: () => void;
}

export function FiltrosProduccion({
    busqueda,
    onBusquedaChange,
    filtroPrioridad,
    onFiltroPrioridadChange,
    filtroMaterial,
    onFiltroMaterialChange,
    filtroEstado,
    onFiltroEstadoChange,
    dateRange,
    onDateRangeChange,
    materialesDisponibles,
    onLimpiarFiltros
}: FiltrosProduccionProps) {
    const tieneFilterosActivos =
        busqueda ||
        filtroPrioridad !== 'todas' ||
        filtroMaterial !== 'todos' ||
        filtroEstado !== 'todos' ||
        dateRange;

    return (
        <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-gray-600" />
                    <h3 className="font-bold text-lg">Filtros de Búsqueda</h3>
                </div>
                {tieneFilterosActivos && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onLimpiarFiltros}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                        <X className="h-4 w-4 mr-1" />
                        Limpiar filtros
                    </Button>
                )}
            </div>

            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Búsqueda general */}
                <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="busqueda" className="text-xs font-bold uppercase text-gray-600">
                        Búsqueda
                    </Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            id="busqueda"
                            type="text"
                            placeholder="Cliente, material, ID..."
                            value={busqueda}
                            onChange={(e) => onBusquedaChange(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Prioridad */}
                <div className="space-y-2">
                    <Label htmlFor="prioridad" className="text-xs font-bold uppercase text-gray-600">
                        Prioridad
                    </Label>
                    <Select value={filtroPrioridad} onValueChange={onFiltroPrioridadChange}>
                        <SelectTrigger id="prioridad">
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todas">Todas</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="media">Media</SelectItem>
                            <SelectItem value="baja">Baja</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Material */}
                <div className="space-y-2">
                    <Label htmlFor="material" className="text-xs font-bold uppercase text-gray-600">
                        Material
                    </Label>
                    <Select value={filtroMaterial} onValueChange={onFiltroMaterialChange}>
                        <SelectTrigger id="material">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            {materialesDisponibles.map((mat) => (
                                <SelectItem key={mat} value={mat}>
                                    {mat}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Estado */}
                <div className="space-y-2">
                    <Label htmlFor="estado" className="text-xs font-bold uppercase text-gray-600">
                        Estado
                    </Label>
                    <Select value={filtroEstado} onValueChange={onFiltroEstadoChange}>
                        <SelectTrigger id="estado">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="en_proceso">En Proceso</SelectItem>
                            <SelectItem value="cortado">Cortado</SelectItem>
                            <SelectItem value="terminado">Terminado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Rango de fechas */}
            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-gray-600">
                    Rango de Fechas
                </Label>
                <DatePickerWithRange
                    date={dateRange}
                    setDate={onDateRangeChange}
                />
            </div>
        </div>
    );
}

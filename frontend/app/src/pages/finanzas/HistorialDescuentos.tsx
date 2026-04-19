import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Percent, DollarSign, TrendingDown, Calendar, User, FileText, Search } from 'lucide-react';
import { get } from '../../api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DescuentoHistorial {
  id: string;
  presupuesto_id: string;
  cliente_id: string;
  cliente_nombre: string;
  usuario_id: string | null;
  tipo_descuento: 'fijo' | 'porcentaje';
  valor_descuento: number;
  monto_original: number;
  monto_con_descuento: number;
  monto_descontado: number;
  motivo: string | null;
  fecha_aplicacion: string;
  estado: string;
}

export function HistorialDescuentos() {
  const [descuentos, setDescuentos] = useState<DescuentoHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    cargarHistorial();
  }, []);

  const cargarHistorial = async () => {
    setLoading(true);
    try {
      const data = await get<DescuentoHistorial[]>('/api/finanzas/historial-descuentos');
      setDescuentos(data || []);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar historial de descuentos');
    } finally {
      setLoading(false);
    }
  };

  const filteredDescuentos = descuentos.filter(d => {
    const searchStr = filtro.toLowerCase();
    return (
      d.cliente_nombre.toLowerCase().includes(searchStr) ||
      d.presupuesto_id.toLowerCase().includes(searchStr) ||
      (d.motivo && d.motivo.toLowerCase().includes(searchStr))
    );
  });

  const totalDescontado = filteredDescuentos.reduce((sum, d) => sum + d.monto_descontado, 0);
  const totalOriginal = filteredDescuentos.reduce((sum, d) => sum + d.monto_original, 0);
  const promedioDescuento = totalOriginal > 0 ? (totalDescontado / totalOriginal) * 100 : 0;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando historial...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs de Descuentos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Descontado</p>
                <p className="text-2xl font-bold text-red-600">
                  ${totalDescontado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cantidad de Descuentos</p>
                <p className="text-2xl font-bold">{filteredDescuentos.length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyan-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Descuento Promedio</p>
                <p className="text-2xl font-bold text-orange-600">
                  {promedioDescuento.toFixed(1)}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Percent className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Historial */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Historial de Descuentos
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, ID..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Presupuesto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Monto Original</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">Total Final</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDescuentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No hay descuentos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDescuentos.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">
                        {formatDate(d.fecha_aplicacion)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{d.cliente_nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.presupuesto_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {d.tipo_descuento === 'porcentaje' ? (
                          <Badge variant="outline" className="bg-purple-50">
                            <Percent className="h-3 w-3 mr-1" />
                            Porcentaje
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50">
                            <DollarSign className="h-3 w-3 mr-1" />
                            Fijo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-bold">
                        {d.tipo_descuento === 'porcentaje' 
                          ? `${d.valor_descuento}%` 
                          : `$${d.valor_descuento.toLocaleString()}`}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${d.monto_original.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600 font-bold">
                        -${d.monto_descontado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-green-600">
                        ${d.monto_con_descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={d.estado === 'aplicado' ? 'default' : 'secondary'}
                        >
                          {d.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

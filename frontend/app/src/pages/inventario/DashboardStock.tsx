import { useEffect, useState } from 'react';
import { LayoutDashboard, MapPin, Package, Ruler, Wallet } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { get } from '../../api';
import { toast } from 'sonner';

interface UbicacionRow {
  ubicacion: string;
  m2: number;
  valor_estimado: number;
  piezas_placa: number;
  piezas_retazo: number;
  piezas_total: number;
}

interface MaterialRow {
  material_id: string;
  nombre: string;
  m2: number;
  valor_estimado: number;
}

interface DashboardPayload {
  valoracion: string;
  filtro_piezas: string;
  totales: {
    piezas_placa: number;
    piezas_retazo: number;
    m2_placas: number;
    m2_retazos: number;
    m2_total: number;
    valor_estimado_total: number;
  };
  por_ubicacion: UbicacionRow[];
  por_material: MaterialRow[];
}

export function DashboardStock() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await get<DashboardPayload>('/api/inventario/dashboard/stock');
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) {
          toast.error('No se pudo cargar el dashboard de stock');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmtMoney = (n: number) =>
    n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  const topUbicaciones = data?.por_ubicacion.slice(0, 8) ?? [];
  const maxM2 = topUbicaciones[0]?.m2 ?? 1;

  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard de stock"
        description="Placas y retazos disponibles (no reservados, no vendidos), por ubicación y material"
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {loading && (
          <p className="text-sm text-muted-foreground">Cargando indicadores…</p>
        )}

        {!loading && data && (
          <>
            <p className="text-xs text-muted-foreground max-w-3xl">
              <strong>Valoración:</strong> {data.valoracion}. <strong>Filtro:</strong> {data.filtro_piezas}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">m² totales</CardTitle>
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{data.totales.m2_total.toLocaleString('es-AR')}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Placas {data.totales.m2_placas.toLocaleString('es-AR')} · Retazos{' '}
                    {data.totales.m2_retazos.toLocaleString('es-AR')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Valor estimado</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{fmtMoney(data.totales.valor_estimado_total)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Según precio m² del material</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Placas</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{data.totales.piezas_placa}</div>
                  <p className="text-xs text-muted-foreground mt-1">Piezas en stock disponible</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Retazos</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{data.totales.piezas_retazo}</div>
                  <p className="text-xs text-muted-foreground mt-1">Piezas en stock disponible</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ubicaciones con más m²</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topUbicaciones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin datos de ubicación.</p>
                  ) : (
                    topUbicaciones.map((row) => (
                      <div key={row.ubicacion} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium truncate pr-2">{row.ubicacion}</span>
                          <span className="text-muted-foreground shrink-0">
                            {row.m2.toLocaleString('es-AR')} m²
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.min(100, (row.m2 / maxM2) * 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmtMoney(row.valor_estimado)} · {row.piezas_total} piezas
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detalle por ubicación</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ubicación</TableHead>
                        <TableHead className="text-right">m²</TableHead>
                        <TableHead className="text-right">Valor est.</TableHead>
                        <TableHead className="text-right">Piezas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data.por_ubicacion.length ? data.por_ubicacion : []).map((row) => (
                        <TableRow key={row.ubicacion}>
                          <TableCell className="font-medium">{row.ubicacion}</TableCell>
                          <TableCell className="text-right">{row.m2.toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right">{fmtMoney(row.valor_estimado)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {row.piezas_placa}+{row.piezas_retazo}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>m² por material</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">m²</TableHead>
                      <TableHead className="text-right">Valor est.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.por_material.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground text-sm">
                          Sin materiales con stock en placas/retazos disponibles.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.por_material.map((row) => (
                        <TableRow key={row.material_id}>
                          <TableCell className="font-medium max-w-[240px] truncate" title={row.nombre}>
                            {row.nombre}
                          </TableCell>
                          <TableCell className="text-right">{row.m2.toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right">{fmtMoney(row.valor_estimado)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Activity, Funnel, Timer, TrendingUp, Users } from "lucide-react";

import { get } from "../../api";
import { PageHeader } from "../../components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart";
import { toast } from "sonner";

type DashboardKpis = {
  leads_generados: number;
  tasa_conversion: number;
  presupuestos_generados: number;
  monto_total_presupuestado: number;
  monto_total_cerrado: number;
  tiempo_promedio_cierre_dias: number;
  ticket_promedio_cerrado: number;
};

type DashboardSerie = {
  periodo: string;
  leads: number;
  presupuestos: number;
  ventas_cerradas: number;
};

type DashboardPerformance = {
  dimension: string;
  leads: number;
  convertidos: number;
  conversion_rate: number;
  monto_presupuestado: number;
  monto_cerrado: number;
};

type DashboardComercialResponse = {
  kpis: DashboardKpis;
  embudo: Record<string, number>;
  serie_temporal: DashboardSerie[];
  performance: DashboardPerformance[];
};

const chartConfig = {
  leads: { label: "Leads", color: "hsl(var(--chart-1))" },
  presupuestos: { label: "Presupuestos", color: "hsl(var(--chart-2))" },
  ventas_cerradas: { label: "Ventas cerradas", color: "hsl(var(--chart-3))" },
  cantidad: { label: "Cantidad", color: "hsl(var(--chart-4))" },
};

const money = (n: number) =>
  `$${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function DashboardComercial() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DashboardComercialResponse | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (desde) qs.set("fecha_desde", desde);
      if (hasta) qs.set("fecha_hasta", hasta);
      qs.set("period", period);
      const data = await get<DashboardComercialResponse>(`/api/finanzas/dashboard-comercial?${qs.toString()}`);
      setPayload(data);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar el dashboard comercial");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
  }, [period]);

  const embudoRows = useMemo(() => {
    if (!payload?.embudo) return [];
    return Object.entries(payload.embudo).map(([estado, cantidad]) => ({ estado, cantidad }));
  }, [payload]);

  const kpis = payload?.kpis;
  const orderedKpis = kpis
    ? [
        { key: "leads_generados", label: "Leads generados", value: `${kpis.leads_generados}`, icon: Users },
        { key: "tasa_conversion", label: "Tasa de conversión", value: `${kpis.tasa_conversion}%`, icon: Activity },
        { key: "presupuestos_generados", label: "Presupuestos generados", value: `${kpis.presupuestos_generados}`, icon: TrendingUp },
        { key: "monto_total_presupuestado", label: "Monto total presupuestado", value: money(kpis.monto_total_presupuestado), icon: TrendingUp },
        { key: "monto_total_cerrado", label: "Monto total cerrado", value: money(kpis.monto_total_cerrado), icon: TrendingUp },
        { key: "tiempo_promedio_cierre_dias", label: "Tiempo promedio de cierre", value: `${kpis.tiempo_promedio_cierre_dias} días`, icon: Timer },
        { key: "ticket_promedio_cerrado", label: "Ticket promedio cerrado", value: money(kpis.ticket_promedio_cerrado), icon: Activity },
      ]
    : [];

  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader
        icon={TrendingUp}
        title="Dashboard Comercial"
        description="KPIs de leads, presupuestos y cierre comercial en tiempo real."
      />

      <div className="px-4 sm:px-6 py-3 border-b bg-muted/20 flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-8" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-8" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Periodo</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "day" | "week" | "month")}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            title="Periodo"
          >
            <option value="day">Día</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
          </select>
        </div>
        <Button className="h-8" onClick={() => void fetchDashboard()}>
          Actualizar
        </Button>
      </div>

      <div className="p-4 sm:p-6 space-y-4 overflow-auto">
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando dashboard...</div>
        ) : !payload || !kpis ? (
          <div className="text-sm text-red-600">No se pudo obtener información comercial.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {orderedKpis.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{item.value}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Evolución Comercial</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer className="h-[260px] w-full" config={chartConfig}>
                    <LineChart data={payload.serie_temporal}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="periodo" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="leads" stroke="var(--color-leads)" strokeWidth={2} />
                      <Line type="monotone" dataKey="presupuestos" stroke="var(--color-presupuestos)" strokeWidth={2} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Funnel className="h-4 w-4" /> Embudo</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer className="h-[260px] w-full" config={chartConfig}>
                    <BarChart data={embudoRows}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="estado" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="cantidad" fill="var(--color-cantidad)" />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance por Origen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {payload.performance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos para el filtro actual.</p>
                ) : (
                  payload.performance.map((row) => (
                    <div key={row.dimension} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{row.dimension}</Badge>
                        <span className="text-xs text-muted-foreground">{row.leads} leads</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Conv: {row.conversion_rate}% ({row.convertidos} ganados)</div>
                      <div className="text-xs">Presupuestado: {money(row.monto_presupuestado)}</div>
                      <div className="text-xs">Cerrado: {money(row.monto_cerrado)}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}


import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { get, post } from '../../api';
import { notifyError, notifySuccess } from '../../utils/notifications';
import { LayoutGrid, Loader2, MapPin, Navigation, Package, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const COLUMNAS: { id: string; label: string }[] = [
  { id: 'pendiente_programacion', label: 'Pend. programación' },
  { id: 'programada', label: 'Programada' },
  { id: 'lista_para_carga', label: 'Lista carga' },
  { id: 'en_camino', label: 'En camino' },
  { id: 'en_obra', label: 'En obra' },
  { id: 'instalada', label: 'Instalada' },
  { id: 'entregada', label: 'Entregada' },
  { id: 'observada', label: 'Observada' },
  { id: 'cerrada', label: 'Cerrada' },
];

interface OrdenResumen {
  id: string;
  trabajo_id: string;
  estado: string;
  tipo_servicio: string;
  tipo_cliente: string;
  fecha_programada: string | null;
  franja_horaria: string | null;
  direccion_texto: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  chofer_asignado: string | null;
  responsable_logistica: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
  supervision_activa_estado?: string | null;
  supervision_favorable_lista?: boolean;
}

interface OrdenDetalleResponse {
  orden: Record<string, unknown>;
  detalle: Array<{
    id: string;
    id_pieza: string | null;
    nombre_pieza: string | null;
    material: string | null;
    estado_detalle: string;
    largo_mm: number | null;
    ancho_mm: number | null;
  }>;
  eventos: Array<{ tipo_evento: string; fecha_hora: string; detalle: string | null }>;
  incidencias: Array<{ tipo: string; descripcion: string; severidad: string }>;
  supervision_resumen?: {
    activa_id: string | null;
    activa_estado: string | null;
    ultima_favorable_resultado: string | null;
    ultima_favorable_id: string | null;
  };
}

interface EntregaRow {
  id: string;
  cliente: string;
  orden_entrega_id: string | null;
  orden_entrega_estado: string | null;
}

interface Kpi {
  por_estado: Record<string, number>;
  entregas_con_orden: number;
  incidencias_abiertas: number;
  entregas_a_tiempo_muestra: number;
}

export function OrdenesEntregaKanban() {
  const [ordenes, setOrdenes] = useState<OrdenResumen[]>([]);
  const [kpis, setKpis] = useState<Kpi | null>(null);
  const [entregas, setEntregas] = useState<EntregaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<OrdenDetalleResponse | null>(null);
  const [accionLoading, setAccionLoading] = useState(false);

  const [crearOpen, setCrearOpen] = useState(false);
  const [trabajoCrear, setTrabajoCrear] = useState('');

  const [programarOpen, setProgramarOpen] = useState(false);
  const [prog, setProg] = useState({
    fecha_programada: '',
    franja_horaria: '',
    chofer_asignado: '',
    responsable_logistica: '',
  });

  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [cierre, setCierre] = useState({
    conformidad_resultado: 'conforme',
    conformidad_nombre: '',
    conformidad_fotos_url: '',
  });

  const [incidenciaOpen, setIncidenciaOpen] = useState(false);
  const [inc, setInc] = useState({
    tipo: 'otra',
    severidad: 'media',
    descripcion: '',
  });
  const [piezaCargar, setPiezaCargar] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, k, e] = await Promise.all([
        get<OrdenResumen[]>('/api/logistica/ordenes-entrega'),
        get<Kpi>('/api/logistica/ordenes-entrega/kpis'),
        get<EntregaRow[]>('/api/logistica/entregas'),
      ]);
      setOrdenes(o);
      setKpis(k);
      setEntregas(e);
    } catch (er) {
      notifyError('No se pudo cargar el tablero logístico');
      console.error(er);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!detalleId) {
      setDetalle(null);
      return;
    }
    (async () => {
      try {
        const d = await get<OrdenDetalleResponse>(`/api/logistica/ordenes-entrega/${detalleId}`);
        setDetalle(d);
      } catch {
        notifyError('No se pudo cargar el detalle de la orden');
        setDetalleId(null);
      }
    })();
  }, [detalleId]);

  const porColumna = useMemo(() => {
    const m: Record<string, OrdenResumen[]> = {};
    for (const c of COLUMNAS) m[c.id] = [];
    for (const o of ordenes) {
      if (m[o.estado]) m[o.estado].push(o);
    }
    return m;
  }, [ordenes]);

  const entregasSinOrden = useMemo(
    () => entregas.filter((e) => !e.orden_entrega_id),
    [entregas]
  );

  const mapsUrl = (lat: number | null, lng: number | null) => {
    if (lat != null && lng != null) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    }
    return null;
  };

  const runAccion = async (path: string, body?: object) => {
    if (!detalleId) return;
    setAccionLoading(true);
    try {
      await post(`/api/logistica/ordenes-entrega/${detalleId}/${path}`, body ?? {});
      notifySuccess('Acción registrada');
      await load();
      const d = await get<OrdenDetalleResponse>(`/api/logistica/ordenes-entrega/${detalleId}`);
      setDetalle(d);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Error en la acción';
      notifyError(msg);
    } finally {
      setAccionLoading(false);
    }
  };

  const seleccionada = useMemo(
    () => ordenes.find((o) => o.id === detalleId) ?? null,
    [ordenes, detalleId]
  );

  return (
    <div className="container max-w-[1800px] py-6 space-y-4">
      <PageHeader
        title="Ordenes de entrega e instalación"
        description="Tablero según estados (doc. logística) — vinculado a trabajos y presupuesto"
        icon={LayoutGrid}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={() => setCrearOpen(true)}>
              Nueva orden
            </Button>
          </div>
        }
      />

      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Card>
            <CardContent className="pt-4">
              <div className="text-muted-foreground">Órdenes registradas</div>
              <div className="text-2xl font-semibold">{kpis.entregas_con_orden}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-muted-foreground">Incidencias abiertas</div>
              <div className="text-2xl font-semibold">{kpis.incidencias_abiertas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-muted-foreground">A tiempo (muestra)</div>
              <div className="text-2xl font-semibold">{kpis.entregas_a_tiempo_muestra}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-xs text-muted-foreground">
              Distribución por estado en panel inferior (cards).
            </CardContent>
          </Card>
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {COLUMNAS.map((col) => (
            <div key={col.id} className="w-64 shrink-0">
              <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
                {col.label}{' '}
                <span className="text-foreground">({porColumna[col.id]?.length ?? 0})</span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {(porColumna[col.id] ?? []).map((o) => (
                  <Card
                    key={o.id}
                    className="cursor-pointer hover:ring-1 ring-primary/30 transition"
                    onClick={() => setDetalleId(o.id)}
                  >
                    <CardHeader className="p-3 pb-0">
                      <Badge variant="secondary" className="text-xs w-fit">
                        {o.tipo_servicio}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-3 text-xs space-y-1">
                      <div className="font-medium line-clamp-2">{o.direccion_texto ?? '—'}</div>
                      <div className="text-muted-foreground">Trabajo: {o.trabajo_id.slice(0, 8)}…</div>
                      {['instalada', 'entregada', 'observada'].includes(o.estado) && (
                          <Badge
                            variant={o.supervision_favorable_lista ? 'outline' : 'secondary'}
                            className="text-[10px] w-fit"
                          >
                            Superv.:{' '}
                            {o.supervision_favorable_lista
                              ? 'OK p/cierre'
                              : o.supervision_activa_estado ?? '—'}
                          </Badge>
                        )}
                      {o.fecha_programada && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Package className="h-3 w-3" />
                          {o.fecha_programada}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!detalleId} onOpenChange={(o) => !o && setDetalleId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Orden de entrega</DialogTitle>
          </DialogHeader>
          {seleccionada && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Estado: </span>
                <strong>{seleccionada.estado}</strong>
              </div>
              {seleccionada.direccion_texto && <p>{seleccionada.direccion_texto}</p>}
              {mapsUrl(seleccionada.lat, seleccionada.lng) && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={mapsUrl(seleccionada.lat, seleccionada.lng) ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      Abrir en Maps
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${seleccionada.lat},${seleccionada.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation className="h-4 w-4 mr-1" />
                      Ruta
                    </a>
                  </Button>
                </div>
              )}

              {detalle?.supervision_resumen && (
                <div className="text-xs space-y-1 border rounded-md p-2 bg-muted/30">
                  <div className="font-medium">Supervisión (doc. 14)</div>
                  {detalle.supervision_resumen.activa_id ? (
                    <Link
                      className="text-primary underline block"
                      to={`/logistica/supervision?sid=${detalle.supervision_resumen.activa_id}`}
                    >
                      Abrir supervisión activa
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Sin supervisión activa</span>
                  )}
                  {detalle.supervision_resumen.ultima_favorable_resultado && (
                    <div className="text-muted-foreground">
                      Última favorable: {detalle.supervision_resumen.ultima_favorable_resultado}
                    </div>
                  )}
                  <Link className="text-primary underline block" to="/logistica/supervision">
                    Ir al módulo de supervisión
                  </Link>
                </div>
              )}

              {detalle && (
                <div>
                  <div className="font-medium mb-1">Piezas</div>
                  <ul className="border rounded-md divide-y text-xs max-h-40 overflow-y-auto">
                    {detalle.detalle.map((d) => (
                      <li key={d.id} className="p-2 flex justify-between gap-2">
                        <span>{d.nombre_pieza ?? d.id_pieza}</span>
                        <Badge variant="outline">{d.estado_detalle}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detalle && detalle.eventos.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Últimos eventos</div>
                  <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                    {detalle.eventos.slice(0, 5).map((e, i) => (
                      <li key={i}>
                        {e.fecha_hora} — {e.tipo_evento} {e.detalle ? `— ${e.detalle}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {seleccionada.estado === 'pendiente_programacion' && (
                  <Button size="sm" onClick={() => setProgramarOpen(true)} disabled={accionLoading}>
                    Programar
                  </Button>
                )}
                {seleccionada.estado === 'programada' && (
                  <Button size="sm" onClick={() => void runAccion('lista-para-carga')} disabled={accionLoading}>
                    Lista para carga
                  </Button>
                )}
                {(seleccionada.estado === 'programada' ||
                  seleccionada.estado === 'lista_para_carga') &&
                  detalle && (
                    <div className="w-full flex flex-col gap-2">
                      <Label className="text-xs">Marcar pieza como cargada</Label>
                      <div className="flex gap-2">
                        <Select
                          value={piezaCargar || undefined}
                          onValueChange={(v) => setPiezaCargar(v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pieza" />
                          </SelectTrigger>
                          <SelectContent>
                            {detalle.detalle
                              .filter((d) => d.id_pieza && d.estado_detalle === 'pendiente_carga')
                              .map((d) => (
                                <SelectItem key={d.id} value={d.id_pieza!}>
                                  {d.nombre_pieza ?? d.id_pieza}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!piezaCargar || accionLoading}
                          onClick={async () => {
                            if (!detalleId || !piezaCargar) return;
                            setAccionLoading(true);
                            try {
                              await post(
                                `/api/logistica/ordenes-entrega/${detalleId}/cargar-pieza`,
                                { id_pieza: piezaCargar }
                              );
                              notifySuccess('Pieza marcada como cargada');
                              setPiezaCargar('');
                              await load();
                              setDetalle(
                                await get<OrdenDetalleResponse>(
                                  `/api/logistica/ordenes-entrega/${detalleId}`
                                )
                              );
                            } catch {
                              notifyError('No se pudo marcar la pieza');
                            } finally {
                              setAccionLoading(false);
                            }
                          }}
                        >
                          Cargar
                        </Button>
                      </div>
                    </div>
                  )}
                {seleccionada.estado === 'lista_para_carga' && (
                  <Button size="sm" onClick={() => void runAccion('salir-obra')} disabled={accionLoading}>
                    Salir a obra
                  </Button>
                )}
                {seleccionada.estado === 'en_camino' && (
                  <Button size="sm" onClick={() => void runAccion('llegada')} disabled={accionLoading}>
                    Llegada
                  </Button>
                )}
                {seleccionada.estado === 'en_obra' && (
                  <Button
                    size="sm"
                    onClick={() => void runAccion('instalacion-completa', {})}
                    disabled={accionLoading}
                  >
                    Instalación / entrega completa
                  </Button>
                )}
                {(seleccionada.estado === 'instalada' ||
                  seleccionada.estado === 'entregada' ||
                  seleccionada.estado === 'observada') && (
                  <Button size="sm" onClick={() => setCerrarOpen(true)} disabled={accionLoading}>
                    Cerrar orden
                  </Button>
                )}
                {['en_camino', 'en_obra', 'instalada', 'entregada'].includes(seleccionada.estado) && (
                  <Button size="sm" variant="destructive" onClick={() => setIncidenciaOpen(true)}>
                    Incidencia
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={crearOpen} onOpenChange={setCrearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva orden desde trabajo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Seleccione un trabajo (entrega) sin orden todavía, o pegue un ID.
          </p>
          {entregasSinOrden.length > 0 && (
            <Select
              onValueChange={(v) => setTrabajoCrear(v)}
              value={trabajoCrear || undefined}
            >
              <SelectTrigger>
                <SelectValue placeholder="Trabajo / cliente" />
              </SelectTrigger>
              <SelectContent>
                {entregasSinOrden.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.cliente} ({e.id.slice(0, 8)}…)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div>
            <Label>ID trabajo</Label>
            <Input value={trabajoCrear} onChange={(x) => setTrabajoCrear(x.target.value)} />
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!trabajoCrear.trim()) return;
                try {
                  await post(`/api/logistica/ordenes-entrega/desde-trabajo/${trabajoCrear.trim()}`, {
                    tipo_cliente: 'cliente_final',
                    tipo_servicio: 'entrega_e_instalacion',
                  });
                  notifySuccess('Orden creada');
                  setCrearOpen(false);
                  setTrabajoCrear('');
                  await load();
                } catch (er) {
                  notifyError('No se pudo crear la orden (ver precondiciones / duplicados)');
                  console.error(er);
                }
              }}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={programarOpen} onOpenChange={setProgramarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Programar</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Fecha programada</Label>
              <Input
                type="date"
                value={prog.fecha_programada}
                onChange={(e) => setProg((p) => ({ ...p, fecha_programada: e.target.value }))}
              />
            </div>
            <div>
              <Label>Franja</Label>
              <Input
                value={prog.franja_horaria}
                onChange={(e) => setProg((p) => ({ ...p, franja_horaria: e.target.value }))}
                placeholder="9-13"
              />
            </div>
            <div>
              <Label>Chofer o responsable logístico (uno requerido)</Label>
              <Input
                value={prog.chofer_asignado}
                onChange={(e) => setProg((p) => ({ ...p, chofer_asignado: e.target.value }))}
                placeholder="Chofer"
              />
            </div>
            <div>
              <Input
                value={prog.responsable_logistica}
                onChange={(e) => setProg((p) => ({ ...p, responsable_logistica: e.target.value }))}
                placeholder="Responsable"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!detalleId) return;
                if (!prog.fecha_programada) {
                  notifyError('Indique fecha');
                  return;
                }
                try {
                  await post(`/api/logistica/ordenes-entrega/${detalleId}/programar`, {
                    fecha_programada: prog.fecha_programada,
                    franja_horaria: prog.franja_horaria || null,
                    chofer_asignado: prog.chofer_asignado || null,
                    responsable_logistica: prog.responsable_logistica || null,
                    vehiculo_asignado: null,
                    observaciones_logisticas: null,
                  });
                  notifySuccess('Programada');
                  setProgramarOpen(false);
                  await load();
                  if (detalleId) {
                    setDetalle(
                      await get<OrdenDetalleResponse>(`/api/logistica/ordenes-entrega/${detalleId}`)
                    );
                  }
                } catch {
                  notifyError('No cumple precondiciones o faltan datos');
                }
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cerrarOpen} onOpenChange={setCerrarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar orden</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label>Resultado</Label>
              <Select
                value={cierre.conformidad_resultado}
                onValueChange={(v) => setCierre((c) => ({ ...c, conformidad_resultado: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conforme">Conforme</SelectItem>
                  <SelectItem value="conforme_con_observaciones">Conforme c/ observaciones</SelectItem>
                  <SelectItem value="pendiente_correccion">Pendiente corrección</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nombre o firma (o URL fotos abajo)</Label>
              <Input
                value={cierre.conformidad_nombre}
                onChange={(e) => setCierre((c) => ({ ...c, conformidad_nombre: e.target.value }))}
              />
            </div>
            <div>
              <Label>URL fotos (opcional)</Label>
              <Textarea
                value={cierre.conformidad_fotos_url}
                onChange={(e) => setCierre((c) => ({ ...c, conformidad_fotos_url: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!detalleId) return;
                try {
                  await post(`/api/logistica/ordenes-entrega/${detalleId}/cerrar`, cierre);
                  notifySuccess('Orden cerrada');
                  setCerrarOpen(false);
                  setDetalleId(null);
                  await load();
                } catch {
                  notifyError('No se pudo cerrar (evidencia mínima requerida)');
                }
              }}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={incidenciaOpen} onOpenChange={setIncidenciaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Incidencia</DialogTitle>
          </DialogHeader>
          <Textarea
            value={inc.descripcion}
            onChange={(e) => setInc((i) => ({ ...i, descripcion: e.target.value }))}
            placeholder="Descripción"
          />
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!detalleId || !inc.descripcion.trim()) return;
                try {
                  await post(`/api/logistica/ordenes-entrega/${detalleId}/incidencias`, {
                    tipo: inc.tipo,
                    severidad: inc.severidad,
                    descripcion: inc.descripcion,
                  });
                  notifySuccess('Incidencia registrada');
                  setIncidenciaOpen(false);
                  await load();
                  if (detalleId) {
                    setDetalle(
                      await get<OrdenDetalleResponse>(`/api/logistica/ordenes-entrega/${detalleId}`)
                    );
                  }
                } catch {
                  notifyError('Error al registrar');
                }
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
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
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { get, patch, post } from '../../api';
import { notifyError, notifySuccess } from '../../utils/notifications';
import { ClipboardCheck, Loader2, RefreshCw } from 'lucide-react';

interface SupervisionRow {
  id: string;
  id_orden_entrega: string;
  id_presupuesto: string;
  cliente_id: string | null;
  estado_supervision: string;
  resultado_general: string | null;
  supervisor_asignado: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface SupervisionDetail {
  supervision: {
    id: string;
    id_orden_entrega: string;
    estado_supervision: string;
    resultado_general: string | null;
    supervisor_asignado: string | null;
    observaciones_generales: string | null;
    requiere_retrabajo: boolean;
    requiere_visita_adicional: boolean;
  };
  checklist: Array<{
    id: string;
    item: string;
    categoria: string;
    estado: string | null;
    comentario: string | null;
    foto_url: string | null;
    orden: number;
  }>;
  desvios: Array<{
    id: string;
    tipo_desvio: string;
    severidad: string;
    descripcion: string;
    accion_requerida: string;
    estado: string;
    responsable: string | null;
    fecha_hora: string;
  }>;
  orden: {
    id: string;
    estado: string;
    tipo_servicio: string;
    trabajo_id: string;
    direccion_texto: string | null;
  } | null;
}

const ESTADOS_ITEM = ['ok', 'observacion', 'no_cumple'] as const;

export function SupervisionObraPage() {
  const [searchParams] = useSearchParams();
  const initialSid = searchParams.get('sid');

  const [filtro, setFiltro] = useState<string>('todos');
  const [lista, setLista] = useState<SupervisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(initialSid);
  const [detalle, setDetalle] = useState<SupervisionDetail | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  const [supervisor, setSupervisor] = useState('');
  const [finalRes, setFinalRes] = useState('aprobado');
  const [finalObs, setFinalObs] = useState('');

  const [desvioTipo, setDesvioTipo] = useState('otro');
  const [desvioSev, setDesvioSev] = useState('menor');
  const [desvioDesc, setDesvioDesc] = useState('');
  const [desvioAccion, setDesvioAccion] = useState('ajuste_en_obra');

  const queryEstado = useMemo(() => {
    if (filtro === 'todos') return undefined;
    return filtro;
  }, [filtro]);

  const cargarLista = useCallback(async () => {
    setLoading(true);
    try {
      const q = queryEstado
        ? `/api/logistica/supervisiones?estado=${encodeURIComponent(queryEstado)}`
        : '/api/logistica/supervisiones';
      const rows = await get<SupervisionRow[]>(q);
      setLista(rows);
    } catch (e) {
      console.error(e);
      notifyError('No se pudo cargar supervisiones');
    } finally {
      setLoading(false);
    }
  }, [queryEstado]);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  useEffect(() => {
    if (!selId) {
      setDetalle(null);
      return;
    }
    (async () => {
      setDetalleLoading(true);
      try {
        const d = await get<SupervisionDetail>(`/api/logistica/supervisiones/${selId}`);
        setDetalle(d);
      } catch {
        notifyError('No se pudo cargar el detalle');
        setSelId(null);
      } finally {
        setDetalleLoading(false);
      }
    })();
  }, [selId]);

  const patchItem = async (itemId: string, estado: string) => {
    try {
      await patch(`/api/logistica/supervisiones/checklist/${itemId}`, { estado });
      notifySuccess('Ítem actualizado');
      if (selId) {
        setDetalle(await get<SupervisionDetail>(`/api/logistica/supervisiones/${selId}`));
      }
    } catch (e: unknown) {
      notifyError(e instanceof Error ? e.message : 'Error al guardar ítem');
    }
  };

  const iniciarRevision = async () => {
    if (!selId || !supervisor.trim()) {
      notifyError('Indique el supervisor');
      return;
    }
    try {
      await post(`/api/logistica/supervisiones/${selId}/iniciar-revision`, {
        supervisor_asignado: supervisor.trim(),
      });
      notifySuccess('Revisión iniciada');
      await cargarLista();
      setDetalle(await get<SupervisionDetail>(`/api/logistica/supervisiones/${selId}`));
    } catch (e: unknown) {
      notifyError(e instanceof Error ? e.message : 'Error');
    }
  };

  const registrarDesvio = async () => {
    if (!selId || !desvioDesc.trim()) return;
    try {
      await post(`/api/logistica/supervisiones/${selId}/desvios`, {
        tipo_desvio: desvioTipo,
        severidad: desvioSev,
        descripcion: desvioDesc.trim(),
        accion_requerida: desvioAccion,
      });
      notifySuccess('Desvío registrado');
      setDesvioDesc('');
      setDetalle(await get<SupervisionDetail>(`/api/logistica/supervisiones/${selId}`));
      await cargarLista();
    } catch (e: unknown) {
      notifyError(e instanceof Error ? e.message : 'Error');
    }
  };

  const finalizar = async () => {
    if (!selId) return;
    try {
      await post(`/api/logistica/supervisiones/${selId}/finalizar`, {
        resultado_general: finalRes,
        observaciones_generales: finalObs || null,
        requiere_retrabajo: finalRes === 'rechazado',
        requiere_visita_adicional: false,
      });
      notifySuccess('Supervisión finalizada');
      await cargarLista();
      setDetalle(await get<SupervisionDetail>(`/api/logistica/supervisiones/${selId}`));
    } catch (e: unknown) {
      notifyError(e instanceof Error ? e.message : 'Error al finalizar');
    }
  };

  const s = detalle?.supervision;

  return (
    <div className="container max-w-6xl py-6 space-y-4">
      <PageHeader
        title="Supervisión de obra"
        description="Control técnico post-instalación (doc. 14) — checklist, desvíos y cierre"
        icon={ClipboardCheck}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void cargarLista()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/logistica/ordenes">Tablero órdenes</Link>
            </Button>
          </div>
        }
      />

      <Tabs value={filtro} onValueChange={setFiltro}>
        <TabsList>
          <TabsTrigger value="todos">Todas</TabsTrigger>
          <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
          <TabsTrigger value="en_revision">En revisión</TabsTrigger>
          <TabsTrigger value="finalizada">Finalizadas</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHeader className="py-3">
                <div className="text-sm font-medium">Listado</div>
              </CardHeader>
              <CardContent className="max-h-[480px] overflow-y-auto space-y-2 text-sm">
                {lista.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelId(r.id)}
                    className={`w-full text-left rounded-md border p-2 hover:bg-muted/50 ${
                      selId === r.id ? 'ring-1 ring-primary' : ''
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <Badge variant="outline">{r.estado_supervision}</Badge>
                      {r.resultado_general && (
                        <span className="text-xs text-muted-foreground">{r.resultado_general}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Orden {r.id_orden_entrega.slice(0, 8)}…
                    </div>
                  </button>
                ))}
                {!lista.length && !loading && (
                  <p className="text-muted-foreground text-sm">No hay registros.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <div className="text-sm font-medium">Detalle</div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm max-h-[480px] overflow-y-auto">
                {detalleLoading && <Loader2 className="h-6 w-6 animate-spin" />}
                {!detalleLoading && !detalle && <p className="text-muted-foreground">Seleccione una supervisión.</p>}
                {detalle && s && (
                  <>
                    <div>
                      <Badge>{s.estado_supervision}</Badge>{' '}
                      <span className="text-muted-foreground">
                        Orden {detalle.orden?.estado} · {detalle.orden?.tipo_servicio}
                      </span>
                    </div>
                    {detalle.orden?.direccion_texto && (
                      <p className="text-xs">{detalle.orden.direccion_texto}</p>
                    )}

                    {s.estado_supervision === 'pendiente' && (
                      <div className="space-y-2 border rounded-md p-3">
                        <Label>Iniciar revisión</Label>
                        <Input
                          placeholder="Nombre supervisor"
                          value={supervisor}
                          onChange={(e) => setSupervisor(e.target.value)}
                        />
                        <Button size="sm" onClick={() => void iniciarRevision()}>
                          Iniciar revisión
                        </Button>
                      </div>
                    )}

                    {s.estado_supervision === 'en_revision' && (
                      <>
                        <div>
                          <div className="font-medium mb-2">Checklist</div>
                          <ul className="space-y-2">
                            {detalle.checklist.map((it) => (
                              <li key={it.id} className="border rounded p-2 text-xs space-y-1">
                                <div className="flex justify-between gap-2">
                                  <span>
                                    <Badge variant="secondary" className="mr-1">
                                      {it.categoria}
                                    </Badge>
                                    {it.item}
                                  </span>
                                </div>
                                <Select
                                  value={it.estado ?? ''}
                                  onValueChange={(v) => void patchItem(it.id, v)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Estado" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ESTADOS_ITEM.map((x) => (
                                      <SelectItem key={x} value={x}>
                                        {x}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="border rounded-md p-3 space-y-2">
                          <div className="font-medium">Registrar desvío</div>
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={desvioTipo} onValueChange={setDesvioTipo}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {['medida', 'alineacion', 'terminacion', 'material', 'instalacion', 'daño', 'otro'].map(
                                  (x) => (
                                    <SelectItem key={x} value={x}>
                                      {x}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                            <Select value={desvioSev} onValueChange={setDesvioSev}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {['menor', 'media', 'critica'].map((x) => (
                                  <SelectItem key={x} value={x}>
                                    {x}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Select value={desvioAccion} onValueChange={setDesvioAccion}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['retrabajo', 'ajuste_en_obra', 'reemplazo', 'sin_accion'].map((x) => (
                                <SelectItem key={x} value={x}>
                                  {x}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Textarea
                            className="text-xs"
                            placeholder="Descripción"
                            value={desvioDesc}
                            onChange={(e) => setDesvioDesc(e.target.value)}
                          />
                          <Button size="sm" variant="secondary" onClick={() => void registrarDesvio()}>
                            Registrar desvío
                          </Button>
                        </div>

                        <div className="border rounded-md p-3 space-y-2">
                          <div className="font-medium">Finalizar</div>
                          <Select value={finalRes} onValueChange={setFinalRes}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aprobado">aprobado</SelectItem>
                              <SelectItem value="aprobado_con_observaciones">aprobado_con_observaciones</SelectItem>
                              <SelectItem value="rechazado">rechazado</SelectItem>
                            </SelectContent>
                          </Select>
                          <Textarea
                            className="text-xs"
                            placeholder="Observaciones generales"
                            value={finalObs}
                            onChange={(e) => setFinalObs(e.target.value)}
                          />
                          <Button size="sm" onClick={() => void finalizar()}>
                            Finalizar supervisión
                          </Button>
                        </div>
                      </>
                    )}

                    {s.estado_supervision === 'finalizada' && (
                      <div className="text-sm space-y-1">
                        <div>
                          <strong>Resultado:</strong> {s.resultado_general ?? '—'}
                        </div>
                        {s.observaciones_generales && <p>{s.observaciones_generales}</p>}
                        <p className="text-xs text-muted-foreground">
                          La orden puede cerrarse desde el tablero si el resultado es favorable.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
      </div>
    </div>
  );
}

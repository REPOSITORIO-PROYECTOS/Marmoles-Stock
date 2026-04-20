import React, { useEffect, useMemo, useState } from 'react';
import { get } from '../../../api';
import { Input } from '../../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Layers, Search } from 'lucide-react';

export interface PlacaListItem {
  id: string;
  material_id: string;
  material_nombre: string;
  ancho: number;
  largo: number;
  espesor?: number | null;
  estado: string;
  precio?: number | null;
  codigo?: string | null;
  ubicacion?: string | null;
  lote_id?: string | null;
  lote_codigo?: string | null;
  m2?: number;
}

export function StockPlacasPanel() {
  const [rows, setRows] = useState<PlacaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await get<PlacaListItem[]>('/api/placas?estado=disponible');
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar las placas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const blob = [
        r.material_nombre,
        r.codigo,
        r.ubicacion,
        r.lote_codigo,
        String(r.largo),
        String(r.ancho),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(s);
    });
  }, [rows, q]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ub = (a.ubicacion || '').localeCompare(b.ubicacion || '', 'es');
      if (ub !== 0) return ub;
      return (a.codigo || '').localeCompare(b.codigo || '', 'es');
    });
  }, [filtered]);

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Stock de placas
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Cada fila es una <strong>placa física</strong> (incluye importación desde Excel). El nombre de
              material es el del catálogo; si al importar coincidió con un material ya existente, verás ese
              nombre abreviado. Usá <strong>Código</strong> (PLC-…) y <strong>Bloque</strong> para ubicar la pieza
              del planilla.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar código, material, bloque…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando placas…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay placas disponibles o no coincide la búsqueda.</p>
        ) : (
          <div className="overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Código</TableHead>
                  <TableHead>Material (catálogo)</TableHead>
                  <TableHead className="whitespace-nowrap">Largo × Ancho (mm)</TableHead>
                  <TableHead className="whitespace-nowrap">Esp. mm</TableHead>
                  <TableHead className="whitespace-nowrap">m²</TableHead>
                  <TableHead className="whitespace-nowrap">Bloque</TableHead>
                  <TableHead>Lote</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{r.codigo || '—'}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <span className="font-medium">{r.material_nombre}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {r.largo} × {r.ancho}
                    </TableCell>
                    <TableCell>{r.espesor ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">
                      {typeof r.m2 === 'number' ? r.m2.toFixed(3) : '—'}
                    </TableCell>
                    <TableCell className="font-medium">{r.ubicacion || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={r.lote_codigo || ''}>
                      {r.lote_codigo || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && !error && (
          <p className="text-xs text-muted-foreground mt-3">
            Mostrando {sorted.length} de {rows.length} placas disponibles
          </p>
        )}
      </CardContent>
    </Card>
  );
}

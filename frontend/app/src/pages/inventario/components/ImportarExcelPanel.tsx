import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { importInventarioExcel, downloadInventarioExcel } from '../../../api';
import { toast } from 'sonner';

interface ImportarExcelPanelProps {
  onImportado?: () => void;
}

export const ImportarExcelPanel: React.FC<ImportarExcelPanelProps> = ({ onImportado }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [reemplazar, setReemplazar] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [importando, setImportando] = useState(false);

  const handleDescargar = async () => {
    setDescargando(true);
    try {
      await downloadInventarioExcel();
      toast.success('Excel descargado. Editá y volvé a subirlo.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo descargar');
    } finally {
      setDescargando(false);
    }
  };

  const handleImportar = async () => {
    if (!archivo) {
      toast.error('Elegí un archivo .xlsx');
      return;
    }
    if (
      reemplazar &&
      !confirm(
        '¿Reemplazar todas las placas y retazos con el contenido del Excel? (Recomendado tras corregir el archivo descargado.)'
      )
    ) {
      return;
    }

    setImportando(true);
    try {
      const res = await importInventarioExcel(archivo, {
        wipe: reemplazar,
        createMaterials: true,
      });
      const upd = res.placas_actualizadas ?? 0;
      const updR = res.retazos_actualizados ?? 0;
      toast.success(
        `Importado: ${res.placas_creadas} placas nuevas, ${upd} actualizadas · ${res.retazos_creados} retazos nuevos, ${updR} actualizados`
      );
      setArchivo(null);
      if (inputRef.current) inputRef.current.value = '';
      onImportado?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'No se pudo importar');
    } finally {
      setImportando(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Excel: descargar, corregir e importar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
          <li>
            <strong>Descargar</strong> el inventario actual (incluye columna <em>Codigo</em> por placa).
          </li>
          <li>Editar medidas, materiales o bloques en Excel.</li>
          <li>
            <strong>Importar</strong> el archivo. Por defecto fusiona con lo existente (coincide por{' '}
            <em>nombre de material</em>, bloque y medidas).
          </li>
        </ol>

        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3 bg-muted/30">
          <strong>Sin reemplazar:</strong> actualiza filas que coinciden por nombre de material + bloque +
          largo/alto (o por columna <em>Codigo</em> si está). Solo agrega filas nuevas que no existían.
          <br />
          <strong>Con reemplazar:</strong> borra placas y retazos y deja el inventario igual al Excel.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={descargando}
            onClick={handleDescargar}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {descargando ? 'Descargando…' : 'Descargar inventario (.xlsx)'}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end border-t border-dashed pt-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="excel-inventario">Subir Excel corregido</Label>
            <input
              ref={inputRef}
              id="excel-inventario"
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            type="button"
            disabled={!archivo || importando}
            onClick={handleImportar}
            className="gap-2 shrink-0"
          >
            <Upload className="h-4 w-4" />
            {importando ? 'Importando…' : 'Importar'}
          </Button>
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={reemplazar}
            onChange={(e) => setReemplazar(e.target.checked)}
            className="rounded border-border mt-0.5"
          />
          <span>
            Reemplazar placas y retazos antes de importar (inventario = Excel). Desmarcado: fusiona por{' '}
            <em>nombre de material</em>, bloque y medidas; también respeta <em>Codigo</em> si viene en el
            archivo.
          </span>
        </label>
      </CardContent>
    </Card>
  );
};

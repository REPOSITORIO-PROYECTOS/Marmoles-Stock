import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { get, importInventarioExcel } from '../../../api';
import { toast } from 'sonner';

interface ImportarExcelPanelProps {
  onImportado?: () => void;
}

export const ImportarExcelPanel: React.FC<ImportarExcelPanelProps> = ({ onImportado }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [reemplazar, setReemplazar] = useState(false);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const me = await get<{ role?: string }>('/api/usuarios/me');
        setIsAdmin(me?.role === 'admin');
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  if (!isAdmin) return null;

  const handleImportar = async () => {
    if (!archivo) {
      toast.error('Elegí un archivo .xlsx');
      return;
    }
    if (
      reemplazar &&
      !confirm(
        '¿Reemplazar placas y retazos existentes antes de importar? Los lotes y materiales se mantienen.'
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
      toast.success(
        `Importado: ${res.placas_creadas} placas, ${res.retazos_creados} retazos, ${res.materiales_creados} materiales nuevos`
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
    <Card className="border-border mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Importar desde Excel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Archivo tipo{' '}
          <strong>Control_Inventario_Marmoleria 2026.xlsx</strong> con hojas{' '}
          <em>Control de Bloques</em> e <em>Inventario Remanentes</em>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="excel-inventario">Archivo .xlsx</Label>
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
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={reemplazar}
            onChange={(e) => setReemplazar(e.target.checked)}
            className="rounded border-border"
          />
          Reemplazar placas y retazos antes de importar (no borra lotes ni materiales)
        </label>
      </CardContent>
    </Card>
  );
};

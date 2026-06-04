import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent } from '../../components/ui/card';
import { get } from '../../api';
import { ImportarExcelPanel } from './components/ImportarExcelPanel';

export function InventarioExcel() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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

  return (
    <div className="h-full flex flex-col bg-background">
      <PageHeader
        icon={FileSpreadsheet}
        title="Importar / Exportar Excel"
        description="Descargá el inventario, editá en Excel y volvé a subirlo (solo administradores)"
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 max-w-3xl">
        {isAdmin === null && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {isAdmin === false && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-6 flex gap-3 items-start">
              <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Acceso restringido</p>
                <p className="text-sm text-amber-800/90 mt-1">
                  Solo usuarios con rol <strong>admin</strong> pueden importar o exportar el inventario en Excel.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin === true && <ImportarExcelPanel />}
      </div>
    </div>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ConfirmarPagos } from './ConfirmarPagos';
import { HistorialDescuentos } from './HistorialDescuentos';
import { Wallet, CreditCard, Percent, Settings2 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { ConfiguracionComercial } from './ConfiguracionComercial';

export function FinanzasPage() {
  return (
    <div className="h-full flex flex-col bg-background p-6">
      <PageHeader
        icon={Wallet}
        title="Finanzas y Cobranzas"
        description="Control integral de ingresos y gestión de presupuestos aceptados."
      />

      <Tabs defaultValue="pagos" className="space-y-6 mt-6">
        <TabsList className="bg-muted w-fit">
          <TabsTrigger value="pagos" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Confirmar Pagos
          </TabsTrigger>
          <TabsTrigger value="descuentos" className="gap-2">
            <Percent className="h-4 w-4" />
            Historial de Descuentos
          </TabsTrigger>
          <TabsTrigger value="configuracion" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Configuración Comercial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pagos" className="space-y-4">
          <ConfirmarPagos />
        </TabsContent>

        <TabsContent value="descuentos" className="space-y-4">
          <HistorialDescuentos />
        </TabsContent>

        <TabsContent value="configuracion" className="space-y-4">
          <ConfiguracionComercial />
        </TabsContent>
      </Tabs>
    </div>
  );
}

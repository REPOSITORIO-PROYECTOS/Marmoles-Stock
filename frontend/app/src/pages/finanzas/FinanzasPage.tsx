import { ConfirmarPagos } from './ConfirmarPagos';
import { Wallet } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';

export function FinanzasPage() {
  return (
    <div className="h-full flex flex-col bg-background p-6">
      <PageHeader
        icon={Wallet}
        title="Finanzas"
        description="Registro y seguimiento de pagos de presupuestos."
      />

      <div className="mt-6">
        <ConfirmarPagos />
      </div>
    </div>
  );
}

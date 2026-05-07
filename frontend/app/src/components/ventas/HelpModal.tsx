import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Info, User, Layers, Scissors, CheckCircle } from "lucide-react";

export function HelpModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
          <Info className="w-4 h-4 mr-2" /> Ayuda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            <Info className="text-blue-600" /> Flujo de Registro de Presupuesto
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex gap-4 p-4 rounded-lg bg-blue-50 border border-blue-100">
              <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold">1</div>
              <div>
                <h4 className="font-bold text-blue-900 flex items-center gap-2">
                  <User size={18} /> Datos del Cliente
                </h4>
                <p className="text-sm text-blue-800">
                  Selecciona un cliente de la lista o elige "+ Nuevo Cliente" para registrarlo. 
                  Puedes usar el botón del mapa para capturar la ubicación exacta mediante GPS, 
                  lo cual facilitará futuras visitas técnicas.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
              <div className="bg-slate-600 text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold">2</div>
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Layers size={18} /> Material y Lote
                </h4>
                <p className="text-sm text-slate-800">
                  Elige el material deseado. El sistema filtrará automáticamente y te mostrará solo las 
                  <b> planchas o retazos que tienen stock real disponible</b> en el taller.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
              <div className="bg-slate-600 text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold">3</div>
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Scissors size={18} /> Diseño de Corte
                </h4>
                <p className="text-sm text-slate-800">
                  Utiliza el editor visual para dibujar las piezas sobre el material seleccionado. 
                  El sistema calculará el aprovechamiento y el costo total en base a los m² utilizados.
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-lg bg-green-50 border border-green-100">
              <div className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold">4</div>
              <div>
                <h4 className="font-bold text-green-900 flex items-center gap-2">
                  <CheckCircle size={18} /> Finalizar e Imprimir
                </h4>
                <p className="text-sm text-green-800">
                  Revisa el resumen final. Al hacer clic en "Guardar", se creará el presupuesto y 
                  automáticamente se generará un Lead en el CRM. Luego puedes imprimir el comprobante 
                  profesional para el cliente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React from 'react';

interface PresupuestoLegalLayoutProps {
  cliente: any;
  material: string;
  lote?: string;
  total: number;
  area: number;
  unidad?: string;
  cantidad?: number;
  children: React.ReactNode;
}

export function PresupuestoLegalLayout({
  children
}: PresupuestoLegalLayoutProps) {
  return (
    <div className="w-full">
      <div id="board-editor-container" className="relative border-2 border-blue-100 rounded-xl overflow-hidden shadow-inner bg-gray-50">
        {children}
      </div>
    </div>
  );
}

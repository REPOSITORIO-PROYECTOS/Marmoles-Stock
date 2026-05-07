import * as React from 'react';
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { cn } from '../../ui/utils';

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Si se omite, el contenido puede incluir sus propias acciones (ej. ClienteForm). */
  footer?: React.ReactNode;
  className?: string;
};

/** Patrón compacto: título, cuerpo con scroll, acciones abajo (Sprint 7.1 / 7.2). */
export function PresupuestoModalShell({ title, description, children, footer, className }: Props) {
  return (
    <DialogContent
      className={cn(
        'gap-0 p-0 w-[calc(100vw-1.25rem)] sm:max-w-sm max-h-[min(92vh,520px)] flex flex-col overflow-hidden rounded-lg border shadow-lg',
        className,
      )}
    >
      <DialogHeader className="px-3 pt-2.5 pb-2 border-b shrink-0 text-left space-y-0.5">
        <DialogTitle className="text-sm font-semibold leading-snug pr-8">{title}</DialogTitle>
        {description ? (
          <p className="text-[11px] text-muted-foreground font-normal leading-snug">{description}</p>
        ) : null}
      </DialogHeader>
      <div className="px-3 py-2 overflow-y-auto flex-1 min-h-0">{children}</div>
      {footer != null ? (
        <DialogFooter className="px-3 py-2 border-t bg-muted/30 shrink-0 flex-row justify-end gap-2 sm:gap-2">
          {footer}
        </DialogFooter>
      ) : null}
    </DialogContent>
  );
}

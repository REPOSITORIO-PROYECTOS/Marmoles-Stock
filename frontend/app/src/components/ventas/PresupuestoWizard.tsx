import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ChevronRight, ChevronLeft, Printer, Save } from "lucide-react";
import { cn } from "../../components/ui/utils";

interface Step {
  id: string;
  title: string;
}

interface PresupuestoWizardProps {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  canGoNext: boolean;
  nextDisabledMessage?: string;
  onPrint: () => void;
  children: React.ReactNode;
}

export function PresupuestoWizard({ 
  steps, 
  currentStep, 
  onStepChange, 
  canGoNext, 
  nextDisabledMessage,
  onPrint, 
  children 
}: PresupuestoWizardProps) {
  
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="space-y-6">
      {/* Indicador de Pasos */}
      <div className="flex justify-between items-center mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10" />
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center">
            <div 
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors",
                index <= currentStep ? "bg-blue-600 text-white" : "bg-white border-2 border-gray-200 text-gray-400"
              )}
            >
              {index + 1}
            </div>
            <span className={cn(
              "text-xs mt-2 font-medium",
              index <= currentStep ? "text-blue-600" : "text-gray-400"
            )}>
              {step.title}
            </span>
          </div>
        ))}
      </div>

      {/* Contenido del Paso */}
      <Card className="min-h-[500px] flex flex-col shadow-lg border-blue-100">
        <CardHeader className="border-b bg-gray-50/50">
          <CardTitle className="text-xl text-blue-900 flex justify-between items-center">
            {steps[currentStep].title}
            {isLastStep && (
              <div className="flex gap-2">
                <Button onClick={onPrint} className="bg-blue-600 hover:bg-blue-700">
                  <Printer className="mr-2 h-4 w-4" /> Imprimir Documento
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-6">
          {children}
        </CardContent>
        
        {/* Navegación */}
        {!isLastStep && (
          <div className="p-6 border-t bg-gray-50/50 flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={() => onStepChange(currentStep - 1)}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
            </Button>
            
            <div className="flex items-center gap-4">
              {!canGoNext && nextDisabledMessage && (
                <span className="text-xs text-red-500 font-medium max-w-[200px] text-right">
                  {nextDisabledMessage}
                </span>
              )}
              <Button 
                onClick={() => onStepChange(currentStep + 1)}
                className={cn(
                  "transition-all duration-200",
                  canGoNext ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed opacity-70"
                )}
                disabled={!canGoNext}
              >
                Siguiente <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

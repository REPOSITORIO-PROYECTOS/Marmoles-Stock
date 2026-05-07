/**
 * LEGACY: wizard por pasos y ruta /ventas/presupuestos/nuevo (ya no existen).
 * El flujo vigente está en ConstructorPresupuestos: ver presupuesto.cy.ts y presupuesto_flow.cy.ts.
 * Se mantiene el archivo como referencia; no ejecutar hasta reescribir contra la UI actual.
 */
describe.skip('Flujo Completo: Crear Presupuesto con todas las funcionalidades (legacy)', () => {
  
  beforeEach(() => {
    // Navegar a la página del presupuesto
    cy.visit('/ventas/presupuestos/nuevo');
  });

  // =========================================================================
  // TESTS: MÓDULO 4 (PAGOS)
  // =========================================================================

  describe('Módulo 4: Descuentos en Pagos', () => {
    
    it('Debe mostrar sección "Pago" (no "Extras y Pago")', () => {
      cy.contains('4. Pago').should('be.visible');
      cy.contains('4. Extras y Pago').should('not.exist');
    });

    it('Debe mostrar selector de Tipo de Cobro', () => {
      cy.get('select').contains('Tipo de Cobro').should('exist');
    });

    it('Debe mostrar campo de Descuento con tipo y valor', () => {
      cy.contains('Descuento').should('be.visible');
      
      // Selector de tipo (fijo/porcentaje)
      cy.get('select').contains('Monto Fijo').should('exist');
      cy.get('select').contains('Porcentaje').should('exist');
      
      // Input de valor
      cy.get('input[placeholder*="Ej: "]').should('exist');
    });

    it('Descuento fijo debe restar cantidad exacta del total', () => {
      // Ingreso descuento fijo de 500
      cy.get('select').eq(0).select('fijo');
      cy.get('input[type="number"]').eq(0).type('500');
      
      // El total debe reducirse por 500
      cy.get('[data-testid="total"]').should('contain', '4500');
    });

    it('Descuento porcentaje debe calcular correctamente', () => {
      // Ingreso descuento 10%
      cy.get('select').eq(0).select('porcentaje');
      cy.get('input[type="number"]').eq(0).type('10');
      
      // El total debe reducirse por 10% (5000 - 500 = 4500)
      cy.get('[data-testid="total"]').should('contain', '4500');
    });

    it('Flag "Requiere Factura" debe ser toggle, no afecta total', () => {
      const totalAntes = cy.get('[data-testid="total"]');
      
      cy.get('input[type="checkbox"]').contains('Requiere Factura').click();
      
      const totalDespues = cy.get('[data-testid="total"]');
      
      // El total debe ser igual
      totalAntes.should('equal', totalDespues);
    });
  });

  // =========================================================================
  // TESTS: MÓDULO 1 (GEOLOCALIZACIÓN)
  // =========================================================================

  describe('Módulo 1: Geolocalización', () => {
    
    it('LocationPicker debe mostrar mapa y buscador', () => {
      cy.get('input[placeholder*="Buscar"]').should('be.visible');
      cy.get('[role="button"]').contains('Buscar').should('be.visible');
    });

    it('Búsqueda de dirección debe retornar resultados', () => {
      cy.get('input[placeholder*="Buscar"]').type('Avenida Libertador, Rawson');
      cy.get('[role="button"]').contains('Buscar').click();
      
      // Debe aparecer resultado
      cy.get('[data-testid="search-result"]').should('have.length.greaterThan', 0);
    });

    it('Si búsqueda falla, debe mostrar toast error (no console.error)', () => {
      cy.get('input[placeholder*="Buscar"]').type('zzzzzzzzzzz xxxx');
      cy.get('[role="button"]').contains('Buscar').click();
      
      // Debe mostrar toast error
      cy.get('[role="alert"]').contains('No se pudo completar').should('be.visible');
    });

    it('Botón "Centrar en San Juan" debe resetear a coordenadas por defecto', () => {
      cy.get('[role="button"]').contains('Centrar en San Juan').click();
      
      // Las coordenadas deben volver al default
      cy.get('[data-testid="coordinates"]').should('contain', '-31.5373');
    });
  });

  // =========================================================================
  // TESTS: MÓDULO 3 (LOTE Y DISEÑO)
  // =========================================================================

  describe('Módulo 3: Lote y Diseño de Corte', () => {
    
    it('Título de paso debe ser "3. Lote y Diseño de Corte"', () => {
      cy.contains('3. Lote y Diseño de Corte').should('be.visible');
    });

    it('Debe haber RadioGroup para "Placa Completa" vs "Recortes"', () => {
      cy.get('input[type="radio"]').contains('Placa Completa').should('exist');
      cy.get('input[type="radio"]').contains('Recortes').should('exist');
    });

    it('Seleccionar "Placa Completa" debe marcar opción', () => {
      cy.get('input[type="radio"][value="completa"]').click();
      cy.get('input[type="radio"][value="completa"]').should('be.checked');
    });

    it('Debe permitir cargar múltiples archivos DXF', () => {
      const files = ['plano1.dxf', 'plano2.dxf', 'plano3.dxf'];
      
      cy.get('input[type="file"]').selectFile(files, { force: true });
      
      // Debe mostrar tabla con 3 archivos
      cy.get('[data-testid="planos-table"] tr').should('have.length', 3);
    });

    it('Tabla de planos debe mostrar nombre, área y m lineales', () => {
      cy.get('input[type="file"]').selectFile('plano1.dxf', { force: true });
      
      cy.get('[data-testid="plano-nombre"]').should('contain', 'plano1');
      cy.get('[data-testid="plano-area"]').should('contain', 'm²');
      cy.get('[data-testid="plano-metros"]').should('contain', 'm');
    });

    it('Debe haber botón "Procesar todos los planos"', () => {
      cy.get('[role="button"]').contains('Procesar todos').should('be.visible');
    });

    it('Botón eliminar plano debe quitar de lista', () => {
      cy.get('input[type="file"]').selectFile('plano1.dxf', { force: true });
      cy.get('[data-testid="planos-table"] tr').should('have.length', 1);
      
      cy.get('[role="button"]').contains('Eliminar').click();
      cy.get('[data-testid="planos-table"] tr').should('have.length', 0);
    });
  });

  // =========================================================================
  // TESTS: RENOMBRADOS
  // =========================================================================

  describe('UI: Renombrados Correctos', () => {
    
    it('Wizard debe mostrar "4. Pago" en lugar de "4. Extras y Pago"', () => {
      cy.get('[data-testid="step-4"]').should('contain', '4. Pago');
    });

    it('Sección de extras debe tener título "Extras"', () => {
      cy.get('[data-testid="extras-section"]').contains('Extras').should('be.visible');
    });

    it('Sección de pago debe tener título "Pago"', () => {
      cy.get('[data-testid="payment-section"]').contains('Pago').should('be.visible');
    });
  });

  // =========================================================================
  // TESTS: INTEGRACIÓN COMPLETA
  // =========================================================================

  describe('Integración: Flujo Completo de Presupuesto', () => {
    
    it('Debe permitir crear presupuesto con descuento', () => {
      // Paso 1: Cliente
      cy.get('input[placeholder*="Cliente"]').type('Juan Pérez');
      cy.get('[role="button"]').contains('Siguiente').click();
      
      // Paso 2: Material
      cy.get('select').contains('Mármol Blanco').select('Mármol Blanco');
      cy.get('input[placeholder*="Cantidad"]').type('5');
      cy.get('[role="button"]').contains('Siguiente').click();
      
      // Paso 3: Lote y Diseño
      cy.get('input[type="radio"][value="recortes"]').click();
      cy.get('[role="button"]').contains('Siguiente').click();
      
      // Paso 4: Pago
      cy.get('select').first().select('Contado');
      cy.get('select').eq(1).select('fijo');
      cy.get('input[placeholder*="Ej: "]').type('500');
      cy.get('[role="button"]').contains('Siguiente').click();
      
      // Paso 5: Finalizar
      cy.get('[role="button"]').contains('Guardar').click();
      
      // Validar que se guardó
      cy.get('[role="status"]').contains('Presupuesto guardado').should('be.visible');
    });

    it('Total debe actualizarse cuando cambia descuento', () => {
      // Establecer subtotal de 5000
      cy.get('[data-testid="subtotal"]').should('contain', '5000');
      
      // Agregar descuento de 500
      cy.get('select').eq(1).select('fijo');
      cy.get('input[placeholder*="Ej: "]').type('500');
      
      // Total debe cambiar a 4500
      cy.get('[data-testid="total"]').should('contain', '4500');
    });

    it('Presupuesto guardado debe incluir información de descuento', () => {
      // ... crear presupuesto con descuento
      
      // Verificar que al cargar, el descuento está guardado
      cy.get('input[placeholder*="Ej: "]').should('have.value', '500');
    });
  });

  // =========================================================================
  // TESTS: VALIDACIONES
  // =========================================================================

  describe('Validaciones', () => {
    
    it('Descuento NO debe aceptar valores negativos', () => {
      cy.get('input[placeholder*="Ej: "]').type('-500');
      cy.get('[role="button"]').contains('Siguiente').click();
      
      cy.get('[role="alert"]').contains('Descuento no puede ser negativo').should('be.visible');
    });

    it('Total NO debe ser negativo aunque haya descuento alto', () => {
      // Subtotal: 1000, Descuento: 2000
      // Total debe ser 0 o error
      cy.get('select').eq(1).select('fijo');
      cy.get('input[placeholder*="Ej: "]').type('2000');
      
      cy.get('[data-testid="total"]').should('not.contain', '-');
    });

    it('Campo de descuento debe aceptar solo números', () => {
      cy.get('input[placeholder*="Ej: "]').type('abc{selectall}');
      
      cy.get('input[placeholder*="Ej: "]').should('have.value', '');
    });
  });

  // =========================================================================
  // TESTS: ACCESIBILIDAD
  // =========================================================================

  describe('Accesibilidad', () => {
    
    it('Inputs deben tener labels asociados', () => {
      cy.get('label').first().should('have.attr', 'for');
    });

    it('Descripciones deben ser claras para campos de descuento', () => {
      cy.get('label').contains('Descuento').should('exist');
      cy.get('label').contains('Monto Fijo').should('exist');
    });

    it('Botones deben tener aria-label o texto visible', () => {
      cy.get('[role="button"]').each(($btn) => {
        cy.wrap($btn).should(($el) => {
          const ariaLabel = $el.attr('aria-label');
          const text = $el.text();
          expect(ariaLabel || text).to.exist;
        });
      });
    });
  });
});

// =========================================================================
// TESTS: CARGA PESADA
// =========================================================================

describe.skip('Performance (legacy)', () => {
  
  it('Cálculo de total con descuento debe ser < 100ms', () => {
    const start = performance.now();
    
    let total = 5000;
    const descuento = 10;
    total -= total * (descuento / 100);
    
    const end = performance.now();
    
    expect(end - start).toBeLessThan(100);
  });

  it('Carga de múltiples planos debe ser < 5s', () => {
    cy.get('input[type="file"]').selectFile([
      'plano1.dxf',
      'plano2.dxf',
      'plano3.dxf'
    ], { force: true });
    
    cy.get('[data-testid="planos-table"] tr', { timeout: 5000 }).should('have.length', 3);
  });
});

export {};

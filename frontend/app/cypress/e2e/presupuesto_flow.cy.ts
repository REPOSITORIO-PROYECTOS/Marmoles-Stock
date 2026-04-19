describe('Flujo simple de presupuesto', () => {
  it('Permite agregar y eliminar extra "Zócalos ml"', () => {
    cy.visit('/');
    cy.intercept('GET', '/api/clientes', []).as('clientes');
    cy.intercept('GET', '/api/materiales', [{ id: 'mat-1', nombre: 'Granito Negro', precio_m2: 100000 }]).as('materiales');
    cy.wait(['@clientes', '@materiales']);
    cy.contains('COTIZADOR').click({ force: true });
    cy.contains('Agregados y Cortes Extra').should('exist');
    cy.get('input[placeholder="Ej: Pegado de bacha..."]').type('Zócalos ml');
    cy.get('input[type="number"]').eq(1).clear().type('12');
    cy.get('input[type="number"]').eq(2).clear().type('5000');
    cy.get('button').contains('Guardar Nuevo en Catálogo').click();
    cy.get('button').contains('Borrar todos').should('exist');
    cy.get('[data-testid^="delete-extra-"]').first().click();
    cy.contains('Zócalos ml').should('not.exist');
  });
  it('Muestra fechas correctas en Gestión de Planos (usa fecha_creacion)', () => {
    cy.intercept('GET', '/api/presupuestos', [
      { id: 'P-1', cliente_nombre: 'Cliente A', total: 100, fecha_creacion: '2026-02-01T10:00:00Z' },
      { id: 'P-2', cliente_nombre: 'Cliente B', total: 200, fecha_creacion: '2026-02-03T12:00:00Z' }
    ]).as('presupuestos');
    cy.contains('Producción').click({ force: true });
    cy.contains('Solicitudes de Visita').click({ force: true });
    cy.wait('@presupuestos');
    cy.contains('02/01/2026').should('exist');
    cy.contains('02/03/2026').should('exist');
  });
});

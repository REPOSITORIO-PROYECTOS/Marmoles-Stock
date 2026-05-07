describe('Flujo presupuesto (constructor actual)', () => {
  beforeEach(() => {
    cy.presupuestoAppLogin();
    cy.stubPresupuestoAppApis();
    cy.intercept('POST', '/api/presupuestos/maestros/extras', (req) => {
      const body = req.body as { nombre?: string; precio_base?: number; unidad?: string };
      req.reply({
        statusCode: 200,
        body: {
          id: 'ex-nuevo',
          nombre: body.nombre || 'Extra',
          precio_base: Number(body.precio_base) || 0,
          unidad: body.unidad || 'ml',
        },
      });
    }).as('postMaestroExtra');
  });

  it('crea extra en catálogo desde una pieza y luego lo quita de la línea', () => {
    cy.visit('/ventas/presupuestos');
    cy.wait('@getMe');
    cy.wait('@getClientes');
    cy.wait('@getMaestroMateriales');
    cy.contains('Presupuesto constructor', { timeout: 20000 }).should('be.visible');

    cy.get('[role="combobox"]').first().click();
    cy.contains('Cliente Test').click({ force: true });

    cy.contains('h2', 'Ambientes y piezas', { timeout: 15000 })
      .scrollIntoView()
      .should('be.visible');

    cy.contains('button', /Pieza en/).click();

    cy.contains('Pieza / material base', { timeout: 15000 })
      .closest('.rounded-lg')
      .find('[role="combobox"]')
      .first()
      .click();
    cy.get('[role="option"]').contains('Granito Negro').click();

    cy.contains('label', 'Largo (m)').parent().find('input').clear().type('1');
    cy.contains('label', 'Ancho (m)').parent().find('input').clear().type('1');

    cy.contains('button', '+ Extra').click();
    cy.contains('button', 'Nuevo extra en catálogo').click();

    cy.get('[role="dialog"]')
      .filter(':visible')
      .last()
      .within(() => {
        cy.contains('label', 'Nombre').parent().find('input').type('Zócalos ml');
        cy.contains('label', 'Precio neto').parent().find('input').clear().type('5000');
        cy.contains('button', 'Crear y agregar').click();
      });

    cy.wait('@postMaestroExtra');
    cy.contains('Zócalos ml').should('be.visible');

    cy.contains('Zócalos ml').parents('.flex.flex-wrap').first().find('button').click();
    cy.contains('Zócalos ml').should('not.exist');
  });

  it('Órdenes de visita: lista presupuestos aceptados desde API', () => {
    cy.intercept('GET', '/api/trabajos', { statusCode: 200, body: [] }).as('getTrabajos');
    cy.intercept('GET', '/api/presupuestos?aceptados=true&solo_finanzas=false', {
      statusCode: 200,
      body: [
        {
          id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          cliente_id: 'c1',
          cliente_nombre: 'Cliente A',
          total: 100,
          observaciones: '',
          estado_pago: 'pendiente',
          monto_cobrado: 0,
          fecha_creacion: '2026-02-01T10:00:00Z',
        },
        {
          id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
          cliente_id: 'c2',
          cliente_nombre: 'Cliente B',
          total: 200,
          observaciones: '',
          estado_pago: 'pendiente',
          monto_cobrado: 0,
          fecha_creacion: '2026-02-03T12:00:00Z',
        },
      ],
    }).as('getOrdenesVisita');

    cy.visit('/produccion/planos');
    cy.wait('@getMe');
    cy.wait('@getOrdenesVisita');
    cy.contains('Gestión de Órdenes de Visita', { timeout: 20000 }).should('be.visible');
    cy.contains('Cliente A').should('be.visible');
    cy.contains('Cliente B').should('be.visible');
  });
});

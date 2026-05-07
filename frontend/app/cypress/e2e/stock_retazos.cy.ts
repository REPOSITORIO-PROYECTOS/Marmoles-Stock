describe('Stock de Retazos (E2E)', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.setItem('token', 'cypress-test-token');
    });

    cy.intercept('GET', '/api/usuarios/me', {
      statusCode: 200,
      body: { id: 'u1', nombre: 'Admin Cypress', rol: 'admin' },
    }).as('getMe');
  });

  it('guarda un retazo sin lote y refresca el listado', () => {
    let createdWithoutLote = false;

    cy.intercept('GET', '/api/materiales', {
      statusCode: 200,
      body: [{ id: 'm1', nombre: 'Blanco Brasil', precio_m2: 5000 }],
    }).as('getMateriales');

    cy.intercept('GET', '/api/lotes?material_id=m1', {
      statusCode: 200,
      body: [{ id: 'l1', codigo_lote: 'L-001' }],
    }).as('getLotes');

    cy.intercept('GET', '/api/inventario/retazos?estado=disponible', (req) => {
      req.reply({
        statusCode: 200,
        body: createdWithoutLote
          ? [{ id: 'r1', material_id: 'm1', ancho: 50, largo: 40, estado: 'disponible', en_venta: false, precio: 1000, lote_id: null, lote_codigo: null }]
          : [],
      });
    }).as('getRetazos');

    cy.intercept('POST', '/api/inventario/retazos', (req) => {
      expect(req.body.material_id).to.eq('m1');
      expect(req.body.ancho).to.eq(50);
      expect(req.body.largo).to.eq(40);
      expect(req.body).to.not.have.property('lote_id');
      createdWithoutLote = true;
      req.reply({ statusCode: 200, body: { id: 'r1' } });
    }).as('postRetazo');

    cy.visit('/inventario/retazos');
    cy.wait('@getMe');
    cy.wait('@getMateriales');
    cy.wait('@getRetazos');

    cy.contains('button', /Añadir Retazo/i).click();

    cy.get('[role="combobox"][id="material-nuevo"]').click();
    cy.contains('[role="option"]', 'Blanco Brasil').click();
    cy.wait('@getLotes');

    cy.get('input[id="largo-nuevo"]').clear().type('40');
    cy.get('input[id="ancho-nuevo"]').clear().type('50');
    cy.get('input[id="precio-m2"]').clear().type('5000');

    cy.contains('button', /Crear Retazo/i).click();
    cy.wait('@postRetazo');
    cy.wait('@getRetazos');

    cy.contains('Catálogo de Retazos (1)').should('be.visible');
    cy.contains('Blanco Brasil').should('be.visible');
  });
});


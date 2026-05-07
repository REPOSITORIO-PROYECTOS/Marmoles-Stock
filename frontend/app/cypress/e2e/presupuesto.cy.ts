describe('Constructor de presupuestos (E2E)', () => {
  beforeEach(() => {
    cy.presupuestoAppLogin();
    cy.stubPresupuestoAppApis({
      materiales: [{ id: 'mat1', nombre: 'Mármol Carrara', precio_m2: 150_000 }],
    });
  });

  it('selecciona cliente, material y dimensiones; el total refleja m² × precio + IVA', () => {
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
    cy.get('[role="option"]').contains('Mármol Carrara').click();

    cy.contains('label', 'Largo (m)').parent().find('input').clear().type('2');
    cy.contains('label', 'Ancho (m)').parent().find('input').clear().type('1.5');

    // 2 × 1,5 = 3 m² × 150000 = 450000 neto; IVA 21% = 94500; total 544500
    cy.get('[data-testid="total"]', { timeout: 15000 }).should(($el) => {
      const t = $el.text().replace(/\s/g, '');
      expect(t).to.match(/544[\s.]?500/);
    });
  });

  it('no muestra ambientes hasta elegir un cliente', () => {
    cy.visit('/ventas/presupuestos');
    cy.wait('@getMe');
    cy.contains('Presupuesto constructor', { timeout: 20000 }).should('be.visible');
    cy.contains('Ambientes y piezas').should('not.exist');

    cy.get('[role="combobox"]').first().click();
    cy.contains('Cliente Test').click();
    cy.contains('h2', 'Ambientes y piezas').scrollIntoView().should('be.visible');
  });
});

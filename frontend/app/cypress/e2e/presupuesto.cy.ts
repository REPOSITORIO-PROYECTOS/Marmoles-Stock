describe('Flujo de Presupuesto IMA Mármoles', () => {
  beforeEach(() => {
    // Deshabilitar fallos por excepciones no capturadas de la aplicación
    Cypress.on('uncaught:exception', (err, runnable) => {
      return false;
    });

    // Forzar login bypass
    window.localStorage.setItem('token', 'test-token-bypass');

    // Interceptar llamadas API
    cy.intercept('GET', '/api/usuarios/me', {
      statusCode: 200,
      body: { id: '1', nombre: 'Admin Test', rol: 'ADMIN' }
    }).as('getMe');
    cy.intercept('GET', '/api/clientes', {
      statusCode: 200,
      body: [
        { id: '1', nombre: 'Cliente Test', cuit: '20-12345678-9', direccion: 'Calle Falsa 123', telefono: '12345678' }
      ]
    }).as('getClientes');

    cy.intercept('GET', '/api/materiales', {
      statusCode: 200,
      body: [
        { id: 'mat1', nombre: 'Mármol Carrara', precio_m2: 150000 }
      ]
    }).as('getMateriales');

    cy.intercept('GET', '/api/inventario/stock-detallado?material_id=mat1', {
      statusCode: 200,
      body: [
        { id: 'lote1', codigo_lote: 'LOTE-A1', tipo: 'plancha', lote_id: 'batch1', ancho: 200, largo: 250 }
      ]
    }).as('getLotes');

    cy.intercept('GET', '/api/servicios?categoria=ExtraPresupuesto', {
      statusCode: 200,
      body: [
        { id: 'extra1', nombre: 'Zócalo', precio_base: 5000, unidad: 'ml' }
      ]
    }).as('getServicios');

    cy.visit('/ventas/presupuestos');
    // Si hay un login, aquí deberíamos manejarlo (aunque el sistema parece tener auth_disabled o token en localStorage)
  });

  it('debe completar el flujo desde selección de cliente hasta impresión', () => {
    // Paso 1: Cliente
    cy.wait('@getClientes');
    cy.contains('label', 'Seleccionar Cliente').parent().find('button').click({ force: true });
    cy.get('[role="option"]').contains('Cliente Test').click({ force: true });
    cy.contains('button', 'Siguiente').click({ force: true });

    // Paso 2: Material y Lote
    cy.wait('@getMateriales');
    cy.contains('label', '1. Seleccionar Material').parent().find('button').click({ force: true });
    cy.get('[role="option"]').contains('Mármol Carrara').click({ force: true });
    
    cy.wait('@getLotes');
    cy.contains('label', '2. Seleccionar Lote / Placa').parent().find('button').click({ force: true });
    cy.get('[role="option"]').contains('LOTE-A1').click({ force: true });
    
    cy.contains('$150.000').should('exist');
    cy.contains('button', 'Siguiente').click({ force: true });

    // Paso 3: Dibujo (Diseño de Corte)
    // En lugar de dibujar en un canvas, usamos la opción de "Diseño Rápido" que ofrece el DXFWorkflow
    cy.contains('button', 'Diseño Rápido').click({ force: true });

    // Verificamos que el área se haya actualizado (debería ser > 0)
    cy.contains('Área Utilizada').parent().should('not.contain', '0.00 m²');
    
    // Verificamos que aparezca la vista previa del corte
    cy.contains('Vista Previa del Corte').should('exist');
    
    cy.contains('button', 'Siguiente').click({ force: true });

    // Paso 4: Extras y Pago
    cy.wait('@getServicios');
    cy.contains('Agregados y Cortes Extra').should('exist');
    cy.contains('button', 'Siguiente').click({ force: true });

    // Paso 5: Finalizar
    cy.contains('¡Todo listo para imprimir!').should('exist');
    cy.contains('Resumen de Venta').should('exist');
    cy.contains('Mármol Carrara').should('exist');
  });

  it('no debe permitir avanzar si faltan datos', () => {
    // En el paso 1 sin seleccionar cliente
    cy.contains('button', 'Siguiente').should('be.disabled');
    
    // Seleccionamos cliente
    cy.contains('label', 'Seleccionar Cliente').parent().find('button').click({ force: true });
    cy.get('[role="option"]').contains('Cliente Test').click({ force: true });
    
    // Ahora debería habilitarse
    cy.contains('button', 'Siguiente').should('not.be.disabled');
    cy.contains('button', 'Siguiente').click({ force: true });

    // En el paso 2 sin seleccionar material
    cy.contains('button', 'Siguiente').should('be.disabled');
  });
});

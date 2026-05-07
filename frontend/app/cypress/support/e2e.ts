/* Evita fallar por rejections de React/Radix en entorno de prueba */
Cypress.on('uncaught:exception', () => false);

/**
 * Stubs mínimos para E2E del frontend contra Vite (puerto 3000).
 * El constructor usa maestros bajo /api/presupuestos/maestros/* y usePresupuestoSimple
 * sigue pidiendo /api/clientes, /api/materiales y /api/compras al montar.
 */

Cypress.Commands.add('presupuestoAppLogin', () => {
  cy.window().then((win) => {
    win.localStorage.setItem('token', 'cypress-test-token');
  });
});

Cypress.Commands.add('stubPresupuestoAppApis', (options?: { materiales?: unknown[]; extras?: unknown[] }) => {
  const materiales = options?.materiales ?? [
    { id: 'mat-1', nombre: 'Granito Negro', precio_m2: 100_000 },
  ];
  const extras = options?.extras ?? [
    { id: 'extra1', nombre: 'Zócalo base', precio_base: 1_000, unidad: 'ml' },
  ];

  cy.intercept('GET', '/api/usuarios/me', {
    statusCode: 200,
    body: { id: '1', nombre: 'Admin Cypress', rol: 'ADMIN' },
  }).as('getMe');

  cy.intercept('GET', '/api/clientes', {
    statusCode: 200,
    body: [
      {
        id: 'cli-1',
        nombre: 'Cliente Test',
        email: 'test@example.com',
        telefono: '1234567890',
      },
    ],
  }).as('getClientes');

  cy.intercept('GET', '/api/materiales', { statusCode: 200, body: [] }).as('getMaterialesLegacy');
  cy.intercept('GET', '/api/compras', { statusCode: 200, body: [] }).as('getCompras');

  cy.intercept('GET', '/api/presupuestos/maestros/materiales', {
    statusCode: 200,
    body: materiales,
  }).as('getMaestroMateriales');

  cy.intercept('GET', /\/api\/presupuestos\/maestros\/extras(\?.*)?$/, {
    statusCode: 200,
    body: extras,
  }).as('getMaestroExtras');

  cy.intercept('GET', '/api/presupuestos/maestros/productos-adicionales', {
    statusCode: 200,
    body: [],
  }).as('getProdAdicionales');

  cy.intercept('GET', '/api/plazos-pago-catalogo', {
    statusCode: 200,
    body: [{ id: 'pz1', nombre: 'Contado', codigo: 'contado' }],
  }).as('getPlazosPago');

  cy.intercept('GET', '/api/descuentos-catalogo', { statusCode: 200, body: [] }).as('getDescuentosCatalogo');
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      presupuestoAppLogin(): Chainable<void>;
      stubPresupuestoAppApis(options?: { materiales?: unknown[]; extras?: unknown[] }): Chainable<void>;
    }
  }
}

export {};

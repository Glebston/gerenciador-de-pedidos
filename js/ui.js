// ===========================================================
// MÓDULO UI "GERENTE" / "ARQUIVO-BARRIL" (v4.3.5)
// Responsabilidade: Importar e reexportar funções de 
// todos os especialistas da UI.
// ESTE ARQUIVO NÃO CONTÉM LÓGICA.
// ==========================================================

// Reexporta tudo dos especialistas

// Exporta seletores do DOM e constantes
export * from './ui/dom.js';

// Exporta funções de modais (showInfoModal, etc.)
export * from './ui/modalHandler.js';

// Exporta renderizadores do financeiro (renderFinanceDashboard, etc.)
export * from './ui/financeRenderer.js';

// Exporta renderizadores de pedidos (renderOrders, addOrderCard, etc.)
export * from './ui/orderRenderer.js';

// Exporta manipuladores de formulário (addPart, updateFinancials, etc.)
export * from './ui/formHandler.js';

// Exporta renderizadores da tabela de preços (renderPriceTable, etc.)
export * from './ui/priceTableRenderer.js';

// Exporta funções ajudantes (formatPhoneNumber, updateSourceSelectionUI, etc.)
export * from './ui/helpers.js';

// js/listeners/financeListeners.js

// v5.7.22: REMOVIDA importação estática de UI.
// import * as UI from '../ui.js';

/**
 * Lida com a lógica de preenchimento do modal para editar uma transação.
 * (Anteriormente em main.js)
 * v5.7.22: 'UI' agora é injetado nesta função auxiliar.
 * @param {object} UI - O módulo UI (injetado)
 * @param {string} id - O ID da transação.
 * @param {Function} getTransactions - A função getAllTransactions.
 */
function handleEditTransaction(UI, id, getTransactions) {
    const transaction = getTransactions().find(t => t.id === id);
    if (!transaction) return;
    
    // v5.7.1: Bloco removido. 
    // A edição agora é permitida mesmo para transações vinculadas a pedidos.
    /*
    if (transaction.orderId) {
        UI.showInfoModal("Este lançamento foi gerado por um pedido e não pode ser editado manualmente. Por favor, edite o pedido correspondente.");
        return;
    }
    */

    UI.DOM.transactionId.value = transaction.id; 
    UI.DOM.transactionDate.value = transaction.date; 
    UI.DOM.transactionDescription.value = transaction.description;
    UI.DOM.transactionAmount.value = transaction.amount; 
    UI.DOM.transactionType.value = transaction.type; 
    UI.DOM.transactionCategory.value = transaction.category || '';
    
    UI.updateSourceSelectionUI(UI.DOM.transactionSourceContainer, transaction.source || 'banco');
    
    const isIncome = transaction.type === 'income';
    UI.DOM.transactionStatusContainer.classList.toggle('hidden', !isIncome);
    if (isIncome) {
        (transaction.status === 'a_receber' ? UI.DOM.a_receber : UI.DOM.pago).checked = true;
    }
    
    UI.DOM.transactionModalTitle.textContent = isIncome ? 'Editar Entrada' : 'Editar Despesa';
    
    // v5.7.6: Centralizado via modalHandler para aplicar o remendo de z-index
    UI.showTransactionModal();
}

/**
 * Inicializa todos os event listeners relacionados ao Dashboard Financeiro.
 * v5.7.22: A função agora recebe o módulo 'UI' injetado pelo main.js.
 * @param {object} UI - O módulo UI (injetado)
 * @param {object} deps - Dependências injetadas
 * @param {object} deps.services - Funções de serviço (saveTransaction, etc.)
 * @param {Function} deps.getConfig - Getter para userBankBalanceConfig
 * @param {Function} deps.setConfig - Setter para userBankBalanceConfig (para atualizar o initialBalance)
 */
export function initializeFinanceListeners(UI, deps) {

    const { services, getConfig, setConfig } = deps;

    // --- Botões "Nova Entrada" / "Nova Despesa" ---
    UI.DOM.addIncomeBtn.addEventListener('click', () => { 
        UI.DOM.transactionForm.reset(); 
        UI.DOM.transactionId.value = ''; 
        UI.DOM.transactionType.value = 'income'; 
        UI.DOM.transactionModalTitle.textContent = 'Nova Entrada'; 
        UI.DOM.transactionDate.value = new Date().toISOString().split('T')[0]; 
        UI.DOM.transactionStatusContainer.classList.remove('hidden'); 
        UI.DOM.pago.checked = true; 
        UI.updateSourceSelectionUI(UI.DOM.transactionSourceContainer, 'banco'); 
        
        // v5.7.6: Centralizado via modalHandler para aplicar o remendo de z-index
        UI.showTransactionModal();
    });

    UI.DOM.addExpenseBtn.addEventListener('click', () => { 
        UI.DOM.transactionForm.reset(); 
        UI.DOM.transactionId.value = ''; 
        UI.DOM.transactionType.value = 'expense'; 
        UI.DOM.transactionModalTitle.textContent = 'Nova Despesa'; 
        UI.DOM.transactionDate.value = new Date().toISOString().split('T')[0]; 
        UI.DOM.transactionStatusContainer.classList.add('hidden'); 
        UI.updateSourceSelectionUI(UI.DOM.transactionSourceContainer, 'banco'); 
        
        // v5.7.6: Centralizado via modalHandler para aplicar o remendo de z-index
        UI.showTransactionModal();
    });

    // --- Formulário de Transação (Modal) ---
    UI.DOM.transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedSourceEl = UI.DOM.transactionSourceContainer.querySelector('.source-selector.active');
        if (!selectedSourceEl) {
            UI.showInfoModal("Por favor, selecione a Origem (Banco ou Caixa).");
            return;
        }
        const data = {
            date: UI.DOM.transactionDate.value,
            description: UI.DOM.transactionDescription.value,
            amount: parseFloat(UI.DOM.transactionAmount.value),
            type: UI.DOM.transactionType.value,
            category: UI.DOM.transactionCategory.value.trim(),
            source: selectedSourceEl.dataset.source,
            status: UI.DOM.transactionType.value === 'income' 
                ? (UI.DOM.a_receber.checked ? 'a_receber' : 'pago') 
                : 'pago'
        };
        if (!data.date || !data.description || isNaN(data.amount) || data.amount <= 0) {
            UI.showInfoModal("Por favor, preencha todos os campos com valores válidos.");
            return;
        }
        try {
            await services.saveTransaction(data, UI.DOM.transactionId.value);
            
            // v5.7.6: Centralizado via modalHandler
            UI.hideTransactionModal();

        } catch (error) {
            console.error("Erro ao salvar transação:", error);
            UI.showInfoModal("Não foi possível salvar o lançamento. Verifique sua conexão e tente novamente.");
        }
    });

    // v5.7.6: Adicionado listener para o botão Cancelar
    UI.DOM.cancelTransactionBtn.addEventListener('click', () => {
        UI.hideTransactionModal();
    });

    // --- Lista de Transações (Edição, Exclusão, Marcar como Pago) ---
    UI.DOM.transactionsList.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.id) return;
        
        const id = btn.dataset.id;
        if (btn.classList.contains('edit-transaction-btn')) {
            // v5.7.22: Injeta a UI na função auxiliar
            handleEditTransaction(UI, id, services.getAllTransactions);
        } else if (btn.classList.contains('delete-transaction-btn')) {
            
            // v5.7.1: Bloco removido.
            // A exclusão agora é permitida mesmo para transações vinculadas a pedidos.
            /*
            const transaction = services.getAllTransactions().find(t => t.id === id);
            if (transaction && transaction.orderId) {
                UI.showInfoModal("Este lançamento foi gerado por um pedido e não pode ser excluído manualmente. Por favor, edite o pedido correspondente.");
                return;
            }
            */
            
            UI.showConfirmModal("Tem certeza que deseja excluir este lançamento?", "Excluir", "Cancelar")
              .then(ok => ok && services.deleteTransaction(id));
        } else if (btn.classList.contains('mark-as-paid-btn')) {
            services.markTransactionAsPaid(id);
        }
    });

    // --- Filtros do Dashboard Financeiro ---
    const renderFullDashboard = () => UI.renderFinanceDashboard(services.getAllTransactions(), getConfig());

    UI.DOM.periodFilter.addEventListener('change', () => { 
        UI.DOM.customPeriodContainer.classList.toggle('hidden', UI.DOM.periodFilter.value !== 'custom'); 
        renderFullDashboard(); 
    });

    [UI.DOM.startDateInput, UI.DOM.endDateInput, UI.DOM.transactionSearchInput].forEach(element => {
        if(element) element.addEventListener('input', renderFullDashboard);
    });

    // --- Ajuste de Saldo ---
    UI.DOM.adjustBalanceBtn.addEventListener('click', () => {
        UI.DOM.initialBalanceInput.value = (getConfig().initialBalance || 0).toFixed(2);
        UI.DOM.initialBalanceModal.classList.remove('hidden');
    });

    UI.DOM.saveBalanceBtn.addEventListener('click', async () => {
        const newBalance = parseFloat(UI.DOM.initialBalanceInput.value);
        if (isNaN(newBalance)) {
            UI.showInfoModal("Por favor, insira um valor numérico válido.");
            return;
        }
        await services.saveInitialBalance(newBalance);
        setConfig({ initialBalance: newBalance }); // Atualiza o estado local no main.js
        
        renderFullDashboard(); // Renderiza KPIs e lista, pois o saldo em conta mudou
        UI.DOM.initialBalanceModal.classList.add('hidden');
    });

    // --- Seletor de Fonte (Banco/Caixa) no Modal de Transação ---
    UI.DOM.transactionSourceContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.source-selector');
        if (target) {
            UI.updateSourceSelectionUI(UI.DOM.transactionSourceContainer, target.dataset.source);
        }
    });
}

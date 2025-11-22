// js/listeners/financeListeners.js
// ==========================================================
// MÓDULO FINANCE LISTENERS (v5.8.4 - SYNC & CALCULATION FIX)
// ==========================================================

/**
 * Lida com a lógica de preenchimento do modal para editar uma transação.
 * @param {object} UI - O módulo UI (injetado)
 * @param {string} id - O ID da transação.
 * @param {Function} getTransactions - A função getAllTransactions.
 */
function handleEditTransaction(UI, id, getTransactions) {
    const transaction = getTransactions().find(t => t.id === id);
    if (!transaction) return;
    
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
    
    UI.showTransactionModal();
}

/**
 * Inicializa todos os event listeners relacionados ao Dashboard Financeiro.
 * @param {object} UI - O módulo UI (injetado)
 * @param {object} deps - Dependências injetadas
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
            const transactionId = UI.DOM.transactionId.value;
            
            // LÓGICA DE SINCRONIZAÇÃO DE DESCONTO
            if (transactionId && services.getTransactionById && services.updateOrderDiscountFromFinance) {
                const originalTransaction = services.getTransactionById(transactionId);

                // Verifica se tem vínculo com pedido
                if (originalTransaction && originalTransaction.orderId) {
                    const oldAmount = parseFloat(originalTransaction.amount) || 0;
                    const newAmount = data.amount;
                    const diff = newAmount - oldAmount;

                    // Se o valor mudou significativamente, atualiza o pedido
                    if (Math.abs(diff) > 0.001) {
                        await services.updateOrderDiscountFromFinance(originalTransaction.orderId, diff);
                    }
                }
            }

            await services.saveTransaction(data, transactionId);
            
            UI.hideTransactionModal();

        } catch (error) {
            console.error("Erro ao salvar transação:", error);
            UI.showInfoModal("Não foi possível salvar o lançamento. Verifique sua conexão e tente novamente.");
        }
    });

    UI.DOM.cancelTransactionBtn.addEventListener('click', () => {
        UI.hideTransactionModal();
    });

    // --- Lista de Transações (Edição, Exclusão, Marcar como Pago) ---
    UI.DOM.transactionsList.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.id) return;
        
        const id = btn.dataset.id;
        if (btn.classList.contains('edit-transaction-btn')) {
            handleEditTransaction(UI, id, services.getAllTransactions);
        } else if (btn.classList.contains('delete-transaction-btn')) {
            UI.showConfirmModal("Tem certeza que deseja excluir este lançamento?", "Excluir", "Cancelar")
              .then(ok => ok && services.deleteTransaction(id));
        } else if (btn.classList.contains('mark-as-paid-btn')) {
            services.markTransactionAsPaid(id);
        }
    });

    // --- Filtros do Dashboard Financeiro ---
    
    // Debounce para inputs de texto (Search e Datas Customizadas)
    // Isso evita que o cálculo seja disparado a cada tecla, dando tempo para o valor estabilizar
    let filterDebounceTimeout;

    const renderFullDashboard = () => {
        // 1. Determina as datas do filtro para passar ao cálculo de pedidos
        const filter = UI.DOM.periodFilter ? UI.DOM.periodFilter.value : 'thisMonth';
        const now = new Date();
        let startDate = null, endDate = null;

        if (filter === 'custom') {
            if (UI.DOM.startDateInput.value) startDate = new Date(UI.DOM.startDateInput.value + 'T00:00:00');
            if (UI.DOM.endDateInput.value) endDate = new Date(UI.DOM.endDateInput.value + 'T23:59:59');
        } else {
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            const startOfThisYear = new Date(now.getFullYear(), 0, 1);
            const endOfThisYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

            switch(filter) {
                case 'thisMonth': startDate = startOfThisMonth; endDate = endOfThisMonth; break;
                case 'lastMonth': startDate = startOfLastMonth; endDate = endOfLastMonth; break;
                case 'thisYear': startDate = startOfThisYear; endDate = endOfThisYear; break;
            }
        }
        
        // Fallback de Segurança se as datas não estiverem definidas (assume mês atual)
        if (!startDate || !endDate) {
             startDate = new Date(now.getFullYear(), now.getMonth(), 1);
             endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }

        // 2. Busca o valor atualizado das pendências de pedidos FILTRADO PELA DATA
        // Adiciona log para debug se necessário
        const pendingRevenue = services.calculateTotalPendingRevenue 
            ? services.calculateTotalPendingRevenue(startDate, endDate) 
            : 0;
            
        UI.renderFinanceDashboard(services.getAllTransactions(), getConfig(), pendingRevenue);
    };

    UI.DOM.periodFilter.addEventListener('change', () => { 
        UI.DOM.customPeriodContainer.classList.toggle('hidden', UI.DOM.periodFilter.value !== 'custom'); 
        renderFullDashboard(); 
    });

    [UI.DOM.startDateInput, UI.DOM.endDateInput, UI.DOM.transactionSearchInput].forEach(element => {
        if(element) {
            element.addEventListener('input', () => {
                clearTimeout(filterDebounceTimeout);
                filterDebounceTimeout = setTimeout(renderFullDashboard, 300); // Espera 300ms antes de renderizar
            });
        }
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
        setConfig({ initialBalance: newBalance }); 
        
        renderFullDashboard(); 
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


// js/listeners/financeListeners.js
// ===========================================================
// MÓDULO FINANCE LISTENERS (v5.22.5 - FAB INTEGRATION)
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
    
    // --- BLINDAGEM DE INTEGRIDADE ---
    if (transaction.orderId) {
        UI.showInfoModal("🔒 Esta transação está vinculada a um Pedido.\n\nPara garantir a integridade financeira, edite-a através do botão 'Editar' no Painel de Pedidos.");
        return;
    }

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
 * Inicializa a lógica do Botão de Ação Flutuante (FAB).
 * Simula cliques nos botões originais para evitar duplicação de regra de negócio.
 */
function initializeFabListeners(UI) {
    // Verifica se os elementos existem para evitar erros em páginas que não tenham o FAB
    if (!UI.DOM.fabToggleBtn || !UI.DOM.fabActions) return;

    // 1. Abrir/Fechar Menu
    UI.DOM.fabToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita fechar imediatamente ao clicar
        const isExpanded = UI.DOM.fabToggleBtn.getAttribute('aria-expanded') === 'true';
        
        if (isExpanded) {
            UI.DOM.fabActions.classList.add('hidden');
            UI.DOM.fabToggleBtn.setAttribute('aria-expanded', 'false');
            UI.DOM.fabToggleBtn.classList.remove('rotate-45'); // Remove rotação do ícone
        } else {
            UI.DOM.fabActions.classList.remove('hidden');
            UI.DOM.fabToggleBtn.setAttribute('aria-expanded', 'true');
            UI.DOM.fabToggleBtn.classList.add('rotate-45'); // Adiciona rotação para virar um "X"
        }
    });

    // 2. Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        if (!UI.DOM.fabContainer.contains(e.target)) {
            UI.DOM.fabActions.classList.add('hidden');
            UI.DOM.fabToggleBtn.setAttribute('aria-expanded', 'false');
            UI.DOM.fabToggleBtn.classList.remove('rotate-45');
        }
    });

    // 3. Ação: Nova Receita (Simula clique no botão original)
    if (UI.DOM.fabAddIncomeBtn) {
        UI.DOM.fabAddIncomeBtn.addEventListener('click', () => {
            UI.DOM.fabActions.classList.add('hidden'); // Fecha o menu
            UI.DOM.fabToggleBtn.classList.remove('rotate-45');
            UI.DOM.addIncomeBtn.click(); // Dispara a lógica existente
        });
    }

    // 4. Ação: Nova Despesa (Simula clique no botão original)
    if (UI.DOM.fabAddExpenseBtn) {
        UI.DOM.fabAddExpenseBtn.addEventListener('click', () => {
            UI.DOM.fabActions.classList.add('hidden'); // Fecha o menu
            UI.DOM.fabToggleBtn.classList.remove('rotate-45');
            UI.DOM.addExpenseBtn.click(); // Dispara a lógica existente
        });
    }
}

/**
 * Inicializa todos os event listeners relacionados ao Dashboard Financeiro.
 * @param {object} UI - O módulo UI (injetado)
 * @param {object} deps - Dependências injetadas
 */
export function initializeFinanceListeners(UI, deps) {

    const { services, getConfig, setConfig } = deps;

    // Inicializa o FAB (Novo v5.22.4)
    initializeFabListeners(UI);

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
        const transaction = services.getAllTransactions().find(t => t.id === id);

        if (btn.classList.contains('edit-transaction-btn')) {
            handleEditTransaction(UI, id, services.getAllTransactions);
        
        } else if (btn.classList.contains('delete-transaction-btn')) {
            if (transaction && transaction.orderId) {
                UI.showInfoModal("🔒 Esta transação está vinculada a um Pedido.\n\nPara excluir este pagamento, vá ao Painel de Pedidos, edite o pedido e remova o pagamento da lista.");
                return;
            }

            UI.showConfirmModal("Tem certeza que deseja excluir este lançamento?", "Excluir", "Cancelar")
              .then(ok => ok && services.deleteTransaction(id));
        
        } else if (btn.classList.contains('mark-as-paid-btn')) {
            services.markTransactionAsPaid(id);
        }
    });

    // --- Filtros do Dashboard Financeiro ---
    
    let filterDebounceTimeout;

    const renderFullDashboard = () => {
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
        
        if (!startDate || !endDate) {
             startDate = new Date(now.getFullYear(), now.getMonth(), 1);
             endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }

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
                filterDebounceTimeout = setTimeout(renderFullDashboard, 300); 
            });
        }
    });

    // --- Ajuste de Saldo ---
    
    // 1. Abrir Modal
    UI.DOM.adjustBalanceBtn.addEventListener('click', () => {
        // Busca o valor atual e formata com 2 casas decimais
        const currentBalance = getConfig().initialBalance || 0;
        UI.DOM.initialBalanceInput.value = currentBalance.toFixed(2);
        
        UI.DOM.initialBalanceModal.classList.remove('hidden');
        
        // UX: Foca automaticamente no campo para facilitar a digitação
        setTimeout(() => UI.DOM.initialBalanceInput.focus(), 50);
    });

    // 2. Botão Cancelar (A Lógica que faltava!)
    const closeBalanceModal = () => {
        UI.DOM.initialBalanceModal.classList.add('hidden');
    };
    
    // Verifica se o botão existe antes de adicionar o evento (Defesa contra erros)
    if (UI.DOM.cancelBalanceBtn) {
        UI.DOM.cancelBalanceBtn.addEventListener('click', closeBalanceModal);
    }

    // 3. Botão Salvar (Com Feedback Visual e Atualização Garantida)
    UI.DOM.saveBalanceBtn.addEventListener('click', async () => {
        const btn = UI.DOM.saveBalanceBtn;
        const originalText = btn.textContent; // Guarda o texto "Salvar"
        
        // Converte o valor inputado (substitui vírgula por ponto por segurança)
        const inputValue = UI.DOM.initialBalanceInput.value.replace(',', '.');
        const newBalance = parseFloat(inputValue);

        if (isNaN(newBalance)) {
            UI.showInfoModal("Por favor, insira um valor numérico válido.");
            return;
        }

        try {
            // UX: Muda o botão para o usuário ver que algo está acontecendo
            btn.textContent = "Salvando...";
            btn.disabled = true;

            // Passo A: Aguarda o salvamento no Banco de Dados (Firebase)
            await services.saveInitialBalance(newBalance);
            
            // Passo B: Atualiza IMEDIATAMENTE a configuração local na memória
            setConfig({ initialBalance: newBalance }); 
            
            // Passo C: Força o Dashboard a recalcular tudo agora
            renderFullDashboard(); 
            
            // Passo D: Fecha o modal com sucesso
            closeBalanceModal();

        } catch (error) {
            console.error("Erro crítico ao salvar saldo:", error);
            UI.showInfoModal("Não foi possível atualizar o saldo. Verifique sua conexão.");
        } finally {
            // Restaura o botão para o estado original, aconteça o que acontecer
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    // --- Seletor de Origem (Banco/Caixa) ---
    UI.DOM.transactionSourceContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.source-selector');
        if (target) {
            UI.updateSourceSelectionUI(UI.DOM.transactionSourceContainer, target.dataset.source);
        }
    });
}

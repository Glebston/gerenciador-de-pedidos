// ==========================================================
// MÓDULO FINANCE RENDERER (v4.3.0)
// Responsabilidade: Gerenciar a renderização de tudo 
// relacionado ao Dashboard Financeiro: KPIs, Gráficos e 
// a lista de transações.
// ==========================================================

import { DOM } from './dom.js';

/**
 * Cria o HTML para uma única linha de transação (mas não a insere)
 * @returns {string} String HTML da <tr>
 */
const generateTransactionRowHTML = (t) => {
    const isIncome = t.type === 'income';
    const isReceivable = isIncome && t.status === 'a_receber';
    
    const amountClass = isIncome ? 'text-green-600' : 'text-red-600';
    const formattedDate = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
    const transactionAmount = typeof t.amount === 'number' ? t.amount.toFixed(2) : '0.00';
    
    const statusBadge = isReceivable ? `<span class="ml-2 text-xs font-semibold py-1 px-2 rounded-full bg-yellow-100 text-yellow-800">A Receber</span>` : '';
    const sourceBadge = `<span class="text-xs font-semibold py-1 px-2 rounded-full ${t.source === 'caixa' ? 'bg-gray-200 text-gray-800' : 'bg-indigo-100 text-indigo-800'}">${t.source === 'caixa' ? 'Caixa' : 'Banco'}</span>`;
    
    // v5.0: Oculta botões de edição/exclusão se a transação estiver vinculada a um pedido
    const isLinkedToOrder = !!t.orderId;
    let actionsHtml = '';

    if (isLinkedToOrder) {
        actionsHtml = `<span class="text-xs text-gray-500 italic" title="Vinculado ao Pedido ID: ${t.orderId}">Lançado via Pedido</span>`;
    } else {
        actionsHtml = `
            <button data-id="${t.id}" class="edit-transaction-btn text-blue-500 hover:underline text-sm">Editar</button>
            <button data-id="${t.id}" class="delete-transaction-btn text-red-500 hover:underline text-sm ml-2">Excluir</button>
        `;
    }

    if (isReceivable && !isLinkedToOrder) { // Só permite "Receber" se for manual e "A Receber"
        actionsHtml = `<button data-id="${t.id}" class="mark-as-paid-btn text-green-600 hover:underline text-sm font-semibold">Receber</button> ` + actionsHtml;
    }

    return `
        <td class="py-3 px-4">${formattedDate}</td>
        <td class="py-3 px-4 flex items-center">${t.description} ${statusBadge}</td>
        <td class="py-3 px-4 text-gray-600">${t.category || ''}</td>
        <td class="py-3 px-4">${sourceBadge}</td>
        <td class="py-3 px-4 text-right font-semibold ${amountClass}">
            ${isIncome ? '+' : '-'} R$ ${transactionAmount}
        </td>
        <td class="py-3 px-4 text-right">
            ${actionsHtml}
        </td>
    `;
};

/**
 * Adiciona uma linha de transação à tabela
 */
export const addTransactionRow = (transaction) => {
    const tr = document.createElement('tr');
    tr.className = `border-b hover:bg-gray-50 ${transaction.status === 'a_receber' ? 'bg-yellow-50' : ''}`;
    tr.dataset.id = transaction.id;
    tr.dataset.date = transaction.date;
    tr.innerHTML = generateTransactionRowHTML(transaction);

    // Insere ordenado por data (mais novo primeiro)
    const allRows = Array.from(DOM.transactionsList.querySelectorAll('tr[data-id]'));
    let inserted = false;
    for (const existingRow of allRows) {
        if (transaction.date > existingRow.dataset.date) {
            DOM.transactionsList.insertBefore(tr, existingRow);
            inserted = true;
            break;
        }
    }
    if (!inserted) {
        DOM.transactionsList.appendChild(tr);
    }
    
    // Remove placeholder se existir
    const placeholder = DOM.transactionsList.querySelector('.transactions-placeholder');
    if (placeholder) placeholder.remove();
};

/**
 * Atualiza uma linha de transação existente
 */
export const updateTransactionRow = (transaction) => {
    const row = DOM.transactionsList.querySelector(`tr[data-id="${transaction.id}"]`);
    if (row) {
        // Apenas atualiza o conteúdo e as classes
        row.className = `border-b hover:bg-gray-50 ${transaction.status === 'a_receber' ? 'bg-yellow-50' : ''}`;
        row.innerHTML = generateTransactionRowHTML(transaction);
        // Remove e readiciona para garantir a ordenação correta
        const oldDate = row.dataset.date;
        if (transaction.date !== oldDate) {
            row.remove();
            addTransactionRow(transaction);
        }
    }
};

/**
 * Remove uma linha de transação da tabela
 */
export const removeTransactionRow = (transactionId) => {
    const row = DOM.transactionsList.querySelector(`tr[data-id="${transactionId}"]`);
    if (row) {
        row.remove();
    }
    
    // Mostra placeholder se a lista ficar vazia
    if (DOM.transactionsList.children.length === 0) {
        showTransactionsPlaceholder(false);
    }
};

/**
 * Exibe a mensagem de "Nenhum lançamento"
 */
const showTransactionsPlaceholder = (isSearch) => {
    const message = isSearch ? 'Nenhum lançamento encontrado para a busca.' : 'Nenhum lançamento encontrado para este período.';
    DOM.transactionsList.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500 transactions-placeholder">${message}</td></tr>`;
};

/**
 * Renderiza apenas os KPIs (cards superiores) do dashboard financeiro
 */
export const renderFinanceKPIs = (allTransactions, userBankBalanceConfig) => {
    const filterValue = DOM.periodFilter.value;
    const now = new Date();
    let startDate, endDate;

    if (filterValue === 'custom') {
        startDate = DOM.startDateInput.value ? new Date(DOM.startDateInput.value + 'T00:00:00') : null;
        endDate = DOM.endDateInput.value ? new Date(DOM.endDateInput.value + 'T23:59:59') : null;
    } else {
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const startOfThisYear = new Date(now.getFullYear(), 0, 1);
        const endOfThisYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

        switch(filterValue) {
            case 'thisMonth': startDate = startOfThisMonth; endDate = endOfThisMonth; break;
            case 'lastMonth': startDate = startOfLastMonth; endDate = endOfLastMonth; break;
            case 'thisYear': startDate = startOfThisYear; endDate = endOfThisYear; break;
        }
    }
    
    const filteredTransactions = allTransactions.filter(t => {
        const transactionDate = new Date(t.date + 'T00:00:00');
        if (startDate && endDate) return transactionDate >= startDate && transactionDate <= endDate;
        if(startDate && !endDate) return transactionDate >= startDate;
        if(!startDate && endDate) return transactionDate <= endDate;
        return true;
    });

    // v4.2.5: Separação de bankFlow e cashFlow
    let faturamentoBruto = 0, despesasTotais = 0, contasAReceber = 0, valorRecebido = 0;
    let bankFlow = 0; // Fluxo do Banco
    let cashFlow = 0; // Fluxo do Caixa (Dinheiro em Mãos)

    filteredTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        if (t.type === 'income') {
            faturamentoBruto += amount;
            if (t.status === 'a_receber') {
                contasAReceber += amount;
            } else {
                valorRecebido += amount;
            }
        } else if (t.type === 'expense') {
            despesasTotais += amount;
        }
        
        // Separa o fluxo de caixa (caixa) do fluxo de banco (banco ou indefinido)
        if (t.source === 'caixa') {
            if (t.type === 'income' && t.status !== 'a_receber') {
                cashFlow += amount;
            } else if (t.type === 'expense') {
                cashFlow -= amount;
            }
        } else { // 'banco' ou undefined (legado)
            if (t.type === 'income' && t.status !== 'a_receber') {
                bankFlow += amount;
            } else if (t.type === 'expense') {
                bankFlow -= amount;
            }
        }
    });

    const lucroLiquido = valorRecebido - despesasTotais;
    // Saldo em Conta (Banco) = Saldo Inicial + Fluxo do Banco
    const saldoEmConta = (userBankBalanceConfig.initialBalance || 0) + bankFlow;
    // Saldo em Caixa (Mãos) = Apenas o Fluxo do Caixa (não usa saldo inicial)
    const saldoEmCaixa = cashFlow;

    DOM.faturamentoBruto.textContent = `R$ ${faturamentoBruto.toFixed(2)}`;
    DOM.despesasTotais.textContent = `R$ ${despesasTotais.toFixed(2)}`;
    DOM.contasAReceber.textContent = `R$ ${contasAReceber.toFixed(2)}`;
    DOM.lucroLiquido.textContent = `R$ ${lucroLiquido.toFixed(2)}`;
    DOM.saldoEmConta.textContent = `R$ ${saldoEmConta.toFixed(2)}`;
    DOM.saldoEmCaixa.textContent = `R$ ${saldoEmCaixa.toFixed(2)}`;
    
    const expenseCategories = {}, incomeCategories = {};

    filteredTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        const category = t.category || 'Sem Categoria';

        if (t.type === 'expense') {
            if (!expenseCategories[category]) expenseCategories[category] = 0;
            expenseCategories[category] += amount;
        } else if (t.type === 'income') {
            if (!incomeCategories[category]) incomeCategories[category] = 0;
            incomeCategories[category] += amount;
        }
    });

    const formatCategoryList = (categoryData, containerElement) => {
        const sortedCategories = Object.entries(categoryData)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        if (sortedCategories.length === 0) {
            containerElement.innerHTML = '<p class="text-sm text-gray-500">Nenhum dado no período.</p>';
            return;
        }

        let html = '<ul class="space-y-2 text-sm">';
        sortedCategories.forEach(([category, total]) => {
            html += `
                <li class="flex justify-between items-center py-1">
                    <span class="text-gray-700 truncate pr-2">${category}</span>
                    <span class="font-semibold text-gray-900 whitespace-nowrap">R$ ${total.toFixed(2)}</span>
                </li>
            `;
        });
        html += '</ul>';
        containerElement.innerHTML = html;
    };

    formatCategoryList(expenseCategories, DOM.topExpensesByCategory);
    formatCategoryList(incomeCategories, DOM.topIncomesByCategory);
    
    return filteredTransactions;
};

/**
 * Função principal de renderização do dashboard financeiro (para carga inicial ou filtros)
 */
export const renderFinanceDashboard = (allTransactions, userBankBalanceConfig) => {
    if (!DOM.periodFilter) return;

    // 1. Renderiza os KPIs e obtém as transações filtradas
    const filteredTransactions = renderFinanceKPIs(allTransactions, userBankBalanceConfig);

    // 2. Filtra por busca
    const searchTerm = DOM.transactionSearchInput.value.toLowerCase();
    const displayTransactions = searchTerm ?
        filteredTransactions.filter(t => t.description.toLowerCase().includes(searchTerm)) :
        filteredTransactions;
        
    // 3. Renderiza a lista de transações (apenas na carga inicial/filtro)
    DOM.transactionsList.innerHTML = ''; // Limpa a lista
    if (displayTransactions.length === 0) {
        showTransactionsPlaceholder(searchTerm.length > 0);
        return;
    }
    
    // Ordena por data (mais novo primeiro)
    displayTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    displayTransactions.forEach(addTransactionRow);
};

// js/ui/financeRenderer.js
// ==========================================================
// MÓDULO FINANCE RENDERER (v5.22.2 - SMART SHIELD RESTORED)
// ==========================================================

import { DOM } from './dom.js';

// --- ESTADO INTERNO (MEMÓRIA BLINDADA) ---
// Recuperamos essa variável para evitar o "Zero Fantasma" no carregamento.
let internalPendingRevenueCache = 0;
let lastContextFilter = ''; 

// --- HELPER DE FORMATAÇÃO (BRL) ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const generateTransactionRowHTML = (t) => {
    const isIncome = t.type === 'income';
    const isReceivable = isIncome && t.status === 'a_receber';
    
    const amountClass = isIncome ? 'text-green-600' : 'text-red-600';
    const formattedDate = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
    
    // Uso da formatação brasileira
    const transactionAmount = typeof t.amount === 'number' ? formatCurrency(t.amount).replace('R$', '').trim() : '0,00';
    
    const statusBadge = isReceivable ? `<span class="ml-2 text-xs font-semibold py-1 px-2 rounded-full bg-yellow-100 text-yellow-800">A Receber</span>` : '';
    const sourceBadge = `<span class="text-xs font-semibold py-1 px-2 rounded-full ${t.source === 'caixa' ? 'bg-gray-200 text-gray-800' : 'bg-indigo-100 text-indigo-800'}">${t.source === 'caixa' ? 'Caixa' : 'Banco'}</span>`;
    
    const isLinkedToOrder = !!t.orderId;
    let actionsHtml = '';

    if (isReceivable) { 
        actionsHtml = `<button data-id="${t.id}" class="mark-as-paid-btn text-green-600 hover:underline text-sm font-semibold">Receber</button> `;
    }

    actionsHtml += `
        <button data-id="${t.id}" class="edit-transaction-btn text-blue-500 hover:underline text-sm">Editar</button>
        <button data-id="${t.id}" class="delete-transaction-btn text-red-500 hover:underline text-sm ml-2">Excluir</button>
    `;

    if (isLinkedToOrder) {
        actionsHtml += `<span class="block text-xs text-gray-500 italic mt-1" title="Vinculado ao Pedido ID: ${t.orderId}">Lançado via Pedido</span>`;
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

export const addTransactionRow = (transaction) => {
    const tr = document.createElement('tr');
    tr.className = `border-b hover:bg-gray-50 ${transaction.status === 'a_receber' ? 'bg-yellow-50' : ''}`;
    tr.dataset.id = transaction.id;
    tr.dataset.date = transaction.date;
    tr.innerHTML = generateTransactionRowHTML(transaction);

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
    
    const placeholder = DOM.transactionsList.querySelector('.transactions-placeholder');
    if (placeholder) placeholder.remove();
};

export const updateTransactionRow = (transaction) => {
    const row = DOM.transactionsList.querySelector(`tr[data-id="${transaction.id}"]`);
    if (row) {
        row.className = `border-b hover:bg-gray-50 ${transaction.status === 'a_receber' ? 'bg-yellow-50' : ''}`;
        row.innerHTML = generateTransactionRowHTML(transaction);
        const oldDate = row.dataset.date;
        if (transaction.date !== oldDate) {
            row.remove();
            addTransactionRow(transaction);
        }
    }
};

export const removeTransactionRow = (transactionId) => {
    const row = DOM.transactionsList.querySelector(`tr[data-id="${transactionId}"]`);
    if (row) {
        row.remove();
    }
    if (DOM.transactionsList.children.length === 0) {
        showTransactionsPlaceholder(false);
    }
};

const showTransactionsPlaceholder = (isSearch) => {
    const message = isSearch ? 'Nenhum lançamento encontrado para a busca.' : 'Nenhum lançamento encontrado para este período.';
    DOM.transactionsList.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500 transactions-placeholder">${message}</td></tr>`;
};

export const renderFinanceKPIs = (allTransactions, userBankBalanceConfig, pendingOrdersValue = 0) => {
    
    // --- 1. LÓGICA DE FILTRO (PARA TABELA E FLUXO) ---
    const filterValue = DOM.periodFilter ? DOM.periodFilter.value : 'thisMonth';
    
    // Reset inteligente: Se mudou o filtro, não zeramos o cache imediatamente para evitar piscar,
    // apenas atualizamos a referência de contexto.
    if (filterValue !== lastContextFilter) {
        lastContextFilter = filterValue;
    }

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
    
    if (!startDate || !endDate) {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const filteredTransactions = allTransactions.filter(t => {
        const transactionDate = new Date(t.date + 'T00:00:00');
        if (startDate && endDate) return transactionDate >= startDate && transactionDate <= endDate;
        return true;
    });

    // --- 2. CÁLCULO DE FLUXO (Respeita o Filtro) ---
    let faturamentoBruto = 0, despesasTotais = 0, valorRecebidoPeriodo = 0;

    filteredTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        if (t.type === 'income') {
            faturamentoBruto += amount;
            if (t.status !== 'a_receber') {
                valorRecebidoPeriodo += amount;
            }
        } else if (t.type === 'expense') {
            despesasTotais += amount;
        }
    });

    const lucroLiquido = valorRecebidoPeriodo - despesasTotais;

    // --- 3. CÁLCULO DE SALDOS (Eterno) ---
    let totalBank = userBankBalanceConfig.initialBalance || 0;
    let totalCash = 0; 
    let totalReceivablesTransaction = 0;

    allTransactions.forEach(t => {
        const amount = parseFloat(t.amount) || 0;
        
        if (t.type === 'income' && t.status === 'a_receber') {
            totalReceivablesTransaction += amount;
            return; 
        }

        if (t.status !== 'a_receber') {
            if (t.source === 'caixa') {
                if (t.type === 'income') totalCash += amount;
                else if (t.type === 'expense') totalCash -= amount;
            } else {
                if (t.type === 'income') totalBank += amount;
                else if (t.type === 'expense') totalBank -= amount;
            }
        }
    });

    // --- 4. BLINDAGEM VISUAL INTELIGENTE (SMART SHIELD v2) ---
    // Objetivo: Não mostrar Zero se tivermos um valor antigo, MAS aceitar atualizações reais.
    
    let incomingOrdersValue = parseFloat(pendingOrdersValue) || 0;
    let finalOrdersValue = incomingOrdersValue;

    if (incomingOrdersValue > 0) {
        // Se veio um valor REAL (ex: 200), atualizamos o cache e a tela.
        // Isso corrige o travamento no valor antigo (190).
        if (incomingOrdersValue !== internalPendingRevenueCache) {
            console.log(`[RENDERER] Atualizando Cache A Receber: R$ ${internalPendingRevenueCache} -> R$ ${incomingOrdersValue}`);
            internalPendingRevenueCache = incomingOrdersValue;
        }
    } else if (incomingOrdersValue === 0) {
        // Se veio ZERO (provável delay de rede) e temos cache, usamos o cache.
        if (internalPendingRevenueCache > 0) {
            // console.warn(`🛡️ [RENDERER] Escudo Ativado: Mantendo R$ ${internalPendingRevenueCache} enquanto carrega.`);
            finalOrdersValue = internalPendingRevenueCache;
        }
        // Se não temos cache (primeira carga real zero), mantém zero.
    }

    const totalReceivables = totalReceivablesTransaction + finalOrdersValue;

    // --- 5. ATUALIZAÇÃO DO DOM ---
    if (DOM.faturamentoBruto) DOM.faturamentoBruto.textContent = formatCurrency(faturamentoBruto);
    if (DOM.despesasTotais) DOM.despesasTotais.textContent = formatCurrency(despesasTotais);
    
    if (DOM.contasAReceber) {
        DOM.contasAReceber.textContent = formatCurrency(totalReceivables);
        // Remove atributo de loading se existir
        if (DOM.contasAReceber.hasAttribute('data-trusted')) DOM.contasAReceber.removeAttribute('data-trusted');
    }
    
    if (DOM.lucroLiquido) DOM.lucroLiquido.textContent = formatCurrency(lucroLiquido);
    
    if (DOM.saldoEmConta) DOM.saldoEmConta.textContent = formatCurrency(totalBank);
    if (DOM.saldoEmCaixa) DOM.saldoEmCaixa.textContent = formatCurrency(totalCash);
    
    // --- 6. CATEGORIAS ---
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
        if (!containerElement) return;
        
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
                    <span class="font-semibold text-gray-900 whitespace-nowrap">${formatCurrency(total)}</span>
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

export const renderFinanceDashboard = (allTransactions, userBankBalanceConfig, pendingOrdersValue = 0) => {
    if (!DOM.periodFilter) return;

    const filteredTransactions = renderFinanceKPIs(allTransactions, userBankBalanceConfig, pendingOrdersValue);

    const searchTerm = DOM.transactionSearchInput.value.toLowerCase();
    const displayTransactions = searchTerm ?
        filteredTransactions.filter(t => t.description.toLowerCase().includes(searchTerm)) :
        filteredTransactions;
        
    DOM.transactionsList.innerHTML = ''; 
    if (displayTransactions.length === 0) {
        showTransactionsPlaceholder(searchTerm.length > 0);
        return;
    }
    
    displayTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    displayTransactions.forEach(addTransactionRow);
};

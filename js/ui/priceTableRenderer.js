// ==========================================================
// MÓDULO PRICE TABLE RENDERER (v4.3.0)
// Responsabilidade: Gerenciar a renderização e lógica
// do modal da Tabela de Preços.
// ============================================================

import { DOM } from './dom.js';

/**
 * Cria uma linha da tabela de preços (HTML ou Elemento)
 */
export const createPriceTableRow = (item, mode) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-gray-50';
    tr.dataset.id = item.id;
    
    const price = (typeof item.price === 'number') ? item.price.toFixed(2) : '0.00';

    if (mode === 'edit') {
        tr.innerHTML = `
            <td class="p-2"><input type="text" class="p-2 border rounded-md w-full price-item-name" value="${item.name || ''}"></td>
            <td class="p-2"><input type="text" class="p-2 border rounded-md w-full price-item-desc" value="${item.description || ''}"></td>
            <td class="p-2"><input type="number" step="0.01" class="p-2 border rounded-md w-full text-right price-item-price" value="${price}"></td>
            <td class="p-2 text-center"><button class="delete-price-item-btn text-red-500 hover:text-red-700 font-bold text-xl">&times;</button></td>
        `;
    } else {
        tr.innerHTML = `
            <td class="p-3 font-medium text-gray-800">${item.name || ''}</td>
            <td class="p-3 text-gray-600">${item.description || ''}</td>
            <td class="p-3 text-right font-semibold text-gray-800">R$ ${price}</td>
        `;
    }
    return tr;
};

/**
 * Adiciona uma linha na tabela de preços
 */
export const addPriceTableRow = (item, mode) => {
    const tableBody = document.getElementById('priceTableBody');
    if (!tableBody) return;
    
    const tr = createPriceTableRow(item, mode);
    tableBody.appendChild(tr);
    
    // Remove placeholder
    const placeholder = tableBody.querySelector('.pricing-placeholder');
    if (placeholder) placeholder.remove();
};

/**
 * Atualiza uma linha da tabela de preços
 */
export const updatePriceTableRow = (item, mode) => {
    const tableBody = document.getElementById('priceTableBody');
    if (!tableBody) return;
    
    const row = tableBody.querySelector(`tr[data-id="${item.id}"]`);
    if (row) {
        const tr = createPriceTableRow(item, mode);
        row.replaceWith(tr);
    }
};

/**
 * Remove uma linha da tabela de preços
 */
export const removePriceTableRow = (itemId) => {
    const tableBody = document.getElementById('priceTableBody');
    if (!tableBody) return;

    const row = tableBody.querySelector(`tr[data-id="${itemId}"]`);
    if (row) {
        row.remove();
    }
    
    // Adiciona placeholder se a tabela ficar vazia
    if (tableBody.children.length === 0 && !DOM.addPriceItemBtn.classList.contains('hidden')) { // Apenas se estiver em modo de edição
         tableBody.innerHTML = `<tr class="pricing-placeholder"><td colspan="4" class="text-center p-6 text-gray-500">Nenhum item. Clique em "Adicionar Item".</td></tr>`;
    }
};

/**
 * Função principal de renderização da tabela de preços (carga inicial)
 */
export const renderPriceTable = (allPricingItems, mode = 'view') => {
    const isEditMode = mode === 'edit';
    DOM.priceTableContainer.innerHTML = ''; 

    let tableHTML = `
        <table class="w-full text-left table-auto">
            <thead>
                <tr class="bg-gray-100">
                    <th class="p-3 text-sm font-semibold text-gray-700 w-1/3">Serviço/Item</th>
                    <th class="p-3 text-sm font-semibold text-gray-700 w-1/2">Descrição</th>
                    <th class="p-3 text-sm font-semibold text-gray-700 text-right">Preço (R$)</th>
                    ${isEditMode ? '<th class="p-3 text-sm font-semibold text-gray-700 text-center w-16">Ação</th>' : ''}
                </tr>
            </thead>
            <tbody id="priceTableBody"></tbody>
        </table>
    `;
    DOM.priceTableContainer.innerHTML = tableHTML;
    const tableBody = document.getElementById('priceTableBody');
    
    if (allPricingItems.length === 0) {
        const colSpan = isEditMode ? 4 : 3;
        const message = isEditMode ? 'Nenhum item. Clique em "Adicionar Item".' : 'Nenhum item na tabela de preços. Clique em "Editar" para adicionar.';
        tableBody.innerHTML = `<tr class="pricing-placeholder"><td colspan="${colSpan}" class="text-center p-6 text-gray-500">${message}</td></tr>`;
    } else {
        // Usa a função granular para construir a lista inicial
        allPricingItems.forEach(item => {
            const tr = createPriceTableRow(item, mode);
            tableBody.appendChild(tr);
        });
    }
    
    DOM.editPriceTableBtn.classList.toggle('hidden', isEditMode);
    DOM.closePriceTableBtn.classList.toggle('hidden', isEditMode);
    DOM.priceTableEditMessage.classList.toggle('hidden', !isEditMode);
    DOM.savePriceTableBtn.classList.toggle('hidden', !isEditMode);
    DOM.cancelPriceTableBtn.classList.toggle('hidden', !isEditMode);
    DOM.addPriceItemBtn.classList.toggle('hidden', !isEditMode);
};

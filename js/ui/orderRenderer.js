// ==========================================================
// MÓDULO ORDER RENDERER (v5.24.0 - SHARE BUTTON ADDED)
// Responsabilidade: Gerenciar a renderização de tudo 
// relacionado a Pedidos: Kanban, Cards, Modal de Detalhes.
// ==========================================================

import { DOM, SIZES_ORDER } from './dom.js';

const getDeliveryCountdown = (deliveryDate) => {
    if (!deliveryDate) return { text: 'Sem data', color: 'gray' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(deliveryDate + 'T00:00:00');
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `Atrasado há ${Math.abs(diffDays)} dia(s)`, color: 'red' };
    if (diffDays === 0) return { text: 'Entrega hoje', color: 'red' };
    if (diffDays === 1) return { text: 'Resta 1 dia', color: 'yellow' };
    if (diffDays <= 3) return { text: `Restam ${diffDays} dias`, color: 'yellow' };
    return { text: `Restam ${diffDays} dias`, color: 'green' };
};

const generateOrderCardHTML = (order, viewType) => {
    let totalValue = 0;
    (order.parts || []).forEach(p => {
        const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
        const specificQty = (p.specifics || []).length;
        const detailedQty = (p.details || []).length;
        const standardSub = standardQty * (p.unitPriceStandard !== undefined ? p.unitPriceStandard : p.unitPrice || 0);
        const specificSub = specificQty * (p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : p.unitPrice || 0);
        const detailedSub = detailedQty * (p.unitPrice || 0);
        totalValue += standardSub + specificSub + detailedSub;
    });
    totalValue -= (order.discount || 0);

    const countdown = getDeliveryCountdown(order.deliveryDate);
    const countdownColorClasses = {
        red: 'bg-red-100 text-red-800',
        yellow: 'bg-yellow-100 text-yellow-800',
        green: 'bg-green-100 text-green-800',
        gray: 'bg-gray-100 text-gray-800'
    };

    const formattedDeliveryDate = order.deliveryDate ?
        new Date(order.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR') :
        'A definir';

    const buttonsHtml = viewType === 'pending' ?
        `<button data-id="${order.id}" class="edit-btn p-2 rounded-md text-gray-500 hover:bg-yellow-100 hover:text-yellow-700 transition-colors" title="Editar">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
        </button>` :
        `<button data-id="${order.id}" class="replicate-btn p-2 rounded-md text-gray-500 hover:bg-green-100 hover:text-green-700 transition-colors" title="Replicar">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" /><path d="M5 3a2 2 0 00-2 2v6a1 1 0 102 0V5h6a1 1 0 100-2H5z" /></svg>
        </button>`;
    
    // Criamos o elemento DOM em vez de string
    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col space-y-3 transform hover:-translate-y-1";
    card.dataset.id = order.id;
    card.dataset.deliveryDate = order.deliveryDate || 'Sem Data'; // Para ordenação no Kanban

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <h3 class="text-lg font-bold text-gray-800">${order.clientName}</h3>
            <span class="status-badge status-${order.orderStatus.replace(/\s/g, '-')}">${order.orderStatus}</span>
        </div>
        
        ${viewType === 'pending' ? `<div class="text-sm font-medium text-gray-500 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span class="ml-1.5">Entrega: <strong>${formattedDeliveryDate}</strong></span>
        </div>` : ''}

        <p class="text-sm text-gray-600">Total: <span class="font-semibold text-blue-600">R$ ${totalValue.toFixed(2)}</span></p>

        ${viewType === 'pending' ? `<div class="text-sm font-semibold py-1 px-2 rounded-full text-center ${countdownColorClasses[countdown.color]}">${countdown.text}</div>` : ''}
        
        <div class="flex space-x-2 items-center pt-3 border-t border-gray-100 mt-auto">
            <button data-id="${order.id}" class="view-btn flex-1 bg-gray-100 text-gray-700 font-semibold py-2 px-3 rounded-lg text-sm hover:bg-gray-200 transition-colors">Detalhes</button>
            ${buttonsHtml}
            ${viewType === 'pending' ? 
            `<button data-id="${order.id}" class="settle-and-deliver-btn p-2 rounded-md text-gray-500 hover:bg-green-100 hover:text-green-700 transition-colors" title="Quitar e Entregar">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
            </button>` : ''}
            <button data-id="${order.id}" class="delete-btn p-2 rounded-md text-gray-500 hover:bg-red-100 hover:text-red-700 transition-colors" title="Excluir">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
            </button>
        </div>
    `;
    return card;
};

/**
 * Prepara o container da lista de pedidos (Kanban ou Grid)
 */
const setupOrderListContainer = (viewType) => {
    DOM.ordersList.innerHTML = ''; // Limpa
    DOM.ordersList.className = ''; // Reseta classes
    if (viewType === 'pending') {
        DOM.ordersList.classList.add('kanban-board');
    } else {
        DOM.ordersList.classList.add('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4', '2xl:grid-cols-5', 'gap-6');
    }
};

/**
 * Procura ou cria uma coluna no Kanban
 * @param {string} dateKey - O 'data-date-key' (ex: '2025-10-31' ou 'Sem Data')
 * @returns {HTMLElement} O elemento do container de cards da coluna
 */
const findOrCreateKanbanColumn = (dateKey) => {
    let column = DOM.ordersList.querySelector(`.kanban-column[data-date-key="${dateKey}"]`);
    if (column) {
        return column.querySelector('.kanban-column-content');
    }

    // Coluna não existe, vamos criar
    const formattedDate = dateKey === 'Sem Data' ?
        'Sem Data de Entrega' :
        new Date(dateKey + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    
    column = document.createElement('div');
    column.className = 'kanban-column';
    column.dataset.dateKey = dateKey;
    column.innerHTML = `
        <h2 class="font-bold text-lg text-gray-700 mb-4 flex items-center">
            ${formattedDate}
            <span class="kanban-column-counter ml-2 text-sm font-medium bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">0</span>
        </h2>
        <div class="kanban-column-content space-y-4"></div>
    `;

    // Insere a coluna na ordem correta
    const allColumns = Array.from(DOM.ordersList.querySelectorAll('.kanban-column'));
    let inserted = false;
    if (dateKey !== 'Sem Data') {
        const newDate = new Date(dateKey + 'T00:00:00');
        for (const existingCol of allColumns) {
            const existingDateKey = existingCol.dataset.dateKey;
            if (existingDateKey !== 'Sem Data' && newDate < new Date(existingDateKey + 'T00:00:00')) {
                DOM.ordersList.insertBefore(column, existingCol);
                inserted = true;
                break;
            }
        }
    }
    if (!inserted) {
        // Se for "Sem Data" ou mais recente que todas, adiciona no final
        DOM.ordersList.appendChild(column);
    }
    
    return column.querySelector('.kanban-column-content');
};

/**
 * Atualiza o contador de uma coluna Kanban
 * @param {HTMLElement} columnContent - O elemento '.kanban-column-content'
 */
const updateKanbanColumnCounter = (columnContent) => {
    const column = columnContent.closest('.kanban-column');
    if (!column) return;
    
    const counter = column.querySelector('.kanban-column-counter');
    const count = columnContent.children.length;
    counter.textContent = count;
    
    // Se a coluna ficar vazia, remove-a
    if (count === 0) {
        column.remove();
    }
};

/**
 * Adiciona um card de pedido à UI
 */
export const addOrderCard = (order, viewType) => {
    const card = generateOrderCardHTML(order, viewType);
    
    if (viewType === 'pending') {
        const dateKey = order.deliveryDate || 'Sem Data';
        const columnContent = findOrCreateKanbanColumn(dateKey);
        // Insere o card ordenado por nome dentro da coluna
        const cardsInColumn = Array.from(columnContent.querySelectorAll('.bg-white'));
        let inserted = false;
        for (const existingCard of cardsInColumn) {
            if (order.clientName.localeCompare(existingCard.querySelector('h3').textContent) < 0) {
                columnContent.insertBefore(card, existingCard);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            columnContent.appendChild(card);
        }
        updateKanbanColumnCounter(columnContent);
    } else {
        // Na 'delivered' view (grid), insere ordenado por data (mais novo primeiro)
        const allCards = Array.from(DOM.ordersList.querySelectorAll('.bg-white'));
        let inserted = false;
        const orderDate = new Date(order.deliveryDate || 0);
        for (const existingCard of allCards) {
            const existingDate = new Date(existingCard.dataset.deliveryDate || 0);
            if (orderDate > existingDate) {
                DOM.ordersList.insertBefore(card, existingCard);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            DOM.ordersList.appendChild(card);
        }
    }
    
    // Remove o "Nenhum pedido" se for o primeiro
    const placeholder = DOM.ordersList.querySelector('.orders-placeholder');
    if (placeholder) placeholder.remove();
};

/**
 * Atualiza um card de pedido existente na UI
 */
export const updateOrderCard = (order, viewType) => {
    const existingCard = DOM.ordersList.querySelector(`[data-id="${order.id}"]`);
    if (!existingCard) {
        // Se não existia (ex: mudou de 'Entregue' para 'Pendente'), apenas adiciona
        addOrderCard(order, viewType);
        return;
    }

    const oldColumnContent = existingCard.closest('.kanban-column-content');
    const newCard = generateOrderCardHTML(order, viewType);

    // Substitui o card antigo pelo novo
    existingCard.replaceWith(newCard);
    
    if (viewType === 'pending') {
        const newDateKey = order.deliveryDate || 'Sem Data';
        const newColumnContent = findOrCreateKanbanColumn(newDateKey);
        
        // Se a coluna for diferente, move o card
        if (newColumnContent !== oldColumnContent) {
            newColumnContent.appendChild(newCard); // Adiciona na nova coluna
            if (oldColumnContent) {
                updateKanbanColumnCounter(oldColumnContent); // Atualiza contador da antiga
            }
        }
        updateKanbanColumnCounter(newColumnContent); // Atualiza contador da nova
    }
};

/**
 * Remove um card de pedido da UI
 */
export const removeOrderCard = (orderId) => {
    const card = DOM.ordersList.querySelector(`[data-id="${orderId}"]`);
    if (card) {
        const columnContent = card.closest('.kanban-column-content');
        card.remove();
        if (columnContent) {
            updateKanbanColumnCounter(columnContent); // Atualiza o contador da coluna
        }
    }
    
    // Se a lista estiver vazia, mostra a mensagem
    if (DOM.ordersList.children.length === 0) {
        showOrdersPlaceholder(DOM.ordersList.classList.contains('kanban-board') ? 'pending' : 'delivered');
    }
};

/**
 * Exibe a mensagem de "Nenhum pedido"
 */
const showOrdersPlaceholder = (viewType) => {
    const message = viewType === 'pending' ? 'Nenhum pedido pendente.' : 'Nenhum pedido entregue encontrado.';
    const colSpanClass = viewType === 'pending' ? 'w-full' : 'col-span-full';
    DOM.ordersList.innerHTML = `<div class="${colSpanClass} text-center py-10 text-gray-500 orders-placeholder">${message}</div>`;
};

/**
 * Função principal de renderização inicial de pedidos
 */
export const renderOrders = (allOrders, currentOrdersView) => {
    DOM.loadingIndicator.style.display = 'none';
    setupOrderListContainer(currentOrdersView);
    
    let ordersToRender;
    
    if (currentOrdersView === 'pending') {
        ordersToRender = allOrders.filter(o => o.orderStatus !== 'Entregue');
        // Ordena por data e depois por nome
        ordersToRender.sort((a, b) => {
            const dateA = a.deliveryDate || '9999-12-31';
            const dateB = b.deliveryDate || '9999-12-31';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return a.clientName.localeCompare(b.clientName);
        });
    } else { 
        ordersToRender = allOrders.filter(o => o.orderStatus === 'Entregue');
        
        // v4.2.4: Ordena por data (mais novos primeiro)
        ordersToRender.sort((a, b) => {
            const dateA = a.deliveryDate || '0000-01-01';
            const dateB = b.deliveryDate || '0000-01-01';
            return dateB.localeCompare(dateA);
        });
    }

    if (ordersToRender.length === 0) {
        showOrdersPlaceholder(currentOrdersView);
        return;
    }
    
    // Chama a função granular para construir a UI inicial
    ordersToRender.forEach(order => addOrderCard(order, currentOrdersView));
};

const sortSizes = (sizesObject) => {
    return Object.entries(sizesObject).sort((a, b) => {
        const indexA = SIZES_ORDER.indexOf(a[0]);
        const indexB = SIZES_ORDER.indexOf(b[0]);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });
};

export const viewOrder = (order) => {
    if (!order) return;

    let subTotal = 0;
    let partsHtml = (order.parts || []).map(p => {
        const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
        const specificQty = (p.specifics || []).length;
        const detailedQty = (p.details || []).length;

        const standardSub = standardQty * (p.unitPriceStandard !== undefined ? p.unitPriceStandard : p.unitPrice || 0);
        const specificSub = specificQty * (p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : p.unitPrice || 0);
        const detailedSub = detailedQty * (p.unitPrice || 0);

        const partSubtotal = standardSub + specificSub + detailedSub;
        subTotal += partSubtotal;

        let itemsDetailHtml = '';
        
        if (p.partInputType === 'comum') {
            let standardSizesHtml = '';
            if (p.sizes && Object.keys(p.sizes).length > 0) {
                standardSizesHtml = Object.entries(p.sizes).map(([cat, sizes]) =>
                    `<strong>${cat}:</strong> ${sortSizes(sizes).map(([size, qty]) => `${size}(${qty})`).join(', ')}`
                ).join('<br>');
            }
            
            let specificSizesHtml = '';
            if (p.specifics && p.specifics.length > 0) {
                specificSizesHtml = '<br><strong>Específicos:</strong><br>' + p.specifics.map(s => 
                    `&nbsp;&nbsp;- L: ${s.width || 'N/A'}, A: ${s.height || 'N/A'} (${s.observation || 'Sem obs.'})`
                ).join('<br>');
            }

            if (standardSizesHtml || specificSizesHtml) {
                itemsDetailHtml = `<div class="text-xs text-gray-600 pl-2 mt-1">${standardSizesHtml}${specificSizesHtml}</div>`;
            }

        } else if (p.partInputType === 'detalhado' && p.details && p.details.length > 0) {
            itemsDetailHtml = '<div class="text-xs text-gray-600 pl-2 mt-1">' + p.details.map(d => `${d.name || ''} - ${d.size || ''} - ${d.number || ''}`).join('<br>') + '</div>';
        }

        let unitPriceHtml = '';
        if(p.partInputType === 'comum') {
            if(standardQty > 0) unitPriceHtml += `R$ ${(p.unitPriceStandard !== undefined ? p.unitPriceStandard : p.unitPrice || 0).toFixed(2)} (Padrão)<br>`;
            if(specificQty > 0) unitPriceHtml += `R$ ${(p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : p.unitPrice || 0).toFixed(2)} (Específico)`;
        } else {
            unitPriceHtml = `R$ ${(p.unitPrice || 0).toFixed(2)}`;
        }

        return `
            <tr>
                <td class="py-1 px-2 border">${p.type}${itemsDetailHtml}</td>
                <td class="py-1 px-2 border">${p.material}</td>
                <td class="py-1 px-2 border">${p.colorMain}</td>
                <td class="py-1 px-2 border text-center">${standardQty + specificQty + detailedQty}</td>
                <td class="py-1 px-2 border text-right">${unitPriceHtml.trim()}</td>
                <td class="py-1 px-2 border text-right font-semibold">R$ ${partSubtotal.toFixed(2)}</td>
            </tr>`;
    }).join('');

    const discount = order.discount || 0;
    const grandTotal = subTotal - discount;
    const remaining = grandTotal - (order.downPayment || 0);
    
    // v5.0: Adiciona detalhes do adiantamento
    const paymentFinSourceText = order.paymentFinSource === 'caixa' ? 'Caixa' : (order.paymentFinSource === 'banco' ? 'Banco' : 'N/A');
    const paymentFinStatusText = order.paymentFinStatus === 'a_receber' ? 'A Receber' : 'Recebido';
    const downPaymentDateText = order.downPaymentDate ? new Date(order.downPaymentDate + 'T00:00:00').toLocaleDateString('pt-br') : 'N/A';

    const modalContent = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div id="printable-details" class="p-8 pb-8 overflow-y-auto">
                <h2 class="text-2xl font-bold mb-4">Detalhes do Pedido - ${order.clientName}</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
                    <div><strong>Telefone:</strong> ${order.clientPhone || 'N/A'}</div>
                    <div><strong>Status:</strong> <span class="font-semibold">${order.orderStatus}</span></div>
                    <div><strong>Data do Pedido:</strong> ${order.orderDate ? new Date(order.orderDate + 'T00:00:00').toLocaleDateString('pt-br') : 'N/A'}</div>
                    <div><strong>Data de Entrega:</strong> ${order.deliveryDate ? new Date(order.deliveryDate + 'T00:00:00').toLocaleDateString('pt-br') : 'N/A'}</div>
                </div>
                <h3 class="font-bold text-lg mt-4">Peças</h3>
                <table class="w-full text-left text-sm mt-2">
                    <thead><tr class="bg-gray-100"><th class="px-2 py-1">Tipo/Detalhes</th><th class="px-2 py-1">Material</th><th class="px-2 py-1">Cor</th><th class="px-2 py-1 text-center">Qtd</th><th class="px-2 py-1 text-right">V. Un.</th><th class="px-2 py-1 text-right">Subtotal</th></tr></thead>
                    <tbody>${partsHtml}</tbody>
                </table>
                <h3 class="font-bold text-lg mt-4">Observação Geral</h3>
                <p class="text-sm p-2 border rounded-md mt-2 min-h-[40px]">${order.generalObservation || 'Nenhuma.'}</p>
                
                <h3 class="font-bold text-lg mt-4">Financeiro</h3>
                <div class="grid grid-cols-2 gap-x-8 mt-2 border-t pt-4 text-sm">
                    <div><strong>Valor Bruto:</strong> R$ ${subTotal.toFixed(2)}</div>
                    <div><strong>Desconto:</strong> R$ ${discount.toFixed(2)}</div>
                    <div class="font-bold text-blue-600 text-lg"><strong>Valor Final:</strong> R$ ${grandTotal.toFixed(2)}</div>
                    <div class="font-bold text-red-600 text-lg"><strong>Resta Pagar:</strong> R$ ${remaining.toFixed(2)}</div>
                </div>
                
                <div class="grid grid-cols-2 gap-x-8 mt-2 border-t pt-4 text-sm">
                    <div><strong>Valor Pago (Adiant.):</strong> R$ ${(order.downPayment || 0).toFixed(2)}</div>
                    <div><strong>Forma de Pagamento:</strong> ${order.paymentMethod || 'N/A'}</div>
                    <div><strong>Data do Pagamento:</strong> ${downPaymentDateText}</div>
                    <div><strong>Status do Pagamento:</strong> ${paymentFinStatusText}</div>
                    <div><strong>Origem do Pagamento:</strong> ${paymentFinSourceText}</div>
                </div>
                
                <div id="mockupContainerView" class="pt-4 border-t mt-4">
                    <h3 class="font-bold text-lg">Arquivos</h3>
                    <div class="flex flex-wrap gap-4 mt-2">
                        ${(order.mockupUrls || []).map(url => `<a href="${url}" target="_blank"><img src="${url}" class="w-32 h-32 object-cover border rounded-md mockup-image"></a>`).join('') || 'Nenhum arquivo.'}
                    </div>
                </div>
            </div>
            <div class="p-4 bg-gray-100 border-t flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4">
                <button id="sharePdfBtn" data-id="${order.id}" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Compartilhar
                </button>
                <button id="comprehensivePdfBtn" data-name="${order.clientName}" data-id="${order.id}" class="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">Gerar PDF do pedido</button>
                <button id="closeViewBtn" class="bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">Fechar</button>
            </div>
        </div>`;
    DOM.viewModal.innerHTML = modalContent;
    DOM.viewModal.classList.remove('hidden');
};

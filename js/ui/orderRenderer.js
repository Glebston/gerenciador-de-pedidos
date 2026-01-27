// js/ui/orderRenderer.js
// ==========================================================
// MÓDULO ORDER RENDERER (v5.35.0 - Clean UI Update)
// Responsabilidade: Renderizar pedidos e gerenciar links PRO.
// Status: ATUALIZADO (Remoção de Botão Externo Quebrado)
// ==========================================================

import { DOM, SIZES_ORDER } from './dom.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Importação centralizada para garantir consistência de sessão
import { db, auth } from '../firebaseConfig.js'; 

// --- CONTROLE DE ESTADO GLOBAL DO MÓDULO ---

// Listener Global Único: Fecha menus ao clicar fora
const closeMenusOnClickOutside = (e) => {
    if (!e.target.closest('button[id$="Btn"]') && !e.target.closest('div[role="menu"]')) {
        const allMenus = document.querySelectorAll('[id$="Menu"]');
        allMenus.forEach(menu => {
            if (!menu.classList.contains('hidden')) {
                menu.classList.add('hidden');
            }
        });
    }
};
document.addEventListener('click', closeMenusOnClickOutside);


// --- FUNÇÕES AUXILIARES ---

const getUserPlan = () => {
    return localStorage.getItem('userPlan') || 'essencial';
};

// [ATUALIZADO] Agora aceita 'status' para verificar se está finalizado
const getDeliveryCountdown = (deliveryDate, status) => {
    // 1. Prioridade Alta: Se já está pronto, avisa que falta retirar (ignora data)
    if (status === 'Finalizado') {
        return { text: '📦 Aguardando retirada', color: 'orange' };
    }

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

export const generateOrderCardHTML = (order, viewType) => {
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

    // [ATUALIZADO] Passamos o status para a lógica de countdown
    const countdown = getDeliveryCountdown(order.deliveryDate, order.orderStatus);
    
    const countdownColorClasses = {
        red: 'bg-red-100 text-red-800',
        yellow: 'bg-yellow-100 text-yellow-800',
        green: 'bg-green-100 text-green-800',
        gray: 'bg-gray-100 text-gray-800',
        orange: 'bg-orange-100 text-orange-800' // [NOVO] Estilo para 'Aguardando retirada'
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
    
    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col space-y-3 transform hover:-translate-y-1";
    card.dataset.id = order.id;
    card.dataset.deliveryDate = order.deliveryDate || 'Sem Data';

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

// --- GERENCIAMENTO DE LISTA (KANBAN/GRID) ---

const setupOrderListContainer = (viewType) => {
    DOM.ordersList.innerHTML = '';
    DOM.ordersList.className = '';
    if (viewType === 'pending') {
        DOM.ordersList.classList.add('kanban-board');
    } else {
        DOM.ordersList.classList.add('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4', '2xl:grid-cols-5', 'gap-6');
    }
};

const findOrCreateKanbanColumn = (dateKey) => {
    let column = DOM.ordersList.querySelector(`.kanban-column[data-date-key="${dateKey}"]`);
    if (column) {
        return column.querySelector('.kanban-column-content');
    }

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
        DOM.ordersList.appendChild(column);
    }
    
    return column.querySelector('.kanban-column-content');
};

const updateKanbanColumnCounter = (columnContent) => {
    const column = columnContent.closest('.kanban-column');
    if (!column) return;
    
    const counter = column.querySelector('.kanban-column-counter');
    const count = columnContent.children.length;
    counter.textContent = count;
    
    if (count === 0) {
        column.remove();
    }
};

// --- CRUD DE CARDS ---

export const addOrderCard = (order, viewType) => {
    const card = generateOrderCardHTML(order, viewType);
    
    if (viewType === 'pending') {
        const dateKey = order.deliveryDate || 'Sem Data';
        const columnContent = findOrCreateKanbanColumn(dateKey);
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
    
    const placeholder = DOM.ordersList.querySelector('.orders-placeholder');
    if (placeholder) placeholder.remove();
};

export const updateOrderCard = (order, viewType) => {
    const existingCard = DOM.ordersList.querySelector(`[data-id="${order.id}"]`);
    if (!existingCard) {
        addOrderCard(order, viewType);
        return;
    }

    const oldColumnContent = existingCard.closest('.kanban-column-content');
    const newCard = generateOrderCardHTML(order, viewType);

    existingCard.replaceWith(newCard);
    
    if (viewType === 'pending') {
        const newDateKey = order.deliveryDate || 'Sem Data';
        const newColumnContent = findOrCreateKanbanColumn(newDateKey);
        
        if (newColumnContent !== oldColumnContent) {
            newColumnContent.appendChild(newCard);
            if (oldColumnContent) {
                updateKanbanColumnCounter(oldColumnContent);
            }
        }
        updateKanbanColumnCounter(newColumnContent);
    }
};

export const removeOrderCard = (orderId) => {
    const card = DOM.ordersList.querySelector(`[data-id="${orderId}"]`);
    if (card) {
        const columnContent = card.closest('.kanban-column-content');
        card.remove();
        if (columnContent) {
            updateKanbanColumnCounter(columnContent);
        }
    }
    
    if (DOM.ordersList.children.length === 0) {
        showOrdersPlaceholder(DOM.ordersList.classList.contains('kanban-board') ? 'pending' : 'delivered');
    }
};

const showOrdersPlaceholder = (viewType) => {
    const message = viewType === 'pending' ? 'Nenhum pedido pendente.' : 'Nenhum pedido entregue encontrado.';
    const colSpanClass = viewType === 'pending' ? 'w-full' : 'col-span-full';
    DOM.ordersList.innerHTML = `<div class="${colSpanClass} text-center py-10 text-gray-500 orders-placeholder">${message}</div>`;
};

export const renderOrders = (allOrders, currentOrdersView) => {
    DOM.loadingIndicator.style.display = 'none';
    setupOrderListContainer(currentOrdersView);
    
    let ordersToRender;
    
    if (currentOrdersView === 'pending') {
        ordersToRender = allOrders.filter(o => o.orderStatus !== 'Entregue');
        ordersToRender.sort((a, b) => {
            const dateA = a.deliveryDate || '9999-12-31';
            const dateB = b.deliveryDate || '9999-12-31';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return a.clientName.localeCompare(b.clientName);
        });
    } else { 
        ordersToRender = allOrders.filter(o => o.orderStatus === 'Entregue');
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

// --- VISUALIZAÇÃO DETALHADA (MODAL) ---

export const viewOrder = (order) => {
    if (!order) return;
    
    const currentPlan = getUserPlan(); 
    const isPro = currentPlan === 'pro'; // Verificação técnica segura

    let subTotal = 0;
    
    // ATUALIZAÇÃO: Map agora inclui index para Deep Linking
    let partsHtml = (order.parts || []).map((p, index) => {
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

        // --- LÓGICA DO BOTÃO DE LINK ESPECÍFICO (DEEP LINK - MANTIDO) ---
        let partLinkBtn = '';
        if (isPro && p.partInputType === 'detalhado') {
            partLinkBtn = `
            <button 
                data-part-index="${index}" 
                class="generate-part-link-btn ml-2 text-indigo-600 hover:text-indigo-800 transition-colors p-1 rounded hover:bg-indigo-50" 
                title="Copiar Link de Preenchimento para ${p.type}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
            </button>`;
        }
        // -----------------------------------------------------

        return `
            <tr>
                <td class="py-1 px-2 border">
                    <div class="flex items-center justify-between">
                        <span>${p.type}</span>
                        ${partLinkBtn}
                    </div>
                    ${itemsDetailHtml}
                </td>
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
    
    // --- LÓGICA HÍBRIDA (LEGADO + NOVO SISTEMA DE LISTA) ---
    let paymentSourceDisplay = 'N/A';
    let paymentDateDisplay = 'N/A';

    // 1. Verifica se existe a nova lista de pagamentos
    if (order.payments && Array.isArray(order.payments) && order.payments.length > 0) {
        // Gera resumo das fontes: Ex: "Caixa (R$ 100), Banco (R$ 50)"
        const sources = order.payments.map(p => {
            const src = p.source === 'caixa' ? 'Caixa' : (p.source === 'banco' ? 'Banco' : p.source);
            return `${src} (R$ ${parseFloat(p.amount).toFixed(2)})`;
        });
        paymentSourceDisplay = sources.join(', ');

        // Pega a data do último pagamento para exibir
        const lastPayment = order.payments[order.payments.length - 1];
        if (lastPayment && lastPayment.date) {
            paymentDateDisplay = new Date(lastPayment.date + 'T00:00:00').toLocaleDateString('pt-br');
            if (order.payments.length > 1) paymentDateDisplay += ' (Múltiplas)';
        }
    } 
    // 2. Fallback: Usa o sistema antigo se não houver lista
    else {
        paymentSourceDisplay = order.paymentFinSource === 'caixa' ? 'Caixa' : (order.paymentFinSource === 'banco' ? 'Banco' : 'N/A');
        if (order.downPaymentDate) {
            paymentDateDisplay = new Date(order.downPaymentDate + 'T00:00:00').toLocaleDateString('pt-br');
        }
    }

    const paymentFinStatusText = order.paymentFinStatus === 'a_receber' ? 'A Receber' : 'Recebido';
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
                    <div><strong>Data do Pagamento:</strong> ${paymentDateDisplay}</div>
                    <div><strong>Status do Pagamento:</strong> ${paymentFinStatusText}</div>
                    <div><strong>Origem do Pagamento:</strong> ${paymentSourceDisplay}</div>
                </div>
                
                <div id="mockupContainerView" class="pt-4 border-t mt-4">
                    <h3 class="font-bold text-lg">Arquivos</h3>
                    <div class="flex flex-wrap gap-4 mt-2">
                        ${(order.mockupUrls || []).map(url => `<a href="${url}" target="_blank"><img src="${url}" class="w-32 h-32 object-cover border rounded-md mockup-image"></a>`).join('') || 'Nenhum arquivo.'}
                    </div>
                </div>
            </div>
            
            <div class="p-4 bg-gray-100 border-t flex flex-col sm:flex-row justify-end items-center space-y-2 sm:space-y-0 sm:space-x-4">
                
                <div class="relative inline-block text-left">
                    <button id="whatsappMenuBtn" type="button" class="bg-green-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-600 transition-colors shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                        </svg>
                        WhatsApp
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <div id="whatsappMenu" class="hidden absolute right-0 bottom-full mb-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden">
                        <div class="py-1" role="menu">
                            <button id="btnOpenWhatsAppAction" data-id="${order.id}" class="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100">
                                <svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654z"/>
                                </svg>
                                Abrir Conversa
                            </button>
                            <button id="btnCopyLinkAction" data-id="${order.id}" class="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                                Copiar Link do Pedido
                            </button>
                        </div>
                    </div>
                </div>

                <div class="relative inline-block text-left">
                    <button id="documentsBtn" type="button" class="bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Documentos
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <div id="documentsMenu" class="hidden absolute right-0 bottom-full mb-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden">
                        <div class="py-1" role="menu">
                            <button id="comprehensivePdfBtn" data-name="${order.clientName}" data-id="${order.id}" class="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100">
                                <svg class="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                PDF do Pedido
                            </button>
                            <button id="productionPdfBtn" data-id="${order.id}" class="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                                <svg class="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                OS de Produção
                            </button>
                        </div>
                    </div>
                </div>

                <button id="closeViewBtn" class="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors shadow-sm">Fechar</button>
            </div>
        </div>`;
    DOM.viewModal.innerHTML = modalContent;
    DOM.viewModal.classList.remove('hidden');

    // ============================================
    // 1. CONFIGURAÇÃO DOS MENUS (UI)
    // ============================================
    const setupDropdown = (btnId, menuId) => {
        const btn = document.getElementById(btnId);
        const menu = document.getElementById(menuId);
        
        if (btn && menu) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Fecha outros menus abertos
                document.querySelectorAll('[id$="Menu"]').forEach(m => {
                    if (m.id !== menuId) m.classList.add('hidden');
                });
                menu.classList.toggle('hidden');
            });
        }
    };

    setupDropdown('whatsappMenuBtn', 'whatsappMenu');
    setupDropdown('documentsBtn', 'documentsMenu');
    // REMOVIDO: Setup do botão Externo, pois ele foi retirado

    // Botão Fechar Modal
    const btnClose = document.getElementById('closeViewBtn');
    if (btnClose) {
        btnClose.addEventListener('click', () => {
             DOM.viewModal.classList.add('hidden');
        });
    }

    // ============================================
    // LÓGICA DE GERAÇÃO DE LINK (Reutilizável)
    // ============================================
    const handleGenerateLink = async (targetBtn, partIndex = null) => {
        const originalContent = targetBtn.innerHTML;
        // Feedback visual simples
        targetBtn.innerHTML = partIndex !== null ? '⏳' : '⏳ Gerando...'; 

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) throw new Error("Usuário não autenticado.");

            const userMappingRef = doc(db, "user_mappings", currentUser.uid);
            const userMappingSnap = await getDoc(userMappingRef);

            let companyId = null;
            if (userMappingSnap.exists()) {
                companyId = userMappingSnap.data().companyId;
            } else {
                companyId = currentUser.uid;
            }

            if (!companyId) throw new Error("ID da Empresa não encontrado.");

            const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            const baseUrl = window.location.origin + path;
            
            // --- DEEP LINK LOGIC ---
            let link = `${baseUrl}/preencher.html?cid=${companyId}&oid=${order.id}`;
            if (partIndex !== null) {
                link += `&partIndex=${partIndex}`;
            }

            await navigator.clipboard.writeText(link);
            
            // Feedback de Sucesso
            if (partIndex !== null) {
                // Para o botão pequeno (ícone)
                targetBtn.innerHTML = `<svg class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
            } else {
                // Para o botão grande (menu)
                targetBtn.innerHTML = `<svg class="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg> Link Copiado!`;
                targetBtn.classList.add('bg-green-50');
            }
            
            setTimeout(() => {
                targetBtn.innerHTML = originalContent;
                if (partIndex === null) targetBtn.classList.remove('bg-green-50');
            }, 3000);

        } catch (err) {
            console.error('Erro na geração do link:', err);
            alert(`Erro: ${err.message}`);
            targetBtn.innerHTML = originalContent;
        }
    };

    // 2. Listener para o botão Geral (Rodapé) - REMOVIDO
    // O botão generateFillLinkBtn não existe mais no HTML do rodapé.

    // 3. Listeners para os botões Específicos (Por Peça - Deep Link) - MANTIDO
    document.querySelectorAll('.generate-part-link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que o clique afete a linha da tabela se houver listener lá
            const index = btn.dataset.partIndex;
            handleGenerateLink(btn, index);
        });
    });
};

// js/ui/formHandler.js
// ==========================================================
// MÓDULO FORM HANDLER (v5.8.0 - Reorder Support)
// Responsabilidade: Gerenciar toda a lógica interna do
// modal de Pedidos, incluindo lista dinâmica e Reordenamento.
// ==========================================================

import { DOM } from './dom.js';
import { updateSourceSelectionUI } from './helpers.js';

// Estado local para gerenciar a lista de pagamentos antes de salvar
let currentPaymentsList = [];

// API para o Listener pegar os dados
export const getPaymentList = () => [...currentPaymentsList];
export const setPaymentList = (list) => { 
    currentPaymentsList = list || []; 
    renderPaymentManager();
    updateFinancials();
};

const renderPaymentManager = () => {
    // 1. Identifica ou Cria o Container da Lista
    let managerContainer = document.getElementById('payment-list-manager');
    
    // Se não existir, injetamos logo após o container de inputs original (para não quebrar layout HTML)
    if (!managerContainer) {
        // Escondemos os inputs originais visualmente (mas mantemos no DOM por segurança)
        if (DOM.downPayment) DOM.downPayment.parentElement.style.display = 'none';
        if (DOM.downPaymentDate) DOM.downPaymentDate.parentElement.style.display = 'none';
        if (DOM.downPaymentSourceContainer) DOM.downPaymentSourceContainer.style.display = 'none';
        
        // O container "Pai" onde tudo vive (Adiantamento / Sinal)
        const parentSection = DOM.downPayment ? DOM.downPayment.closest('.border') : null;
        
        if (parentSection) {
            managerContainer = document.createElement('div');
            managerContainer.id = 'payment-list-manager';
            managerContainer.className = 'mt-2 space-y-3';
            parentSection.appendChild(managerContainer);
        }
    }

    if (!managerContainer) return; // Fallback se o HTML for muito diferente

    // 2. Calcula Totais
    const totalPaid = currentPaymentsList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

    // 3. Renderiza o HTML da Lista
    managerContainer.innerHTML = `
        <div class="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div class="flex flex-wrap gap-2 items-end mb-3 border-b pb-3 border-gray-200">
                <div class="flex-1 min-w-[120px]">
                    <label class="block text-xs font-bold text-gray-500 mb-1">Valor (R$)</label>
                    <input type="number" id="new-pay-amount" class="w-full p-2 border rounded text-sm" placeholder="0.00">
                </div>
                <div class="w-[130px]">
                    <label class="block text-xs font-bold text-gray-500 mb-1">Data</label>
                    <input type="date" id="new-pay-date" class="w-full p-2 border rounded text-sm" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="w-[100px]">
                    <label class="block text-xs font-bold text-gray-500 mb-1">Conta</label>
                    <select id="new-pay-source" class="w-full p-2 border rounded text-sm bg-white">
                        <option value="banco">Banco</option>
                        <option value="caixa">Caixa</option>
                    </select>
                </div>
                <button type="button" id="btn-add-payment" class="bg-green-500 text-white p-2 rounded hover:bg-green-600 transition-colors h-[38px] w-[38px] flex items-center justify-center" title="Adicionar Pagamento">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                </button>
            </div>

            <div class="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                ${currentPaymentsList.length === 0 ? '<p class="text-xs text-gray-400 text-center italic py-2">Nenhum pagamento lançado.</p>' : ''}
                ${currentPaymentsList.map((p, index) => `
                    <div class="flex justify-between items-center bg-white p-2 rounded border border-gray-100 shadow-sm text-sm">
                        <div class="flex items-center space-x-3">
                            <span class="font-mono text-gray-500 text-xs">${new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            <span class="font-bold text-gray-700">R$ ${parseFloat(p.amount).toFixed(2)}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full ${p.source === 'banco' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">${p.source === 'banco' ? 'Banco' : 'Caixa'}</span>
                        </div>
                        <button type="button" class="text-red-400 hover:text-red-600 p-1 btn-remove-payment" data-index="${index}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                        </button>
                    </div>
                `).join('')}
            </div>
            
            <div class="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center">
                <span class="text-xs font-bold text-gray-500 uppercase">Total Pago</span>
                <span class="text-lg font-bold text-green-600">R$ ${totalPaid.toFixed(2)}</span>
            </div>
        </div>
    `;

    // 4. Listeners da Lista (Adicionar e Remover)
    const addBtn = managerContainer.querySelector('#btn-add-payment');
    const amountInput = managerContainer.querySelector('#new-pay-amount');
    const dateInput = managerContainer.querySelector('#new-pay-date');
    const sourceInput = managerContainer.querySelector('#new-pay-source');

    addBtn.addEventListener('click', () => {
        const amount = parseFloat(amountInput.value);
        if (!amount || amount <= 0) return alert('Digite um valor válido.');
        
        currentPaymentsList.push({
            id: null, // Novo pagamento não tem ID ainda
            amount: amount,
            date: dateInput.value,
            source: sourceInput.value,
            status: 'pago' // Assumimos pago ao lançar aqui
        });
        
        renderPaymentManager();
        updateFinancials();
    });

    managerContainer.querySelectorAll('.btn-remove-payment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            currentPaymentsList.splice(index, 1);
            renderPaymentManager();
            updateFinancials();
        });
    });
};

export const updateFinancials = () => {
    let subtotal = 0;
    DOM.financialsContainer.querySelectorAll('.financial-item').forEach(item => {
        const quantity = parseFloat(item.querySelector('.financial-quantity').value) || 0;
        const price = parseFloat(item.querySelector('.financial-price').value) || 0;
        const itemSubtotal = quantity * price;
        item.querySelector('.financial-subtotal').textContent = `R$ ${itemSubtotal.toFixed(2)}`;
        subtotal += itemSubtotal;
    });

    const discount = parseFloat(DOM.discount.value) || 0;
    const grandTotal = Math.max(0, subtotal - discount);
    
    // v5.0: Agora pega do array, não do input antigo
    const downPayment = currentPaymentsList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

    // Sincroniza o input antigo para compatibilidade, se necessário
    if (DOM.downPayment) DOM.downPayment.value = downPayment > 0 ? downPayment : '';

    DOM.grandTotal.textContent = `R$ ${grandTotal.toFixed(2)}`;
    DOM.remainingTotal.textContent = `R$ ${(grandTotal - downPayment).toFixed(2)}`;
};

const createFinancialRow = (partId, name, quantity, priceGroup) => {
    const finTpl = document.getElementById('financialRowTemplate').content.cloneNode(true);
    const finItem = finTpl.querySelector('.financial-item');
    finItem.dataset.partId = partId;
    finItem.dataset.priceGroup = priceGroup;

    finItem.querySelector('.financial-part-name > span:first-child').textContent = name;
    const label = priceGroup === 'standard' ? '(Padrão)' : priceGroup === 'specific' ? '(Específico)' : '';
    finItem.querySelector('.price-group-label').textContent = label;

    finItem.querySelector('.financial-quantity').value = quantity;
    finItem.querySelector('.financial-price').addEventListener('input', updateFinancials);

    return finItem;
};

export const renderFinancialSection = () => {
    const existingPrices = new Map();
    DOM.financialsContainer.querySelectorAll('.financial-item').forEach(item => {
        const partId = item.dataset.partId;
        const priceGroup = item.dataset.priceGroup;
        const price = item.querySelector('.financial-price').value;
        if (price) { 
            existingPrices.set(`${partId}-${priceGroup}`, price);
        }
    });

    DOM.financialsContainer.innerHTML = '';
    
    DOM.partsContainer.querySelectorAll('.part-item').forEach(partItem => {
        const partId = partItem.dataset.partId;
        const partName = partItem.querySelector('.part-type').value || `Peça ${partId}`;
        const partType = partItem.dataset.partType;

        if (partType === 'comum') {
            let standardQty = 0;
            partItem.querySelectorAll('.size-input').forEach(input => {
                standardQty += parseInt(input.value) || 0;
            });
            const specificQty = partItem.querySelectorAll('.specific-size-row').length;

            if (standardQty > 0) {
                const finRow = createFinancialRow(partId, partName, standardQty, 'standard');
                const key = `${partId}-standard`;
                if (existingPrices.has(key)) finRow.querySelector('.financial-price').value = existingPrices.get(key);
                DOM.financialsContainer.appendChild(finRow);
            }
            if (specificQty > 0) {
                const finRow = createFinancialRow(partId, partName, specificQty, 'specific');
                const key = `${partId}-specific`;
                if (existingPrices.has(key)) finRow.querySelector('.financial-price').value = existingPrices.get(key);
                DOM.financialsContainer.appendChild(finRow);
            }
        } else { 
            const totalQty = partItem.querySelectorAll('.detailed-item-row').length;
            if (totalQty > 0) {
                const finRow = createFinancialRow(partId, partName, totalQty, 'detailed');
                const key = `${partId}-detailed`;
                if (existingPrices.has(key)) finRow.querySelector('.financial-price').value = existingPrices.get(key);
                DOM.financialsContainer.appendChild(finRow);
            }
        }
    });
    
    updateFinancials();
};

const addContentToPart = (partItem, partData = {}) => {
    const contentContainer = partItem.querySelector('.part-content-container');
    contentContainer.innerHTML = '';
    const partType = partItem.dataset.partType;

    partItem.querySelectorAll('.part-type-selector').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === partType);
    });

    if (partType === 'comum') {
        const comumTpl = document.getElementById('comumPartContentTemplate').content.cloneNode(true);
        const sizesGrid = comumTpl.querySelector('.sizes-grid');
        sizesGrid.className = 'sizes-grid hidden mt-3 space-y-4';

        const categories = {
            'Baby Look': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Normal': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Infantil': ['2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos']
        };
        let gridHtml = '';
        for (const category in categories) {
            gridHtml += `
            <div class="p-3 border rounded-md bg-white shadow-sm">
                <h4 class="font-bold text-gray-600 mb-3 text-sm uppercase tracking-wide border-b pb-1">${category}</h4>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-3 justify-start">`;
            
            categories[category].forEach(size => {
                const value = partData.sizes?.[category]?.[size] || '';
                gridHtml += `
                    <div class="size-input-container flex flex-col items-center">
                        <label class="text-xs font-bold text-gray-500 mb-1">${size}</label>
                        <input type="number" data-category="${category}" data-size="${size}" value="${value}" class="p-2 border border-gray-300 rounded-md w-full text-center size-input focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors">
                    </div>`;
            });
            gridHtml += '</div></div>';
        }
        sizesGrid.innerHTML = gridHtml;
        
        const specificList = comumTpl.querySelector('.specific-sizes-list');
        const addSpecificRow = (spec = {}) => {
            const specTpl = document.getElementById('specificSizeRowTemplate').content.cloneNode(true);
            specTpl.querySelector('.item-spec-width').value = spec.width || '';
            specTpl.querySelector('.item-spec-height').value = spec.height || '';
            specTpl.querySelector('.item-spec-obs').value = spec.observation || '';
            specTpl.querySelector('.remove-specific-row-btn').addEventListener('click', (e) => {
                e.target.closest('.specific-size-row').remove();
                renderFinancialSection();
            });
            specificList.appendChild(specTpl);
        };

        (partData.specifics || []).forEach(addSpecificRow);

        comumTpl.querySelector('.add-specific-size-btn').addEventListener('click', () => {
            addSpecificRow();
            renderFinancialSection();
        });

        comumTpl.querySelector('.toggle-sizes-btn').addEventListener('click', (e) => e.target.nextElementSibling.classList.toggle('hidden'));
        sizesGrid.addEventListener('input', renderFinancialSection);
        contentContainer.appendChild(comumTpl);

    } else { 
        const detalhadoTpl = document.getElementById('detalhadoPartContentTemplate').content.cloneNode(true);
        const listContainer = detalhadoTpl.querySelector('.detailed-items-list');
        const gridContainer = detalhadoTpl.querySelector('.detailed-sizes-grid-container');
        
        // --- INÍCIO DA LÓGICA DE REORDENAMENTO (DRAG AND DROP) ---
        // Apenas o container precisa ouvir o 'dragover' para calcular a posição
        listContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Permite o drop
            const afterElement = getDragAfterElement(listContainer, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) {
                    listContainer.appendChild(draggable);
                } else {
                    listContainer.insertBefore(draggable, afterElement);
                }
            }
        });

        // Função auxiliar para determinar a posição do drop
        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.detailed-item-row:not(.dragging)')];

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
        // --- FIM DA LÓGICA DE REORDENAMENTO ---

        const addRow = (detail = {}, prefilledSize = null) => {
            const row = document.createElement('div');
            // Alterado de grid-cols-12 para incluir a alça
            row.className = 'grid grid-cols-12 gap-2 items-center detailed-item-row transition-all duration-200 bg-white border border-transparent rounded hover:border-gray-200';
            
            const sizeValue = prefilledSize || detail.size || '';
            const isReadonly = prefilledSize ? 'readonly' : '';

            // Layout atualizado: 
            // 1 col (Alça) | 4 cols (Nome) | 4 cols (Tamanho) | 2 cols (Num) | 1 col (Remove)
            row.innerHTML = `
                <div class="col-span-1 flex justify-center cursor-move drag-handle text-gray-300 hover:text-gray-500" title="Arraste para mover">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
                </div>
                <div class="col-span-4"><input type="text" placeholder="Nome na Peça" class="p-1 border rounded-md w-full text-sm item-det-name" value="${detail.name || ''}"></div>
                <div class="col-span-4"><input type="text" placeholder="Tamanho" class="p-1 border rounded-md w-full text-sm item-det-size" value="${sizeValue}" ${isReadonly}></div>
                <div class="col-span-2"><input type="text" placeholder="Nº" class="p-1 border rounded-md w-full text-sm item-det-number" value="${detail.number || ''}"></div>
                <div class="col-span-1 flex justify-center"><button type="button" class="remove-detailed-row text-red-500 font-bold hover:text-red-700">&times;</button></div>`;
            
            // Listeners para Drag and Drop
            const handle = row.querySelector('.drag-handle');
            
            // Só permite arrastar se estiver segurando a alça (evita problemas ao selecionar texto)
            handle.addEventListener('mouseenter', () => { row.setAttribute('draggable', 'true'); });
            handle.addEventListener('mouseleave', () => { row.setAttribute('draggable', 'false'); });
            // Fallback para toque em mobile
            handle.addEventListener('touchstart', () => { row.setAttribute('draggable', 'true'); }, {passive: true});

            row.addEventListener('dragstart', () => {
                row.classList.add('dragging', 'opacity-50', 'bg-blue-50');
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('dragging', 'opacity-50', 'bg-blue-50');
                row.removeAttribute('draggable'); // Reseta por segurança
            });

            row.querySelector('.remove-detailed-row').addEventListener('click', () => {
                row.remove();
                renderFinancialSection();
            });
            listContainer.appendChild(row);
        };

        const categories = {
            'Baby Look': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Normal': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Infantil': ['2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos']
        };
        
        let gridHtml = '<div class="space-y-4">';
        for (const category in categories) {
            gridHtml += `
            <div class="bg-slate-50 p-2 rounded border border-slate-200">
                <h4 class="font-bold text-xs text-gray-500 uppercase mb-2">${category}</h4>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 justify-start">`;
            categories[category].forEach(size => {
                gridHtml += `
                    <div class="size-input-container">
                        <label class="text-xs font-medium mb-1 text-gray-400">${size}</label>
                        <input type="number" data-category="${category}" data-size="${size}" class="p-1 border rounded-md w-full text-center detailed-size-input text-sm">
                    </div>`;
            });
            gridHtml += '</div></div>';
        }
        gridHtml += '</div>';
        gridContainer.innerHTML += gridHtml; 
        
        if (partData.details && partData.details.length > 0) {
            partData.details.forEach(detail => addRow(detail, null)); 
            gridContainer.classList.add('hidden');
            detalhadoTpl.querySelector('.generate-detailed-lines-btn').classList.add('hidden');
            detalhadoTpl.querySelector('.detailed-list-wrapper').classList.remove('hidden');
        }

        detalhadoTpl.querySelector('.generate-detailed-lines-btn').addEventListener('click', (e) => {
            const partItem = e.target.closest('.part-item'); 
            if (!partItem) return;

            listContainer.querySelectorAll('.detailed-item-row').forEach(row => row.remove());

            partItem.querySelectorAll('.detailed-size-input').forEach(input => {
                const quantity = parseInt(input.value) || 0;
                if (quantity > 0) {
                    const { category, size } = input.dataset;
                    const prefilledSize = `${size} (${category})`; 
                    for (let i = 0; i < quantity; i++) addRow({}, prefilledSize); 
                }
            });

            renderFinancialSection(); 
            partItem.querySelector('.detailed-sizes-grid-container').classList.add('hidden');
            e.target.classList.add('hidden'); 
            partItem.querySelector('.detailed-list-wrapper').classList.remove('hidden');
        });

        detalhadoTpl.querySelector('.add-manual-detailed-row-btn').addEventListener('click', () => {
            addRow({}, null); 
            renderFinancialSection();
        });
        
        contentContainer.appendChild(detalhadoTpl);
    }
};

export const addPart = (partData = {}, partCounter) => {
    const partTpl = document.getElementById('partTemplate').content.cloneNode(true);
    const partItem = partTpl.querySelector('.part-item');
    partItem.dataset.partId = partCounter;
    partItem.dataset.partType = partData.partInputType || 'comum';
    
    const partTypeInput = partItem.querySelector('.part-type');
    partTypeInput.value = partData.type || '';
    partItem.querySelector('.part-material').value = partData.material || '';
    partItem.querySelector('.part-color-main').value = partData.colorMain || '';
    
    partTypeInput.addEventListener('input', renderFinancialSection);
    
    addContentToPart(partItem, partData);
    DOM.partsContainer.appendChild(partItem);
    
    renderFinancialSection();
    
    partItem.querySelector('.remove-part-btn').addEventListener('click', () => {
        partItem.remove();
        renderFinancialSection();
    });
    partItem.querySelectorAll('.part-type-selector').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newType = e.target.dataset.type;
            partItem.dataset.partType = newType;
            addContentToPart(partItem, {}); 
            renderFinancialSection();
        });
    });
};

export const resetForm = () => {
    DOM.orderForm.reset();
    DOM.orderId.value = '';
    DOM.modalTitle.textContent = 'Novo Pedido';
    DOM.partsContainer.innerHTML = '';
    DOM.financialsContainer.innerHTML = '';
    DOM.existingFilesContainer.innerHTML = '';
    DOM.orderDate.value = new Date().toISOString().split('T')[0];
    
    setPaymentList([]); // Limpa a lista de pagamentos
    
    updateFinancials();
};

export const populateFormForEdit = (orderData, currentPartCounter) => {
    // Nota: A lista de pagamentos é populada pelo Listener, 
    // pois os dados de transação vêm de outro serviço.
    // Aqui resetamos e preparamos os dados do pedido.
    
    resetForm();
    
    DOM.orderId.value = orderData.id;
    DOM.modalTitle.textContent = 'Editar Pedido';
    DOM.clientName.value = orderData.clientName;
    DOM.clientPhone.value = orderData.clientPhone;
    DOM.orderStatus.value = orderData.orderStatus;
    DOM.orderDate.value = orderData.orderDate;
    DOM.deliveryDate.value = orderData.deliveryDate;
    DOM.generalObservation.value = orderData.generalObservation;
    // DOM.downPayment ignorado propositalmente, usamos a lista agora
    DOM.discount.value = orderData.discount || '';
    
    if (DOM.paymentMethod) {
        DOM.paymentMethod.value = orderData.paymentMethod || '';
    }

    DOM.existingFilesContainer.innerHTML = '';
    if (orderData.mockupUrls && orderData.mockupUrls.length) {
        orderData.mockupUrls.forEach(url => {
            const fileWrapper = document.createElement('div');
            fileWrapper.className = 'flex items-center justify-between bg-gray-100 p-2 rounded-md';
            
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.className = 'text-blue-600 hover:underline text-sm truncate';
            link.textContent = url.split('/').pop().split('?')[0];
            
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'remove-mockup-btn text-red-500 hover:text-red-700 font-bold ml-2 px-2';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Remover anexo';

            fileWrapper.appendChild(link);
            fileWrapper.appendChild(deleteBtn);
            DOM.existingFilesContainer.appendChild(fileWrapper);
        });
    }

    (orderData.parts || []).forEach(part => {
        currentPartCounter++;
        addPart(part, currentPartCounter);
    });
    
    DOM.financialsContainer.querySelectorAll('.financial-item').forEach(finRow => {
        const partId = finRow.dataset.partId;
        const priceGroup = finRow.dataset.priceGroup;
        const part = orderData.parts[partId - 1];
        if (!part) return;

        if (priceGroup === 'standard') {
            finRow.querySelector('.financial-price').value = part.unitPriceStandard || part.unitPrice || '';
        } else if (priceGroup === 'specific') {
            finRow.querySelector('.financial-price').value = part.unitPriceSpecific || part.unitPrice || '';
        } else if (priceGroup === 'detailed') {
            finRow.querySelector('.financial-price').value = part.unitPrice || '';
        }
    });

    updateFinancials();
    DOM.orderModal.classList.remove('hidden');
    return currentPartCounter;
};

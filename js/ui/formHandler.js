// ==========================================================
// MÓDULO FORM HANDLER (v4.5.0-b)
// Responsabilidade: Gerenciar toda a lógica interna do
// modal de Pedidos (adicionar peças, calcular totais,
// popular para edição, resetar).
// ==========================================================

import { DOM } from './dom.js';

// Importa helpers do "gerente" ui.js (que serão movidos no futuro)
import { updateSourceSelectionUI } from '../ui.js';

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
    const downPayment = parseFloat(DOM.downPayment.value) || 0;

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
    // ==========================================================
    // INÍCIO DA CORREÇÃO v4.2.6: Preservar preços unitários ao mudar quantidade
    // ==========================================================
    
    // 1. Salva os preços unitários existentes antes de limpar o DOM
    const existingPrices = new Map();
    DOM.financialsContainer.querySelectorAll('.financial-item').forEach(item => {
        const partId = item.dataset.partId;
        const priceGroup = item.dataset.priceGroup;
        const price = item.querySelector('.financial-price').value;
        if (price) { // Salva apenas se houver um valor
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
                // 2. Reaplica o preço salvo, se existir
                const key = `${partId}-standard`;
                if (existingPrices.has(key)) {
                    finRow.querySelector('.financial-price').value = existingPrices.get(key);
                }
                DOM.financialsContainer.appendChild(finRow);
            }
            if (specificQty > 0) {
                const finRow = createFinancialRow(partId, partName, specificQty, 'specific');
                // 2. Reaplica o preço salvo, se existir
                const key = `${partId}-specific`;
                if (existingPrices.has(key)) {
                    finRow.querySelector('.financial-price').value = existingPrices.get(key);
                }
                DOM.financialsContainer.appendChild(finRow);
            }
        } else { // 'detalhado'
            const totalQty = partItem.querySelectorAll('.detailed-item-row').length;
            if (totalQty > 0) {
                const finRow = createFinancialRow(partId, partName, totalQty, 'detailed');
                // 2. Reaplica o preço salvo, se existir
                const key = `${partId}-detailed`;
                if (existingPrices.has(key)) {
                    finRow.querySelector('.financial-price').value = existingPrices.get(key);
                }
                DOM.financialsContainer.appendChild(finRow);
            }
        }
    });
    
    // 3. Recalcula o total (que já era chamado)
    updateFinancials();
    
    // ==========================================================
    // FIM DA CORREÇÃO v4.2.6
    // ==========================================================
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
        const categories = {
            'Baby Look': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Normal': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Infantil': ['2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos']
        };
        let gridHtml = '';
        for (const category in categories) {
            gridHtml += `<div class="p-3 border rounded-md bg-white"><h4 class="font-semibold mb-2">${category}</h4><div class="grid grid-cols-3 sm:grid-cols-6 gap-4 justify-start">`;
            categories[category].forEach(size => {
                const value = partData.sizes?.[category]?.[size] || '';
                gridHtml += `
                    <div class="size-input-container">
                        <label class="text-sm font-medium mb-1">${size}</label>
                        <input type="number" data-category="${category}" data-size="${size}" value="${value}" class="p-2 border rounded-md w-full text-center size-input">
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

    } else { // 'detalhado'
        // ==========================================================
        // INÍCIO DA ALTERAÇÃO v4.5.0-b
        // ==========================================================
        const detalhadoTpl = document.getElementById('detalhadoPartContentTemplate').content.cloneNode(true);
        const listContainer = detalhadoTpl.querySelector('.detailed-items-list');
        const gridContainer = detalhadoTpl.querySelector('.detailed-sizes-grid-container');
        
        // --- 1. Helper `addRow` modificado ---
        // Agora aceita um tamanho pré-preenchido e o torna readonly
        const addRow = (detail = {}, prefilledSize = null) => {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-12 gap-2 items-center detailed-item-row';
            
            const sizeValue = prefilledSize || detail.size || '';
            const isReadonly = prefilledSize ? 'readonly' : '';

            row.innerHTML = `
                <div class="col-span-5"><input type="text" placeholder="Nome na Peça" class="p-1 border rounded-md w-full text-sm item-det-name" value="${detail.name || ''}"></div>
                <div class="col-span-4"><input type="text" placeholder="Tamanho" class="p-1 border rounded-md w-full text-sm item-det-size" value="${sizeValue}" ${isReadonly}></div>
                <div class="col-span-2"><input type="text" placeholder="Nº" class="p-1 border rounded-md w-full text-sm item-det-number" value="${detail.number || ''}"></div>
                <div classcol-span-1 flex justify-center"><button type="button" class="remove-detailed-row text-red-500 font-bold">&times;</button></div>`;
            
            row.querySelector('.remove-detailed-row').addEventListener('click', () => {
                row.remove();
                renderFinancialSection();
            });
            listContainer.appendChild(row);
        };

        // --- 2. Construção da Grade de Tamanhos ---
        // Reutiliza a mesma estrutura de categorias do modo 'comum'
        const categories = {
            'Baby Look': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Normal': ['PP', 'P', 'M', 'G', 'GG', 'XG'],
            'Infantil': ['2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos']
        };
        let gridHtml = '<div class="space-y-4">';
        for (const category in categories) {
            gridHtml += `<div class=""><h4 class="font-semibold mb-2">${category}</h4><div class="grid grid-cols-3 sm:grid-cols-6 gap-4 justify-start">`;
            categories[category].forEach(size => {
                // Nota: Usamos 'detailed-size-input' para diferenciar dos inputs do modo 'comum'
                gridHtml += `
                    <div class="size-input-container">
                        <label class="text-sm font-medium mb-1">${size}</label>
                        <input type="number" data-category="${category}" data-size="${size}" class="p-2 border rounded-md w-full text-center detailed-size-input">
                    </div>`;
            });
            gridHtml += '</div></div>';
        }
        gridHtml += '</div>';
        gridContainer.innerHTML += gridHtml; // Adiciona a grade ao container
        
        // --- 3. Lógica de Edição vs. Novo ---
        // Se estamos editando (partData.details existe e tem itens), mostramos a lista e escondemos a grade.
        if (partData.details && partData.details.length > 0) {
            partData.details.forEach(detail => addRow(detail, null)); // Popula com dados existentes
            
            // Esconde a UI de geração
            gridContainer.classList.add('hidden');
            detalhadoTpl.querySelector('.generate-detailed-lines-btn').classList.add('hidden');
            
            // Mostra a lista
            detalhadoTpl.querySelector('.detailed-list-wrapper').classList.remove('hidden');
            
        } else {
            // Se for novo, a grade já está visível por padrão (HTML) e a lista escondida.
            // Não precisamos fazer nada.
        }

        // --- 4. Listeners dos Botões ---
        
        // Listener para o botão "Gerar Linhas"
        detalhadoTpl.querySelector('.generate-detailed-lines-btn').addEventListener('click', (e) => {
            const partItem = e.target.closest('.part-item'); // Encontra o 'part-item' pai
            if (!partItem) return;

            // Limpa a lista (exceto o header) antes de adicionar novas linhas
            listContainer.querySelectorAll('.detailed-item-row').forEach(row => row.remove());

            partItem.querySelectorAll('.detailed-size-input').forEach(input => {
                const quantity = parseInt(input.value) || 0;
                if (quantity > 0) {
                    const { category, size } = input.dataset;
                    const prefilledSize = `${size} (${category})`; // Ex: "M (Baby Look)"
                    
                    for (let i = 0; i < quantity; i++) {
                        addRow({}, prefilledSize); // Adiciona a linha com o tamanho pré-preenchido
                    }
                }
            });

            renderFinancialSection(); // Atualiza o financeiro
            
            // Esconde a UI de geração
            partItem.querySelector('.detailed-sizes-grid-container').classList.add('hidden');
            e.target.classList.add('hidden'); // Esconde o próprio botão
            
            // Mostra a lista de itens
            partItem.querySelector('.detailed-list-wrapper').classList.remove('hidden');
        });

        // Listener para o botão "+ Linha Manual" (que está dentro da lista)
        detalhadoTpl.querySelector('.add-manual-detailed-row-btn').addEventListener('click', () => {
            addRow({}, null); // Adiciona uma linha manual (sem pré-preenchimento)
            renderFinancialSection();
        });
        
        contentContainer.appendChild(detalhadoTpl);
        // ==========================================================
        // FIM DA ALTERAÇÃO v4.5.0-b
        // ==========================================================
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
    
    // v5.0: Define padrões para os novos campos da "Ponte"
    DOM.downPaymentDate.value = new Date().toISOString().split('T')[0];
    DOM.downPaymentStatusPago.checked = true;
    updateSourceSelectionUI(DOM.downPaymentSourceContainer, 'banco');
    
    updateFinancials();
};

export const populateFormForEdit = (orderData, currentPartCounter) => {
    resetForm();
    
    DOM.orderId.value = orderData.id;
    DOM.modalTitle.textContent = 'Editar Pedido';
    DOM.clientName.value = orderData.clientName;
    DOM.clientPhone.value = orderData.clientPhone;
    DOM.orderStatus.value = orderData.orderStatus;
    DOM.orderDate.value = orderData.orderDate;
    DOM.deliveryDate.value = orderData.deliveryDate;
    DOM.generalObservation.value = orderData.generalObservation;
    DOM.downPayment.value = orderData.downPayment || '';
    DOM.discount.value = orderData.discount || '';
    DOM.paymentMethod.value = orderData.paymentMethod || '';
    
    // v5.0: Popula os novos campos da "Ponte"
    DOM.downPaymentDate.value = orderData.downPaymentDate || new Date().toISOString().split('T')[0];
    const finStatus = orderData.paymentFinStatus || 'pago';
    (finStatus === 'a_receber' ? DOM.downPaymentStatusAReceber : DOM.downPaymentStatusPago).checked = true;
    updateSourceSelectionUI(DOM.downPaymentSourceContainer, orderData.paymentFinSource || 'banco');


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

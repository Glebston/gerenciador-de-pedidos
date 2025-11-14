// js/listeners/orderListeners.js

import * as UI from '../ui.js';
import { fileToBase64, uploadToImgBB, generateReceiptPdf, generateComprehensivePdf } from '../utils.js';

/**
 * Coleta os dados do formulário do pedido.
 * Esta é uma função auxiliar local para o módulo de listeners de pedido.
 * (Anteriormente em main.js)
 */
function collectFormData() {
    // Coleta a origem (Banco/Caixa) do adiantamento
    const activeSourceEl = UI.DOM.downPaymentSourceContainer.querySelector('.source-selector.active');
    
    const data = {
        clientName: UI.DOM.clientName.value, clientPhone: UI.DOM.clientPhone.value, orderStatus: UI.DOM.orderStatus.value,
        orderDate: UI.DOM.orderDate.value, deliveryDate: UI.DOM.deliveryDate.value, generalObservation: UI.DOM.generalObservation.value,
        parts: [], 
        downPayment: parseFloat(UI.DOM.downPayment.value) || 0, 
        discount: parseFloat(UI.DOM.discount.value) || 0,
        paymentMethod: UI.DOM.paymentMethod.value, 
        mockupUrls: Array.from(UI.DOM.existingFilesContainer.querySelectorAll('a')).map(a => a.href),
        
        // Novos campos da "Ponte" (salvos no pedido para referência futura)
        downPaymentDate: UI.DOM.downPaymentDate.value || new Date().toISOString().split('T')[0],
        paymentFinSource: activeSourceEl ? activeSourceEl.dataset.source : 'banco', // Padrão 'banco' se nada selecionado
        paymentFinStatus: UI.DOM.downPaymentStatusAReceber.checked ? 'a_receber' : 'pago'
    };
    
    UI.DOM.partsContainer.querySelectorAll('.part-item').forEach(p => {
        const id = p.dataset.partId;
        const part = { type: p.querySelector('.part-type').value, material: p.querySelector('.part-material').value, colorMain: p.querySelector('.part-color-main').value, partInputType: p.dataset.partType, sizes: {}, details: [], specifics: [], unitPriceStandard: 0, unitPriceSpecific: 0, unitPrice: 0 };
        if (part.partInputType === 'comum') {
            p.querySelectorAll('.size-input').forEach(i => { if (i.value) { const {category, size} = i.dataset; if (!part.sizes[category]) part.sizes[category] = {}; part.sizes[category][size] = parseInt(i.value, 10); }});
            p.querySelectorAll('.specific-size-row').forEach(r => { const w = r.querySelector('.item-spec-width').value.trim(), h = r.querySelector('.item-spec-height').value.trim(), o = r.querySelector('.item-spec-obs').value.trim(); if(w||h||o) part.specifics.push({ width:w, height:h, observation:o }); });
            const std = UI.DOM.financialsContainer.querySelector(`.financial-item[data-part-id="${id}"][data-price-group="standard"]`);
            if(std) part.unitPriceStandard = parseFloat(std.querySelector('.financial-price').value) || 0;
            const spec = UI.DOM.financialsContainer.querySelector(`.financial-item[data-part-id="${id}"][data-price-group="specific"]`);
            if(spec) part.unitPriceSpecific = parseFloat(spec.querySelector('.financial-price').value) || 0;
        } else {
            p.querySelectorAll('.detailed-item-row').forEach(r => { const n = r.querySelector('.item-det-name').value, s = r.querySelector('.item-det-size').value, num = r.querySelector('.item-det-number').value; if(n||s||num) part.details.push({name:n, size:s, number:num}); });
            const dtl = UI.DOM.financialsContainer.querySelector(`.financial-item[data-part-id="${id}"][data-price-group="detailed"]`);
            if(dtl) part.unitPrice = parseFloat(dtl.querySelector('.financial-price').value) || 0;
        }
        data.parts.push(part);
    });
    return data;
}

/**
 * Inicializa todos os event listeners relacionados a Pedidos.
 * @param {object} deps - Dependências injetadas
 * @param {Function} deps.getState - Getter para o estado (partCounter, etc.)
 * @param {Function} deps.setState - Setter para o estado
 * @param {Function} deps.getOptionsFromStorage - Função auxiliar do main.js
 * @param {object} deps.services - Funções de serviço (saveOrder, getOrderById, etc.)
 * @param {string} deps.userCompanyName - Nome da empresa do usuário
 */
export function initializeOrderListeners(deps) {

    const { getState, setState, getOptionsFromStorage, services, userCompanyName } = deps;

    // --- Funcionalidades de Pedidos ---
    UI.DOM.addOrderBtn.addEventListener('click', () => { 
        setState({ partCounter: 0 }); 
        UI.resetForm(); 
        
        // v5.7.6: Centralizado via modalHandler para aplicar o remendo de z-index
        UI.showOrderModal(); 
    });

    // ========================================================
    // v5.0: LÓGICA DA "PONTE" (FORMULÁRIO DE PEDIDO)
    // ========================================================
    UI.DOM.orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        UI.DOM.saveBtn.disabled = true; 
        UI.DOM.uploadIndicator.classList.remove('hidden');
        
        try {
            // --- ETAPA 1: Upload de Arquivos ---
            const files = UI.DOM.mockupFiles.files;
            const uploadPromises = Array.from(files).map(file => fileToBase64(file).then(uploadToImgBB));
            const newUrls = (await Promise.all(uploadPromises)).filter(Boolean);
            
            // --- ETAPA 2: Coletar Dados e Salvar Pedido ---
            const orderData = collectFormData(); // Usa a função auxiliar local
            orderData.mockupUrls.push(...newUrls);
            
            const orderId = UI.DOM.orderId.value;
            // Salva o pedido primeiro para garantir que temos um ID
            const savedOrderId = await services.saveOrder(orderData, orderId); 
            
            // --- ETAPA 3: A LÓGICA DA "PONTE" FINANCEIRA ---
            const downPaymentAmount = parseFloat(orderData.downPayment) || 0;
            const clientName = orderData.clientName;

            // Busca por uma transação de adiantamento JÁ VINCULADA a este pedido
            const existingTransaction = await services.getTransactionByOrderId(savedOrderId);

            // Cenário A: O usuário inseriu um valor de adiantamento
            if (downPaymentAmount > 0) {
                // Monta o objeto da transação
                const transactionData = {
                    date: orderData.downPaymentDate,
                    description: `Adiantamento Pedido - ${clientName}`,
                    amount: downPaymentAmount,
                    type: 'income',
                    category: 'Adiantamento de Pedido', 
                    source: orderData.paymentFinSource,
                    status: orderData.paymentFinStatus,
                    orderId: savedOrderId // O VÍNCULO SÊNIOR
                };
                
                if (existingTransaction) {
                    if (orderData.orderStatus !== 'Entregue') {
                         await services.saveTransaction(transactionData, existingTransaction.id);
                    }
                } 
                else {
                    await services.saveTransaction(transactionData, null);
                }
            } 
            // Cenário B: O usuário NÃO inseriu valor (ou zerou na edição)
            else {
                if (existingTransaction) {
                    await services.deleteTransaction(existingTransaction.id);
                }
            }

            // --- ETAPA 4: Feedback ---
            // v5.7.6: Centralizado via modalHandler
            UI.hideOrderModal();
            
            if (orderData.orderStatus === 'Finalizado' || orderData.orderStatus === 'Entregue') {
                const generate = await UI.showConfirmModal(
                    "Pedido salvo com sucesso! Deseja gerar o Recibo de Quitação e Entrega?", 
                    "Sim, gerar recibo", 
                    "Não, obrigado"
                );
                if (generate) {
                    const fullOrderData = { ...orderData, id: savedOrderId };
                    await generateReceiptPdf(fullOrderData, userCompanyName, UI.showInfoModal);
                }
            } else {
                 UI.showInfoModal("Pedido salvo com sucesso!");
            }

        } catch (error) { 
            console.error("Erro ao salvar pedido:", error);
            UI.showInfoModal('Ocorreu um erro ao salvar o pedido. Por favor, tente novamente.'); 
        } finally { 
            UI.DOM.saveBtn.disabled = false; 
            UI.DOM.uploadIndicator.classList.add('hidden'); 
        }
    });
    // ========================================================
    // FIM DA LÓGICA DA "PONTE"
    // ========================================================

    UI.DOM.ordersList.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.id) return;

        const id = btn.dataset.id;
        const order = services.getOrderById(id);
        if (!order) return;

        if (btn.classList.contains('edit-btn')) {
            let { partCounter } = getState();
            partCounter = 0;
            partCounter = UI.populateFormForEdit(order, partCounter);
            setState({ partCounter });
            
            // v5.7.6: Centralizado via modalHandler para aplicar o remendo de z-index
            UI.showOrderModal();
            
        } else if (btn.classList.contains('replicate-btn')) {
            let { partCounter } = getState();
            partCounter = 0;
            partCounter = UI.populateFormForEdit(order, partCounter);
            setState({ partCounter });
            
            // Resetar campos para modo de replicação
            UI.DOM.orderId.value = ''; 
            UI.DOM.modalTitle.textContent = 'Novo Pedido (Replicado)';
            UI.DOM.orderStatus.value = 'Pendente'; 
            UI.DOM.orderDate.value = new Date().toISOString().split('T')[0];
            UI.DOM.deliveryDate.value = ''; 
            UI.DOM.discount.value = ''; 
            UI.DOM.downPayment.value = '';
            UI.updateFinancials();
            
            // v5.0: Reseta os campos financeiros da ponte para o padrão
            UI.DOM.downPaymentDate.value = new Date().toISOString().split('T')[0];
            UI.DOM.downPaymentStatusPago.checked = true;
            UI.updateSourceSelectionUI(UI.DOM.downPaymentSourceContainer, 'banco');
            
            // v5.7.6: Centralizado via modalHandler para aplicar o remendo de z-index
            UI.showOrderModal();
            
        } else if (btn.classList.contains('delete-btn')) {
            UI.showConfirmModal("Tem certeza que deseja excluir este pedido?", "Excluir", "Cancelar")
              .then(async (confirmed) => {
                  if (confirmed) {
                      try {
                          await services.deleteAllTransactionsByOrderId(id);
                          await services.deleteOrder(id);
                      } catch (error) {
                          console.error("Erro ao excluir pedido e finanças:", error);
                          UI.showInfoModal("Falha ao excluir. Verifique o console.");
                      }
                  }
              });
        } else if (btn.classList.contains('view-btn')) {
            UI.viewOrder(order);
            
            // v5.7.6: Centralizado via modalHandler para aplicar o remendo de z-index
            UI.showViewModal();
            
        } else if (btn.classList.contains('settle-and-deliver-btn')) {
            // ========================================================
            // INÍCIO DA LÓGICA DE QUITAÇÃO v4.2.7
            // ========================================================
            try {
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

                const adiantamentoExistente = order.downPayment || 0;
                const valorRestante = totalValue - adiantamentoExistente;

                const updatedOrderData = { ...order };
                updatedOrderData.downPayment = totalValue; 
                updatedOrderData.orderStatus = 'Entregue';

                if (valorRestante <= 0) {
                    const confirmed = await UI.showConfirmModal(
                        "Este pedido já está pago. Deseja apenas marcá-lo como 'Entregue'?",
                        "Sim, marcar como 'Entregue'",
                        "Cancelar"
                    );
                    
                    if (confirmed) {
                        await services.saveOrder(updatedOrderData, id);
                        const generate = await UI.showConfirmModal(
                            "Pedido movido para 'Entregues' com sucesso! Deseja gerar o Recibo de Quitação e Entrega?",
                            "Sim, gerar recibo",
                            "Não, obrigado"
                        );
                        if (generate) {
                            await generateReceiptPdf(updatedOrderData, userCompanyName, UI.showInfoModal);
                        }
                    }
                } 
                else {
                    const settlementData = await UI.showSettlementModal(id, valorRestante);

                    if (settlementData) { 
                        await services.saveOrder(updatedOrderData, id);

                        const transactionData = {
                            date: settlementData.date, 
                            description: `Quitação Pedido - ${updatedOrderData.clientName}`,
                            amount: valorRestante,
                            type: 'income',
                            category: 'Quitação de Pedido', 
                            source: settlementData.source, 
                            status: 'pago',
                            orderId: id 
                        };
                        
                        await services.saveTransaction(transactionData, null);
                        
                        const generate = await UI.showConfirmModal(
                            "Pedido quitado e movido para 'Entregues' com sucesso! Deseja gerar o Recibo de Quitação e Entrega?",
                            "Sim, gerar recibo",
                            "Não, obrigado"
                        );
                        if (generate) {
                            await generateReceiptPdf(updatedOrderData, userCompanyName, UI.showInfoModal);
                        }
                    }
                }
            } catch (error) {
                console.error("Erro ao quitar e entregar pedido:", error);
                UI.showInfoModal("Ocorreu um erro ao atualizar o pedido.");
            }
            // ========================================================
            // FIM DA LÓGICA DE QUITAÇÃO
            // ========================================================
        }
    });

    UI.DOM.viewModal.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.id === 'closeViewBtn') { 
            // v5.7.6: Centralizado via modalHandler
            UI.hideViewModal();
            UI.DOM.viewModal.innerHTML = ''; 
        }
        if (btn.id === 'comprehensivePdfBtn') {
            generateComprehensivePdf(btn.dataset.id, services.getAllOrders(), userCompanyName, UI.showInfoModal);
        }
    });

    // --- Interações dentro do Modal de Pedidos ---
    // v5.7.6: Centralizado via modalHandler
    UI.DOM.cancelBtn.addEventListener('click', () => UI.hideOrderModal());
    
    UI.DOM.addPartBtn.addEventListener('click', () => { 
        let { partCounter } = getState();
        partCounter++; 
        UI.addPart({}, partCounter); 
        setState({ partCounter });
    });
    
    UI.DOM.downPayment.addEventListener('input', UI.updateFinancials);
    UI.DOM.discount.addEventListener('input', UI.updateFinancials);

    UI.DOM.clientPhone.addEventListener('input', (e) => {
     e.target.value = UI.formatPhoneNumber(e.target.value);
    });

    // Listener delegado para o modal de pedido (Opções, Mockups, Fonte de Pagamento)
    UI.DOM.orderModal.addEventListener('click', (e) => {
        // Gerenciador de Opções (Peça/Material)
        const optionsBtn = e.target.closest('button.manage-options-btn'); 
        if (optionsBtn) { 
            const currentOptionType = optionsBtn.dataset.type;
            setState({ currentOptionType });
            UI.openOptionsModal(currentOptionType, getOptionsFromStorage(currentOptionType)); 
        }
        
        // Gerenciador de Arquivos
        const removeMockupBtn = e.target.closest('.remove-mockup-btn');
        if (removeMockupBtn) {
            removeMockupBtn.parentElement.remove(); 
        }
        
        // Gerenciador do seletor de Origem (Banco/Caixa)
        const sourceBtn = e.target.closest('#downPaymentSourceContainer .source-selector');
        if (sourceBtn) {
            UI.updateSourceSelectionUI(UI.DOM.downPaymentSourceContainer, sourceBtn.dataset.source);
        }
    });
}

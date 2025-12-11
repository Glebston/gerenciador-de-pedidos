// js/listeners/orderListeners.js

// v5.24.0: Adicionado shareOrderPdf na importação
import { fileToBase64, uploadToImgBB, generateReceiptPdf, generateComprehensivePdf, shareOrderPdf } from '../utils.js';

/**
 * Coleta os dados do formulário do pedido.
 * v5.20: Adaptação para lista de pagamentos múltipla
 */
function collectFormData(UI) {
    // OBS: Ignoramos os seletores antigos de 'activeSource' e 'isAReceber'
    // pois agora cada pagamento na lista tem sua própria fonte.
    
    // Calcula o total pago baseado na lista visual (Verdade da UI)
    const paymentList = UI.getPaymentList ? UI.getPaymentList() : [];
    const totalDownPayment = paymentList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

    const paymentMethodValue = UI.DOM.paymentMethod ? UI.DOM.paymentMethod.value : '';

    const data = {
        clientName: UI.DOM.clientName.value, 
        clientPhone: UI.DOM.clientPhone.value, 
        orderStatus: UI.DOM.orderStatus.value,
        orderDate: UI.DOM.orderDate.value, 
        deliveryDate: UI.DOM.deliveryDate.value, 
        generalObservation: UI.DOM.generalObservation.value,
        parts: [], 
        // O valor do adiantamento agora é a SOMA da lista
        downPayment: totalDownPayment, 
        discount: parseFloat(UI.DOM.discount.value) || 0,
        paymentMethod: paymentMethodValue, 
        mockupUrls: Array.from(UI.DOM.existingFilesContainer.querySelectorAll('a')).map(a => a.href),
        
        // Campos legados mantidos para compatibilidade, mas controlados pela lista
        downPaymentDate: new Date().toISOString().split('T')[0], 
        paymentFinSource: 'banco',
        paymentFinStatus: 'pago'
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

export function initializeOrderListeners(UI, deps) {

    const { getState, setState, getOptionsFromStorage, services, userCompanyName } = deps;

    UI.DOM.addOrderBtn.addEventListener('click', () => { 
        setState({ partCounter: 0 }); 
        UI.resetForm(); 
        UI.showOrderModal(); 
    });

    // ========================================================
    // v5.20: LÓGICA DA "PONTE" (MULTI-PAGAMENTOS)
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
            const orderData = collectFormData(UI); 
            orderData.mockupUrls.push(...newUrls);
            
            const orderId = UI.DOM.orderId.value;
            const savedOrderId = await services.saveOrder(orderData, orderId); 
            
            // --- ETAPA 3: SINCRONIA FINANCEIRA MULTI-TRANSAÇÃO ---
            const clientName = orderData.clientName;
            
            // 3.1 Busca transações existentes para comparar
            const existingTransactions = services.getTransactionsByOrderId ? services.getTransactionsByOrderId(savedOrderId) : [];
            
            // 3.2 Pega a lista desejada da UI
            const newPaymentList = UI.getPaymentList ? UI.getPaymentList() : [];

            // 3.3 Lógica de Atualização (CRUD)
            
            // A) Remover transações que não estão mais na lista
            const idsInNewList = newPaymentList.map(p => p.id).filter(id => id);
            for (const existing of existingTransactions) {
                // Se a transação existente não estiver na lista nova (e não for Quitação Final), apaga
                // (Proteção: Se categoria for 'Quitação de Pedido', mantemos, pois ela é gerada pelo botão de entregar)
                if (existing.category !== 'Quitação de Pedido' && !idsInNewList.includes(existing.id)) {
                    await services.deleteTransaction(existing.id);
                }
            }

            // B) Criar ou Atualizar transações da lista
            for (const payment of newPaymentList) {
                const transactionData = {
                    date: payment.date,
                    description: `Adiantamento Pedido - ${clientName}`,
                    amount: parseFloat(payment.amount),
                    type: 'income',
                    category: 'Adiantamento de Pedido',
                    source: payment.source,
                    status: 'pago',
                    orderId: savedOrderId
                };

                // Se tem ID, atualiza. Se não, cria.
                await services.saveTransaction(transactionData, payment.id);
            }

            // --- ETAPA 4: Feedback ---
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
            UI.showInfoModal('Ocorreu um erro ao salvar o pedido. Por favor, verifique os dados e tente novamente.'); 
        } finally { 
            UI.DOM.saveBtn.disabled = false; 
            UI.DOM.uploadIndicator.classList.add('hidden'); 
        }
    });

    UI.DOM.ordersList.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.id) return;

        const id = btn.dataset.id;
        const order = services.getOrderById(id);
        if (!order) return;

        if (btn.classList.contains('edit-btn')) {
            let { partCounter } = getState();
            partCounter = 0;
            
            // v5.20: Carrega as transações do pedido antes de abrir o modal
            const transactions = services.getTransactionsByOrderId ? services.getTransactionsByOrderId(id) : [];
            // Filtra apenas adiantamentos (ignora quitações finais geradas na entrega)
            const downPayments = transactions.filter(t => t.category === 'Adiantamento de Pedido');
            
            partCounter = UI.populateFormForEdit(order, partCounter);
            
            // Injeta a lista no UI handler
            if (UI.setPaymentList) {
                UI.setPaymentList(downPayments);
            }
            
            setState({ partCounter });
            UI.showOrderModal();
            
        } else if (btn.classList.contains('replicate-btn')) {
            let { partCounter } = getState();
            partCounter = 0;
            partCounter = UI.populateFormForEdit(order, partCounter);
            setState({ partCounter });
            
            UI.DOM.orderId.value = ''; 
            UI.DOM.modalTitle.textContent = 'Novo Pedido (Replicado)';
            UI.DOM.orderStatus.value = 'Pendente'; 
            UI.DOM.orderDate.value = new Date().toISOString().split('T')[0];
            UI.DOM.deliveryDate.value = ''; 
            UI.DOM.discount.value = ''; 
            // UI.DOM.downPayment.value = ''; // Ignorado, usamos setPaymentList
            UI.updateFinancials();
            
            // Limpa lista de pagamentos na replicação
            if (UI.setPaymentList) UI.setPaymentList([]);
            
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
            UI.showViewModal();
            
        } else if (btn.classList.contains('settle-and-deliver-btn')) {
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
        }
    });

    UI.DOM.viewModal.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.id === 'closeViewBtn') { 
            UI.hideViewModal();
            UI.DOM.viewModal.innerHTML = ''; 
        }
        
        // v5.24.0: Suporte ao novo botão de compartilhar e ao legado de gerar PDF
        if (btn.id === 'comprehensivePdfBtn') {
            generateComprehensivePdf(btn.dataset.id, services.getAllOrders(), userCompanyName(), UI.showInfoModal);
        }
        
        if (btn.id === 'sharePdfBtn') {
            shareOrderPdf(btn.dataset.id, services.getAllOrders(), userCompanyName(), UI.showInfoModal);
        }
    });

    UI.DOM.cancelBtn.addEventListener('click', () => UI.hideOrderModal());
    
    UI.DOM.addPartBtn.addEventListener('click', () => { 
        let { partCounter } = getState();
        partCounter++; 
        UI.addPart({}, partCounter); 
        setState({ partCounter });
    });
    
    // UI.DOM.downPayment.addEventListener('input', UI.updateFinancials); // Removido, controlado pelo manager
    UI.DOM.discount.addEventListener('input', UI.updateFinancials);

    UI.DOM.clientPhone.addEventListener('input', (e) => {
     e.target.value = UI.formatPhoneNumber(e.target.value);
    });

    UI.DOM.orderModal.addEventListener('click', (e) => {
        const optionsBtn = e.target.closest('button.manage-options-btn'); 
        if (optionsBtn) { 
            const currentOptionType = optionsBtn.dataset.type;
            setState({ currentOptionType });
            UI.openOptionsModal(currentOptionType, getOptionsFromStorage(currentOptionType)); 
        }
        
        const removeMockupBtn = e.target.closest('.remove-mockup-btn');
        if (removeMockupBtn) {
            removeMockupBtn.parentElement.remove(); 
        }
        
        const sourceBtn = e.target.closest('#downPaymentSourceContainer .source-selector');
        if (sourceBtn) {
            UI.updateSourceSelectionUI(UI.DOM.downPaymentSourceContainer, sourceBtn.dataset.source);
        }
    });
}

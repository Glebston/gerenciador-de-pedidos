// js/listeners/orderListeners.js
// ==========================================================
// MÓDULO ORDER LISTENERS (v5.33.0 - AUTO REPLY)
// ==========================================================

import { fileToBase64, uploadToImgBB, generateReceiptPdf, generateComprehensivePdf, generateProductionOrderPdf, runDatabaseMigration } from '../utils.js';

/**
 * Coleta os dados do formulário do pedido.
 */
function collectFormData(UI) {
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
        downPayment: totalDownPayment, 
        discount: parseFloat(UI.DOM.discount.value) || 0,
        paymentMethod: paymentMethodValue, 
        mockupUrls: Array.from(UI.DOM.existingFilesContainer.querySelectorAll('a')).map(a => a.href),
        
        downPaymentDate: new Date().toISOString().split('T')[0], 
        paymentFinSource: 'banco',
        paymentFinStatus: 'pago'
    };
    
    // Coleta Peças
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

    // --- GATILHO SECRETO DE MIGRAÇÃO (SHIFT + Clique no Título) ---
    if (UI.DOM.modalTitle) {
        UI.DOM.modalTitle.addEventListener('click', (e) => {
            if (e.shiftKey) {
                runDatabaseMigration(UI.showInfoModal);
            }
        });
    }

    // --- AUTOMAÇÃO DE RESPOSTA DE AJUSTE (NOVO) ---
    if (UI.DOM.orderStatus) {
        UI.DOM.orderStatus.addEventListener('change', (e) => {
            // Só executa se mudar para "Aguardando Aprovação"
            if (e.target.value === 'Aguardando Aprovação') {
                const today = new Date().toLocaleDateString('pt-BR');
                const autoMessage = `[Ajuste Realizado em ${today}]: Arte atualizada. Por favor, confira novamente.`;
                
                // Evita duplicar a mensagem se já tiver sido inserida hoje na mesma sessão
                const currentObs = UI.DOM.generalObservation.value;
                if (!currentObs.includes(autoMessage)) {
                    // Adiciona uma quebra de linha se já tiver texto
                    const prefix = currentObs ? '\n\n' : '';
                    UI.DOM.generalObservation.value = currentObs + prefix + autoMessage;
                    
                    // Pequeno feedback visual (piscar a borda verde) para o usuário notar que o texto foi inserido
                    UI.DOM.generalObservation.classList.add('ring-2', 'ring-green-500', 'transition-all', 'duration-500');
                    setTimeout(() => UI.DOM.generalObservation.classList.remove('ring-2', 'ring-green-500'), 1000);
                }
            }
        });
    }

    // Abertura do Modal de Novo Pedido
    UI.DOM.addOrderBtn.addEventListener('click', () => { 
        setState({ partCounter: 0 }); 
        UI.resetForm(); 
        UI.showOrderModal(); 
    });

    // --- SALVAR PEDIDO (Estável e Preciso) ---
    UI.DOM.orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        UI.DOM.saveBtn.disabled = true; 
        UI.DOM.uploadIndicator.classList.remove('hidden');
        
        try {
            // 1. Upload de Imagens
            const files = UI.DOM.mockupFiles.files;
            const uploadPromises = Array.from(files).map(file => fileToBase64(file).then(uploadToImgBB));
            const newUrls = (await Promise.all(uploadPromises)).filter(Boolean);
            
            // 2. Coleta de Dados
            const orderData = collectFormData(UI); 
            orderData.mockupUrls.push(...newUrls);
            
            // Tratamento IMPORTANTE do ID: Remove espaços em branco que causam erro "No document to update"
            let orderId = UI.DOM.orderId.value ? UI.DOM.orderId.value.trim() : '';
            
            // Garante que o ID esteja escrito DENTRO do objeto do pedido (Crucial para o Link de Aprovação funcionar)
            if (orderId) {
                orderData.id = orderId;
            }

            // 3. Salvar no Banco
            // Se orderId existir, atualiza. Se não, cria novo.
            // Removemos a lógica de "Try/Catch para criar novo" para evitar duplicação acidental.
            const savedOrderId = await services.saveOrder(orderData, orderId); 
            
            // Se for um pedido NOVO, o services retorna o novo ID gerado. 
            // Precisamos garantir que esse ID novo também seja gravado dentro do documento para o Link funcionar.
            if (!orderId && savedOrderId) {
                // Pequeno update silencioso para gravar o ID dentro do documento recém-criado
                await services.saveOrder({ id: savedOrderId }, savedOrderId);
            }
            
            // 4. Atualizar Finanças
            const clientName = orderData.clientName;
            const existingTransactions = services.getTransactionsByOrderId ? services.getTransactionsByOrderId(savedOrderId) : [];
            const newPaymentList = UI.getPaymentList ? UI.getPaymentList() : [];

            const idsInNewList = newPaymentList.map(p => p.id).filter(id => id);
            for (const existing of existingTransactions) {
                if (existing.category !== 'Quitação de Pedido' && !idsInNewList.includes(existing.id)) {
                    await services.deleteTransaction(existing.id);
                }
            }

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
                await services.saveTransaction(transactionData, payment.id);
            }

            UI.hideOrderModal();
            
            // 5. Pós-Salvar (Recibos)
            if (orderData.orderStatus === 'Finalizado' || orderData.orderStatus === 'Entregue') {
                const generate = await UI.showConfirmModal(
                    "Pedido salvo com sucesso! Deseja gerar o Recibo de Quitação e Entrega?", 
                    "Sim, gerar recibo", 
                    "Não, obrigado"
                );
                if (generate) {
                    const fullOrderData = { ...orderData, id: savedOrderId };
                    await generateReceiptPdf(fullOrderData, userCompanyName(), UI.showInfoModal);
                }
            } else {
                 UI.showInfoModal("Pedido salvo com sucesso!");
            }

        } catch (error) { 
            console.error("Erro ao salvar pedido:", error);
            // Se der erro agora, é um erro real de conexão ou permissão, não vamos mascarar duplicando o pedido.
            UI.showInfoModal(`Erro ao salvar: ${error.message || 'Verifique o console'}`); 
        } finally { 
            UI.DOM.saveBtn.disabled = false; 
            UI.DOM.uploadIndicator.classList.add('hidden'); 
        }
    });

    // --- LISTENERS DA GRID ---
    UI.DOM.ordersList.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        // Se clicar no botão de fechar (caso ele estivesse aqui por engano)
        if (btn.id === 'closeViewBtn') return; 

        const id = btn.dataset.id;
        if (!id && !btn.id.includes('Pdf')) return;

        const order = id ? services.getOrderById(id) : null;

        if (btn.classList.contains('edit-btn') && order) {
            let { partCounter } = getState();
            partCounter = 0;
            const transactions = services.getTransactionsByOrderId ? services.getTransactionsByOrderId(id) : [];
            const downPayments = transactions.filter(t => t.category === 'Adiantamento de Pedido');
            partCounter = UI.populateFormForEdit(order, partCounter);
            if (UI.setPaymentList) {
                UI.setPaymentList(downPayments);
            }
            setState({ partCounter });
            UI.showOrderModal();
            
        } else if (btn.classList.contains('replicate-btn') && order) {
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
            UI.updateFinancials();
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
        } else if (btn.classList.contains('view-btn') && order) {
            UI.viewOrder(order);
            UI.showViewModal();
            
        } else if (btn.classList.contains('settle-and-deliver-btn') && order) {
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

                const updatedOrderData = { ...order, id: id };
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
                            await generateReceiptPdf(updatedOrderData, userCompanyName(), UI.showInfoModal);
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
                            await generateReceiptPdf(updatedOrderData, userCompanyName(), UI.showInfoModal);
                        }
                    }
                }
            } catch (error) {
                console.error("Erro ao quitar e entregar pedido:", error);
                UI.showInfoModal("Ocorreu um erro ao atualizar o pedido.");
            }
        }
    });

    // --- LISTENER DO MODAL DE DETALHES (View/Visualizar) ---
    UI.DOM.viewModal.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        
        // 1. Botão FECHAR (X)
        if (btn && btn.id === 'closeViewBtn') { 
            UI.hideViewModal();
            UI.DOM.viewModal.innerHTML = ''; 
            return;
        }

        // 2. Lógica do Dropdown (Documentos)
        if (btn && btn.id === 'documentsBtn') {
            e.stopPropagation(); 
            const menu = UI.DOM.viewModal.querySelector('#documentsMenu');
            if(menu) menu.classList.toggle('hidden');
            // Fecha o outro menu se estiver aberto
            UI.DOM.viewModal.querySelector('#whatsappMenu')?.classList.add('hidden');
            return; 
        }

        // 3. Lógica do Dropdown (WhatsApp) - NOVO
        if (btn && btn.id === 'whatsappMenuBtn') {
            e.stopPropagation(); 
            const menu = UI.DOM.viewModal.querySelector('#whatsappMenu');
            if(menu) menu.classList.toggle('hidden');
            // Fecha o outro menu se estiver aberto
            UI.DOM.viewModal.querySelector('#documentsMenu')?.classList.add('hidden');
            return; 
        }

        // Fecha qualquer menu se clicar fora dos botões (mas dentro do modal)
        const docMenu = UI.DOM.viewModal.querySelector('#documentsMenu');
        if (docMenu && !docMenu.classList.contains('hidden')) docMenu.classList.add('hidden');
        
        const zapMenu = UI.DOM.viewModal.querySelector('#whatsappMenu');
        if (zapMenu && !zapMenu.classList.contains('hidden')) zapMenu.classList.add('hidden');

        if (!btn) return;
        
        // Ações de PDF
        if (btn.id === 'comprehensivePdfBtn') {
            generateComprehensivePdf(btn.dataset.id, services.getAllOrders(), userCompanyName(), UI.showInfoModal);
        }
        
        if (btn.id === 'productionPdfBtn') {
            generateProductionOrderPdf(btn.dataset.id, services.getAllOrders(), userCompanyName(), UI.showInfoModal);
        }

        // 4. Ação: Abrir WhatsApp (Comportamento Original) - Migrado para o item do menu
        if (btn.id === 'btnOpenWhatsAppAction') {
            const order = services.getOrderById(btn.dataset.id);
            if (!order || !order.clientPhone) {
                UI.showInfoModal("Este pedido não possui telefone cadastrado.");
                return;
            }
            let phone = order.clientPhone.replace(/\D/g, '');
            if (phone.length <= 11) phone = '55' + phone;
            const company = userCompanyName(); 
            const firstName = order.clientName.split(' ')[0]; 
            const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            const approvalLink = `${baseUrl}/aprovacao.html?id=${order.id}`;
            const message = `Olá ${firstName}, aqui é da ${company}. Segue o link para conferência e aprovação do layout do seu pedido: ${approvalLink} . Por favor, confira os nomes e tamanhos. Qualquer dúvida, estou à disposição!`;
            const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
            const link = document.createElement('a');
            link.href = url;
            link.target = 'whatsapp_tab'; 
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // 5. Ação: Copiar Link (NOVO)
        if (btn.id === 'btnCopyLinkAction') {
            const orderId = btn.dataset.id;
            const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            const approvalLink = `${baseUrl}/aprovacao.html?id=${orderId}`;

            try {
                await navigator.clipboard.writeText(approvalLink);
                
                // Feedback visual temporário no botão
                const originalContent = btn.innerHTML;
                btn.innerHTML = `<span class="text-green-600 font-bold flex items-center gap-2"><i class="fa-solid fa-check"></i> Copiado!</span>`;
                setTimeout(() => {
                    if (btn) btn.innerHTML = originalContent;
                }, 1500);

            } catch (err) {
                console.error("Erro ao copiar link:", err);
                UI.showInfoModal("Não foi possível copiar o link automaticamente.");
            }
        }
    });

    // --- LISTENER GLOBAL DE TECLAS (ESC) ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const viewModalOpen = UI.DOM.viewModal && !UI.DOM.viewModal.classList.contains('hidden');
            const orderModalOpen = UI.DOM.orderModal && !UI.DOM.orderModal.classList.contains('hidden');

            if (viewModalOpen) {
                UI.hideViewModal();
                UI.DOM.viewModal.innerHTML = '';
            } else if (orderModalOpen) {
                UI.hideOrderModal();
            }
        }
    });

    // Listeners menores
    UI.DOM.cancelBtn.addEventListener('click', () => UI.hideOrderModal());
    UI.DOM.addPartBtn.addEventListener('click', () => { 
        let { partCounter } = getState();
        partCounter++; 
        UI.addPart({}, partCounter); 
        setState({ partCounter });
    });
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

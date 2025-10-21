// ========================================================
// PARTE 1: IMPORTAÇÕES DE MÓDUTO
// ========================================================

// Firebase Core & Config
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, writeBatch, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, auth } from './firebaseConfig.js';

// Módulo de Autenticação
import { handleLogin, handleLogout, handleForgotPassword } from './auth.js';

// Módulos de Serviços de Negócio
import { initializeOrderService, saveOrder, deleteOrder, getOrderById, getAllOrders, cleanupOrderService } from './services/orderService.js';
import { initializeFinanceService, saveTransaction, deleteTransaction, markTransactionAsPaid, saveInitialBalance, getAllTransactions, cleanupFinanceService } from './services/financeService.js';
import { initializePricingService, savePriceTableChanges, deletePriceItem, getAllPricingItems, cleanupPricingService } from './services/pricingService.js';

// Módulo de Utilitários
import { initializeIdleTimer, resetIdleTimer, fileToBase64, uploadToImgBB, generateComprehensivePdf, generateReceiptPdf } from './utils.js';

// Módulo de Interface do Usuário (UI) - Importando tudo sob o namespace 'UI'
import * as UI from './ui.js';


// ========================================================
// PARTE 2: ESTADO GLOBAL E CONFIGURAÇÕES DA APLICAÇÃO
// ========================================================

let userCompanyId = null;
let userCompanyName = null;
let userBankBalanceConfig = { initialBalance: 0 };

let currentDashboardView = 'orders';
let currentOrdersView = 'pending';
let partCounter = 0;
let currentOptionType = ''; // Para o modal de gerenciamento de opções

const defaultOptions = {
    partTypes: ['Gola redonda manga curta', 'Gola redonda manga longa', 'Gola redonda manga longa com capuz', 'Gola redonda manga curta (sublimada na frente)', 'Gola polo manga curta', 'Gola polo manga longa', 'Gola V manga curta', 'Gola V manga longa', 'Short', 'Calça'],
    materialTypes: ['Malha fria', 'Drifity', 'Cacharrel', 'PP', 'Algodão Fio 30', 'TNT drive', 'Piquê', 'Brim']
};


// ========================================================
// PARTE 3: LÓGICA DE INICIALIZAÇÃO E AUTENTICAÇÃO
// ========================================================

const initializeAppLogic = async (user) => {
    const userMappingRef = doc(db, "user_mappings", user.uid);
    const userMappingSnap = await getDoc(userMappingRef);
    
    if (userMappingSnap.exists()) {
        userCompanyId = userMappingSnap.data().companyId;
        const companyRef = doc(db, "companies", userCompanyId);
        const companySnap = await getDoc(companyRef);

        if (companySnap.exists()) {
            const companyData = companySnap.data();
            userCompanyName = companyData.companyName || user.email;
            userBankBalanceConfig = companyData.bankBalanceConfig || { initialBalance: 0 };
        } else {
            userCompanyName = user.email; 
            userBankBalanceConfig = { initialBalance: 0 };
        }
        UI.DOM.userEmail.textContent = userCompanyName;
        
        // --- INICIALIZAÇÃO REATIVA (PÓS-REATORAÇÃO) ---
        // 1. Inicializa os serviços passando os NOVOS handlers
        initializeOrderService(userCompanyId, handleOrderChange, () => currentOrdersView);
        initializeFinanceService(userCompanyId, handleFinanceChange, () => userBankBalanceConfig);
        initializePricingService(userCompanyId, handlePricingChange);
        
        // 2. Renderiza a UI inicial usando o cache (que ainda está vazio)
        UI.renderOrders(getAllOrders(), currentOrdersView);
        UI.renderFinanceDashboard(getAllTransactions(), userBankBalanceConfig);
        // A tabela de preços é renderizada quando o modal é aberto
        
        // --- FIM DA INICIALIZAÇÃO REATIVA ---
        
        initializeIdleTimer(UI.DOM, handleLogout);
        initializeAndPopulateDatalists();
        checkBackupReminder();
        triggerAutoBackupIfNeeded();
        UI.updateNavButton(currentDashboardView);
        
        UI.DOM.authContainer.classList.add('hidden');
        UI.DOM.app.classList.remove('hidden');

    } else {
        UI.showInfoModal("Erro: Usuário não associado a nenhuma empresa. Fale com o suporte.");
        handleLogout();
    }
};

const cleanupApplication = () => {
    UI.DOM.app.classList.add('hidden');
    UI.DOM.authContainer.classList.remove('hidden');
    
    cleanupOrderService();
    cleanupFinanceService();
    cleanupPricingService();
    
    userCompanyId = null;
    userCompanyName = null;
    userBankBalanceConfig = { initialBalance: 0 };
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        initializeAppLogic(user);
    } else {
        cleanupApplication();
    }
});


// ========================================================
// PARTE 4: HANDLERS DE MUDANÇA (LÓGICA REATIVA)
// ========================================================

/**
 * Lida com mudanças granulares vindas do orderService
 * @param {string} type - 'added', 'modified', 'removed'
 * @param {object} order - O documento do pedido
 * @param {string} viewType - O 'currentOrdersView' ('pending' ou 'delivered')
 */
const handleOrderChange = (type, order, viewType) => {
    // --- CORREÇÃO v4.2.1: Lógica de Roteamento ---
    
    const isDelivered = order.orderStatus === 'Entregue';

    // Rota 1: Estamos na view 'pending'
    if (viewType === 'pending') {
        // Se o pedido foi marcado como 'Entregue' (vindo de 'added' ou 'modified')
        if (isDelivered) {
            // DEVE ser removido da view 'pending'
            UI.removeOrderCard(order.id);
            return;
        } else {
            // Se NÃO está 'Entregue', processa normalmente
            switch (type) {
                case 'added':
                    UI.addOrderCard(order, viewType);
                    break;
                case 'modified':
                    UI.updateOrderCard(order, viewType);
                    break;
                case 'removed':
                    UI.removeOrderCard(order.id);
                    break;
            }
        }
    } 
    // Rota 2: Estamos na view 'delivered'
    else if (viewType === 'delivered') {
        // Se o pedido NÃO está 'Entregue' (ex: foi movido de volta para 'pendente')
        if (!isDelivered) {
            // DEVE ser removido da view 'delivered'
            UI.removeOrderCard(order.id);
            return;
        } else {
             // Se ESTÁ 'Entregue', processa normalmente
            switch (type) {
                case 'added':
                    UI.addOrderCard(order, viewType);
                    break;
                case 'modified':
                    UI.updateOrderCard(order, viewType);
                    break;
                case 'removed':
                    UI.removeOrderCard(order.id);
                    break;
            }
        }
    }
    // --- FIM DA CORREÇÃO ---
};

/**
 * Lida com mudanças granulares vindas do financeService
 * @param {string} type - 'added', 'modified', 'removed'
 * @param {object} transaction - O documento da transação
 * @param {object} config - O userBankBalanceConfig
 */
const handleFinanceChange = (type, transaction, config) => {
    // 1. Atualiza os KPIs (cards superiores) em TODA mudança, pois qualquer evento afeta os totais
    UI.renderFinanceKPIs(getAllTransactions(), config);
    
    // 2. Verifica se a transação passa nos filtros atuais (data e busca) antes de atualizar a tabela
    const filter = UI.DOM.periodFilter.value;
    const now = new Date();
    let startDate, endDate;

    if (filter === 'custom') {
        startDate = UI.DOM.startDateInput.value ? new Date(UI.DOM.startDateInput.value + 'T00:00:00') : null;
        endDate = UI.DOM.endDateInput.value ? new Date(UI.DOM.endDateInput.value + 'T23:59:59') : null;
    } else {
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const startOfThisYear = new Date(now.getFullYear(), 0, 1);
        const endOfThisYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        if (filter === 'thisMonth') { startDate = startOfThisMonth; endDate = endOfThisMonth; }
        if (filter === 'lastMonth') { startDate = startOfLastMonth; endDate = endOfLastMonth; }
        if (filter === 'thisYear') { startDate = startOfThisYear; endDate = endOfThisYear; }
    }
    
    const transactionDate = new Date(transaction.date + 'T00:00:00');
    let passesDateFilter = true;
    if (startDate && endDate) passesDateFilter = transactionDate >= startDate && transactionDate <= endDate;
    else if(startDate && !endDate) passesDateFilter = transactionDate >= startDate;
    else if(!startDate && endDate) passesDateFilter = transactionDate <= endDate;

    const searchTerm = UI.DOM.transactionSearchInput.value.toLowerCase();
    const passesSearchFilter = transaction.description.toLowerCase().includes(searchTerm);

    if (!passesDateFilter || !passesSearchFilter) {
        // Se não passa no filtro, pode ser que o item estivesse na lista e precise ser removido
        if (type === 'modified' || type === 'removed') {
             UI.removeTransactionRow(transaction.id);
        }
        return; // Ignora 'added' que não passa no filtro
    }

    // 3. Se passou nos filtros, atualiza a tabela
    switch (type) {
        case 'added':
            UI.addTransactionRow(transaction);
            break;
        case 'modified':
            UI.updateTransactionRow(transaction);
            break;
        case 'removed':
            UI.removeTransactionRow(transaction.id);
            break;
    }
};

/**
 * Lida com mudanças granulares vindas do pricingService
 * @param {string} type - 'added', 'modified', 'removed'
 * @param {object} item - O documento do item de preço
 */
const handlePricingChange = (type, item) => {
    // O modal de preços pode não estar aberto, mas atualizamos mesmo assim
    // A função `renderPriceTable` é chamada quando o modal abre,
    // mas as funções granulares atualizam se ele JÁ ESTIVER aberto.
    
    // Precisamos saber se estamos em 'view' ou 'edit' mode
    const isEditMode = !UI.DOM.editPriceTableBtn.classList.contains('hidden');
    const mode = isEditMode ? 'view' : 'edit';
    
    switch (type) {
        case 'added':
            UI.addPriceTableRow(item, mode);
            break;
        case 'modified':
            UI.updatePriceTableRow(item, mode);
            break;
        case 'removed':
            UI.removePriceTableRow(item.id);
            break;
    }
};


// ========================================================
// PARTE 5: FUNÇÕES DE LÓGICA TRANSVERSAL (Cross-Cutting)
// ========================================================

const getOptionsFromStorage = (type) => {
    const stored = localStorage.getItem(`${userCompanyId}_${type}`);
    return stored ? JSON.parse(stored) : defaultOptions[type];
};

const saveOptionsToStorage = (type, options) => {
    localStorage.setItem(`${userCompanyId}_${type}`, JSON.stringify(options));
};

const initializeAndPopulateDatalists = () => {
    if (!localStorage.getItem(`${userCompanyId}_partTypes`)) saveOptionsToStorage('partTypes', defaultOptions.partTypes);
    if (!localStorage.getItem(`${userCompanyId}_materialTypes`)) saveOptionsToStorage('materialTypes', defaultOptions.materialTypes);
    UI.populateDatalists(getOptionsFromStorage('partTypes'), getOptionsFromStorage('materialTypes'));
};

const handleBackup = () => {
    const orders = getAllOrders();
    const transactions = getAllTransactions();
    if (orders.length === 0 && transactions.length === 0) {
        UI.showInfoModal("Não há dados para fazer backup.");
        return;
    }
    const backupData = {
        orders: orders.map(({ id, ...rest }) => rest),
        transactions: transactions.map(({ id, ...rest }) => rest)
    };
    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.download = `backup-completo-${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    localStorage.setItem(`lastAutoBackupTimestamp_${userCompanyId}`, Date.now().toString());
    UI.showInfoModal("Backup completo gerado com sucesso!");
};

const processRestore = async (ordersToRestore, transactionsToRestore) => {
    const choice = await UI.showConfirmModal("Escolha o modo de importação:", "Adicionar aos existentes", "Substituir tudo");
    if (choice === null) return;
    UI.showInfoModal("Restaurando dados... Por favor, aguarde.");
    if (choice) {
        const batch = writeBatch(db);
        ordersToRestore.forEach(order => batch.set(doc(collection(db, `companies/${userCompanyId}/orders`)), order));
        transactionsToRestore.forEach(t => batch.set(doc(collection(db, `companies/${userCompanyId}/transactions`)), t));
        await batch.commit();
        UI.showInfoModal(`${ordersToRestore.length} pedido(s) e ${transactionsToRestore.length} lançamento(s) foram ADICIONADOS.`);
    } else {
        const confirmReplace = await UI.showConfirmModal("ATENÇÃO: Isto vai APAGAR TODOS os dados atuais. A ação NÃO PODE SER DESFEITA. Continuar?", "Sim, substituir tudo", "Cancelar");
        if (confirmReplace) {
            const deleteBatch = writeBatch(db);
            getAllOrders().forEach(o => deleteBatch.delete(doc(db, `companies/${userCompanyId}/orders`, o.id)));
            getAllTransactions().forEach(t => deleteBatch.delete(doc(db, `companies/${userCompanyId}/transactions`, t.id)));
            await deleteBatch.commit();
            const addBatch = writeBatch(db);
            ordersToRestore.forEach(order => addBatch.set(doc(collection(db, `companies/${userCompanyId}/orders`)), order));
            transactionsToRestore.forEach(t => addBatch.set(doc(collection(db, `companies/${userCompanyId}/transactions`)), t));
            await addBatch.commit();
            UI.showInfoModal(`Dados substituídos com sucesso.`);
        }
    }
};

const handleRestore = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (typeof data !== 'object' || data === null || (!data.orders && !data.transactions)) {
                 UI.showInfoModal("Arquivo de backup inválido ou em formato incorreto.");
                 return;
            }
            await processRestore(data.orders || [], data.transactions || []);
        } catch (error) {
            console.error("Erro ao processar backup:", error);
            UI.showInfoModal("Arquivo de backup inválido ou corrompido.");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};

const triggerAutoBackupIfNeeded = () => {
    const key = `lastAutoBackupTimestamp_${userCompanyId}`;
    const lastBackup = localStorage.getItem(key);
    if (!lastBackup) return;
    const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000;
    if ((Date.now() - parseInt(lastBackup)) > sevenDaysInMillis) {
        UI.showInfoModal("Backup semi-automático iniciado. Seu último backup foi há mais de 7 dias.");
        handleBackup();
    }
};

const checkBackupReminder = () => {
    const key = `lastAutoBackupTimestamp_${userCompanyId}`;
    const lastBackup = localStorage.getItem(key);
    if (!lastBackup) return;
    const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000;
    if ((Date.now() - parseInt(lastBackup)) > sevenDaysInMillis) {
        UI.DOM.backupReminderBanner.classList.remove('hidden');
    }
};

const collectFormData = () => {
    const data = {
        clientName: UI.DOM.clientName.value, clientPhone: UI.DOM.clientPhone.value, orderStatus: UI.DOM.orderStatus.value,
        orderDate: UI.DOM.orderDate.value, deliveryDate: UI.DOM.deliveryDate.value, generalObservation: UI.DOM.generalObservation.value,
        parts: [], downPayment: parseFloat(UI.DOM.downPayment.value) || 0, discount: parseFloat(UI.DOM.discount.value) || 0,
        paymentMethod: UI.DOM.paymentMethod.value, mockupUrls: Array.from(UI.DOM.existingFilesContainer.querySelectorAll('a')).map(a => a.href)
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
};

// ========================================================
// PARTE 6: EVENT LISTENERS (A "COLA" DA APLICAÇÃO)
// ========================================================

// --- Inicialização e Eventos Globais ---
window.addEventListener('load', () => UI.handleCookieConsent());
['mousemove', 'keydown', 'click', 'scroll'].forEach(event => window.addEventListener(event, resetIdleTimer));

// --- Autenticação e Navegação Principal ---
UI.DOM.loginForm.addEventListener('submit', (e) => { e.preventDefault(); handleLogin(UI.DOM.loginEmail.value, UI.DOM.loginPassword.value); });
UI.DOM.forgotPasswordBtn.addEventListener('click', handleForgotPassword);
UI.DOM.logoutBtn.addEventListener('click', handleLogout);

UI.DOM.financeDashboardBtn.addEventListener('click', () => {
    currentDashboardView = currentDashboardView === 'orders' ? 'finance' : 'orders';
    UI.DOM.ordersDashboard.classList.toggle('hidden', currentDashboardView !== 'orders');
    UI.DOM.financeDashboard.classList.toggle('hidden', currentDashboardView === 'orders');
    UI.updateNavButton(currentDashboardView);
    if (currentDashboardView === 'finance') {
        // Renderiza o dashboard financeiro (KPIs e lista) ao trocar para esta view
        UI.renderFinanceDashboard(getAllTransactions(), userBankBalanceConfig);
    } else {
        // Renderiza os pedidos ao trocar para esta view
        UI.renderOrders(getAllOrders(), currentOrdersView);
    }
});

UI.DOM.userMenuBtn.addEventListener('click', () => UI.DOM.userDropdown.classList.toggle('hidden'));
document.addEventListener('click', (e) => { 
    if (UI.DOM.userMenuBtn && !UI.DOM.userMenuBtn.parentElement.contains(e.target)) {
        UI.DOM.userDropdown.classList.add('hidden');
    }
});

// --- Menu Dropdown do Usuário ---
UI.DOM.toggleViewBtn.addEventListener('click', () => {
    currentOrdersView = currentOrdersView === 'pending' ? 'delivered' : 'pending';
    UI.DOM.toggleViewBtn.textContent = currentOrdersView === 'pending' ? 'Ver Entregues' : 'Ver Pendentes';
    // Faz uma renderização completa com base no cache local ao trocar de view
    UI.renderOrders(getAllOrders(), currentOrdersView);
});
UI.DOM.backupBtn.addEventListener('click', handleBackup);
UI.DOM.restoreFileInput.addEventListener('change', handleRestore);
UI.DOM.requestDeletionBtn.addEventListener('click', async () => { 
    const confirmed = await UI.showConfirmModal("Isto registrará uma solicitação. Envie um e-mail ao administrador para formalizar. Continuar?", "Sim", "Cancelar");
    if (confirmed) {
        UI.showInfoModal(`Para concluir, envie um e-mail para paglucrobr@gmail.com solicitando a remoção da sua conta.`);
    }
});
UI.DOM.cookieAcceptBtn.addEventListener('click', () => { localStorage.setItem('cookieConsent', 'true'); UI.DOM.cookieBanner.classList.add('hidden'); });
UI.DOM.backupNowBtn.addEventListener('click', () => { handleBackup(); UI.DOM.backupReminderBanner.classList.add('hidden'); });
UI.DOM.dismissBackupReminderBtn.addEventListener('click', () => UI.DOM.backupReminderBanner.classList.add('hidden'));

// --- Funcionalidades de Pedidos ---
UI.DOM.addOrderBtn.addEventListener('click', () => { 
    partCounter = 0; 
    UI.resetForm(); 
    UI.DOM.orderModal.classList.remove('hidden'); 
});

UI.DOM.orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.DOM.saveBtn.disabled = true; 
    UI.DOM.uploadIndicator.classList.remove('hidden');
    
    try {
        const files = UI.DOM.mockupFiles.files;
        const uploadPromises = Array.from(files).map(file => fileToBase64(file).then(uploadToImgBB));
        const newUrls = (await Promise.all(uploadPromises)).filter(Boolean);
        
        const orderData = collectFormData();
        orderData.mockupUrls.push(...newUrls);
        
        const orderId = UI.DOM.orderId.value;
        const savedOrderId = await saveOrder(orderData, orderId);
        
        UI.DOM.orderModal.classList.add('hidden');
        
        if (orderData.orderStatus === 'Finalizado' || orderData.orderStatus === 'Entregue') {
            const generate = await UI.showConfirmModal("Pedido salvo com sucesso! Deseja gerar o recibo de quitação?", "Sim, gerar recibo", "Não, obrigado");
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

UI.DOM.ordersList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    const order = getOrderById(id);
    if (!order) return;

    if (btn.classList.contains('edit-btn')) {
        partCounter = 0;
        partCounter = UI.populateFormForEdit(order, partCounter);
    } else if (btn.classList.contains('replicate-btn')) {
        partCounter = 0;
        partCounter = UI.populateFormForEdit(order, partCounter);
        // Resetar campos para modo de replicação
        UI.DOM.orderId.value = ''; 
        UI.DOM.modalTitle.textContent = 'Novo Pedido (Replicado)';
        UI.DOM.orderStatus.value = 'Pendente'; 
        UI.DOM.orderDate.value = new Date().toISOString().split('T')[0];
        UI.DOM.deliveryDate.value = ''; 
        UI.DOM.discount.value = ''; 
        UI.DOM.downPayment.value = '';
        UI.updateFinancials();
    } else if (btn.classList.contains('delete-btn')) {
        UI.showConfirmModal("Tem certeza que deseja excluir este pedido?", "Excluir", "Cancelar")
          .then(confirmed => {
              if (confirmed) deleteOrder(id);
          });
    } else if (btn.classList.contains('view-btn')) {
        UI.viewOrder(order);
    } else if (btn.classList.contains('settle-and-deliver-btn')) {
        UI.showConfirmModal(
            "Tem certeza de que deseja quitar e marcar este pedido como 'Entregue'?",
            "Sim, Quitar e Entregar",
            "Cancelar"
        ).then(confirmed => {
            if (confirmed) {
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

                const updatedOrder = { ...order };
                updatedOrder.downPayment = totalValue;
                updatedOrder.orderStatus = 'Entregue';

                saveOrder(updatedOrder, id)
                    .then(() => {
                        UI.showInfoModal("Pedido quitado e movido para 'Entregues' com sucesso!");
                    })
                    .catch(error => {
                        console.error("Erro ao quitar e entregar pedido:", error);
                        UI.showInfoModal("Ocorreu um erro ao atualizar o pedido.");
                    });
            }
        });
    }
});

UI.DOM.viewModal.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.id === 'closeViewBtn') { 
        UI.DOM.viewModal.classList.add('hidden'); 
        UI.DOM.viewModal.innerHTML = ''; 
    }
    if (btn.id === 'comprehensivePdfBtn') {
        generateComprehensivePdf(btn.dataset.id, getAllOrders(), userCompanyName, UI.showInfoModal);
    }
});

// --- Interações dentro do Modal de Pedidos ---
UI.DOM.cancelBtn.addEventListener('click', () => UI.DOM.orderModal.classList.add('hidden'));
UI.DOM.addPartBtn.addEventListener('click', () => { partCounter++; UI.addPart({}, partCounter); });
UI.DOM.downPayment.addEventListener('input', UI.updateFinancials);
UI.DOM.discount.addEventListener('input', UI.updateFinancials);

UI.DOM.clientPhone.addEventListener('input', (e) => {
  e.target.value = UI.formatPhoneNumber(e.target.value);
});

UI.DOM.partsContainer.addEventListener('click', (e) => { 
    const btn = e.target.closest('button.manage-options-btn'); 
    if (btn) { 
        currentOptionType = btn.dataset.type; 
        UI.openOptionsModal(currentOptionType, getOptionsFromStorage(currentOptionType)); 
    } 
});
UI.DOM.existingFilesContainer.addEventListener('click', (e) => { 
    if (e.target.classList.contains('remove-mockup-btn')) {
        e.target.parentElement.remove(); 
    }
});

// --- Funcionalidades Financeiras ---
const handleEditTransaction = (id) => {
    const transaction = getAllTransactions().find(t => t.id === id);
    if (!transaction) return;

    UI.DOM.transactionId.value = transaction.id; 
    UI.DOM.transactionDate.value = transaction.date; 
    UI.DOM.transactionDescription.value = transaction.description;
    UI.DOM.transactionAmount.value = transaction.amount; 
    UI.DOM.transactionType.value = transaction.type; 
    UI.DOM.transactionCategory.value = transaction.category || '';
    
    UI.updateSourceSelectionUI(transaction.source || 'banco');
    
    const isIncome = transaction.type === 'income';
    UI.DOM.transactionStatusContainer.classList.toggle('hidden', !isIncome);
    if (isIncome) {
        (transaction.status === 'a_receber' ? UI.DOM.a_receber : UI.DOM.pago).checked = true;
    }
    
    UI.DOM.transactionModalTitle.textContent = isIncome ? 'Editar Entrada' : 'Editar Despesa';
    UI.DOM.transactionModal.classList.remove('hidden');
};

UI.DOM.addIncomeBtn.addEventListener('click', () => { 
    UI.DOM.transactionForm.reset(); 
    UI.DOM.transactionId.value = ''; 
    UI.DOM.transactionType.value = 'income'; 
    UI.DOM.transactionModalTitle.textContent = 'Nova Entrada'; 
    UI.DOM.transactionDate.value = new Date().toISOString().split('T')[0]; 
    UI.DOM.transactionStatusContainer.classList.remove('hidden'); 
    UI.DOM.pago.checked = true; 
    UI.updateSourceSelectionUI('banco'); 
    UI.DOM.transactionModal.classList.remove('hidden'); 
});

UI.DOM.addExpenseBtn.addEventListener('click', () => { 
    UI.DOM.transactionForm.reset(); 
    UI.DOM.transactionId.value = ''; 
    UI.DOM.transactionType.value = 'expense'; 
    UI.DOM.transactionModalTitle.textContent = 'Nova Despesa'; 
    UI.DOM.transactionDate.value = new Date().toISOString().split('T')[0]; 
    UI.DOM.transactionStatusContainer.classList.add('hidden'); 
    UI.updateSourceSelectionUI('banco'); 
    UI.DOM.transactionModal.classList.remove('hidden'); 
});

UI.DOM.transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedSourceEl = UI.DOM.transactionSourceContainer.querySelector('.source-selector.active');
    if (!selectedSourceEl) {
        UI.showInfoModal("Por favor, selecione a Origem (Banco ou Caixa).");
        return;
    }
    const data = {
        date: UI.DOM.transactionDate.value,
        description: UI.DOM.transactionDescription.value,
        amount: parseFloat(UI.DOM.transactionAmount.value),
        type: UI.DOM.transactionType.value,
        category: UI.DOM.transactionCategory.value.trim(),
        source: selectedSourceEl.dataset.source,
        status: UI.DOM.transactionType.value === 'income' 
            ? (UI.DOM.a_receber.checked ? 'a_receber' : 'pago') 
            : 'pago'
    };
    if (!data.date || !data.description || isNaN(data.amount) || data.amount <= 0) {
        UI.showInfoModal("Por favor, preencha todos os campos com valores válidos.");
        return;
    }
    try {
        await saveTransaction(data, UI.DOM.transactionId.value);
        UI.DOM.transactionModal.classList.add('hidden');
    } catch (error) {
        console.error("Erro ao salvar transação:", error);
        UI.showInfoModal("Não foi possível salvar o lançamento. Verifique sua conexão e tente novamente.");
    }
});

UI.DOM.transactionsList.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !btn.dataset.id) return;
    
    const id = btn.dataset.id;
    if (btn.classList.contains('edit-transaction-btn')) {
        handleEditTransaction(id);
    } else if (btn.classList.contains('delete-transaction-btn')) {
        UI.showConfirmModal("Tem certeza que deseja excluir este lançamento?", "Excluir", "Cancelar")
          .then(ok => ok && deleteTransaction(id));
    } else if (btn.classList.contains('mark-as-paid-btn')) {
        markTransactionAsPaid(id);
    }
});

// Filtros do Dashboard Financeiro - agora renderizam TUDO (KPIs e Lista)
UI.DOM.periodFilter.addEventListener('change', () => { 
    UI.DOM.customPeriodContainer.classList.toggle('hidden', UI.DOM.periodFilter.value !== 'custom'); 
    UI.renderFinanceDashboard(getAllTransactions(), userBankBalanceConfig); 
});

[UI.DOM.startDateInput, UI.DOM.endDateInput, UI.DOM.transactionSearchInput].forEach(element => {
    if(element) element.addEventListener('input', () => UI.renderFinanceDashboard(getAllTransactions(), userBankBalanceConfig));
});
// ---

UI.DOM.adjustBalanceBtn.addEventListener('click', () => {
    UI.DOM.initialBalanceInput.value = (userBankBalanceConfig.initialBalance || 0).toFixed(2);
    UI.DOM.initialBalanceModal.classList.remove('hidden');
});

UI.DOM.saveBalanceBtn.addEventListener('click', async () => {
    const newBalance = parseFloat(UI.DOM.initialBalanceInput.value);
    if (isNaN(newBalance)) {
        UI.showInfoModal("Por favor, insira um valor numérico válido.");
        return;
    }
    await saveInitialBalance(newBalance);
    userBankBalanceConfig.initialBalance = newBalance;
    // Renderiza KPIs e lista, pois o saldo em conta mudou
    UI.renderFinanceDashboard(getAllTransactions(), userBankBalanceConfig);
    UI.DOM.initialBalanceModal.classList.add('hidden');
});

// --- Listeners de Modais Genéricos e Opções ---
[UI.DOM.infoModalCloseBtn, UI.DOM.cancelTransactionBtn, UI.DOM.cancelBalanceBtn, UI.DOM.closeOptionsModalBtn].forEach(button => {
    if (button) button.addEventListener('click', () => button.closest('.fixed').classList.add('hidden'));
});

UI.DOM.addOptionBtn.addEventListener('click', () => {
    const newOption = UI.DOM.newOptionInput.value.trim();
    if (newOption && currentOptionType) {
        let options = getOptionsFromStorage(currentOptionType);
        if (!options.includes(newOption)) {
            options.push(newOption);
            saveOptionsToStorage(currentOptionType, options);
            UI.populateDatalists(getOptionsFromStorage('partTypes'), getOptionsFromStorage('materialTypes'));
            UI.openOptionsModal(currentOptionType, options);
            UI.DOM.newOptionInput.value = '';
        }
    }
});

UI.DOM.optionsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-option-btn')) {
        let options = getOptionsFromStorage(currentOptionType);
        options.splice(e.target.dataset.index, 1);
        saveOptionsToStorage(currentOptionType, options);
        UI.populateDatalists(getOptionsFromStorage('partTypes'), getOptionsFromStorage('materialTypes'));
        UI.openOptionsModal(currentOptionType, options);
    }
});

// --- Tabela de Preços ---
UI.DOM.priceTableBtn.addEventListener('click', () => { 
    // Renderiza a tabela com o cache local atual ao abrir
    UI.renderPriceTable(getAllPricingItems(), 'view'); 
    UI.DOM.priceTableModal.classList.remove('hidden'); 
});
UI.DOM.closePriceTableBtn.addEventListener('click', () => UI.DOM.priceTableModal.classList.add('hidden'));
UI.DOM.editPriceTableBtn.addEventListener('click', () => UI.renderPriceTable(getAllPricingItems(), 'edit'));
UI.DOM.cancelPriceTableBtn.addEventListener('click', () => UI.renderPriceTable(getAllPricingItems(), 'view'));

UI.DOM.addPriceItemBtn.addEventListener('click', () => { 
    // Adiciona uma linha "new-" temporária
    const newItem = { id: `new-${Date.now()}` };
    UI.addPriceTableRow(newItem, 'edit');
});

UI.DOM.savePriceTableBtn.addEventListener('click', async () => {
    try {
        const itemsToSave = Array.from(document.getElementById('priceTableBody').querySelectorAll('tr'))
            .map(row => ({ 
                id: row.dataset.id, 
                name: row.querySelector('.price-item-name').value.trim(), 
                description: row.querySelector('.price-item-desc').value.trim(), 
                price: parseFloat(row.querySelector('.price-item-price').value) || 0
            }))
            .filter(item => item.name); // Salva apenas se tiver nome

        await savePriceTableChanges(itemsToSave);
        // O listener reativo (handlePricingChange) cuidará de atualizar a UI
        // Mas mudamos para 'view' mode
        UI.renderPriceTable(getAllPricingItems(), 'view');

    } catch (error) {
        console.error("Erro ao salvar tabela de preços:", error);
        UI.showInfoModal("Não foi possível salvar as alterações.");
    }
});
UI.DOM.priceTableContainer.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-price-item-btn');
    if (deleteBtn) {
        const row = deleteBtn.closest('tr');
        const itemId = row.dataset.id;
        
        if (itemId.startsWith('new-')) {
            // Se for novo (local), apenas remove da UI
            UI.removePriceTableRow(itemId);
        } else {
            // Se for existente, pede confirmação e deleta do DB
            UI.showConfirmModal("Tem certeza que deseja excluir este item?", "Excluir", "Cancelar")
              .then(ok => {
                  if (ok) deletePriceItem(itemId); // O listener cuidará de remover da UI
              });
        }
    }
});
UI.DOM.transactionSourceContainer.addEventListener('click', (e) => {
    const target = e.target.closest('.source-selector');
    if (target) {
        UI.updateSourceSelectionUI(target.dataset.source);
    }
});

// --- Listener Global de Teclado para Atalhos ---
document.addEventListener('keydown', (event) => {
    // Atalho para confirmação (Enter)
    if (event.key === 'Enter') {
        // Confirma Ação (ex: Excluir)
        if (!UI.DOM.confirmModal.classList.contains('hidden')) {
            UI.DOM.confirmOkBtn.click();
            event.preventDefault(); // Previne o comportamento padrão do Enter
        } 
        // Salva Saldo Inicial
        else if (!UI.DOM.initialBalanceModal.classList.contains('hidden')) {
            UI.DOM.saveBalanceBtn.click();
            event.preventDefault();
        } 
        // Envia E-mail de Redefinição de Senha
        else if (!UI.DOM.forgotPasswordModal.classList.contains('hidden')) {
            UI.DOM.sendResetEmailBtn.click();
            event.preventDefault();
        } 
        // Fecha Modal de Informação
        else if (!UI.DOM.infoModal.classList.contains('hidden')) {
            UI.DOM.infoModalCloseBtn.click();
        }
    }

    // Atalho para cancelamento/fechamento (Escape)
    if (event.key === 'Escape') {
        // A ordem aqui é importante, dos modais mais "altos" para os mais "baixos"
        if (!UI.DOM.confirmModal.classList.contains('hidden')) {
            UI.DOM.confirmCancelBtn.click();
        } 
        else if (!UI.DOM.initialBalanceModal.classList.contains('hidden')) {
            UI.DOM.cancelBalanceBtn.click();
        } 
        else if (!UI.DOM.forgotPasswordModal.classList.contains('hidden')) {
            UI.DOM.cancelResetBtn.click();
        } 
        else if (!UI.DOM.viewModal.classList.contains('hidden')) {
            document.getElementById('closeViewBtn')?.click();
        } 
        else if (!UI.DOM.orderModal.classList.contains('hidden')) {
            UI.DOM.cancelBtn.click();
        } 
        else if (!UI.DOM.priceTableModal.classList.contains('hidden')) {
            // Se o botão 'Cancelar' (modo de edição) estiver visível, clica nele. Senão, clica em 'Fechar'.
            if (!UI.DOM.cancelPriceTableBtn.classList.contains('hidden')) {
                UI.DOM.cancelPriceTableBtn.click();
            } else {
                UI.DOM.closePriceTableBtn.click();
            }
        }
        else if (!UI.DOM.transactionModal.classList.contains('hidden')) {
            UI.DOM.cancelTransactionBtn.click();
        }
        else if (!UI.DOM.optionsModal.classList.contains('hidden')) {
            UI.DOM.closeOptionsModalBtn.click();
        }
        else if (!UI.DOM.infoModal.classList.contains('hidden')) {
            UI.DOM.infoModalCloseBtn.click();
        }
    }
});

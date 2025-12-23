// js/main.js
// ========================================================
// ORQUESTRADOR CENTRAL (v5.8.0 - SaaS Manager Logic)
// ========================================================

async function main() {
    
    // Cache Buster para garantir que o navegador baixe as novas versões dos módulos
    const cacheBuster = `?v=${new Date().getTime()}`;

    try {
        // ========================================================
        // 1. IMPORTAÇÕES DINÂMICAS (Lazy Loading)
        // ========================================================

        const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
        const { 
            doc, 
            getDoc, 
            updateDoc, 
            serverTimestamp, 
            writeBatch, 
            collection 
        } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
        
        const { db, auth } = await import(`./firebaseConfig.js${cacheBuster}`);
        const { handleLogout } = await import(`./auth.js${cacheBuster}`);

        // Serviços (Regras de Negócio)
        const { 
            initializeOrderService, 
            saveOrder, 
            deleteOrder, 
            getOrderById, 
            getAllOrders, 
            cleanupOrderService,
            calculateTotalPendingRevenue,   
            updateOrderDiscountFromFinance  
        } = await import(`./services/orderService.js${cacheBuster}`);
        
        const { 
            initializeFinanceService, 
            saveTransaction, 
            deleteTransaction, 
            markTransactionAsPaid, 
            saveInitialBalance, 
            getAllTransactions, 
            cleanupFinanceService, 
            getTransactionByOrderId,        
            getTransactionsByOrderId,       
            deleteAllTransactionsByOrderId,
            getTransactionById              
        } = await import(`./services/financeService.js${cacheBuster}`);
        
        const { 
            initializePricingService, 
            savePriceTableChanges, 
            deletePriceItem, 
            getAllPricingItems, 
            cleanupPricingService 
        } = await import(`./services/pricingService.js${cacheBuster}`);
        
        const { initializeIdleTimer } = await import(`./utils.js${cacheBuster}`);
        const UI = await import(`./ui.js${cacheBuster}`);

        // Listeners (Interações do Usuário)
        const { initializeAuthListeners } = await import(`./listeners/authListeners.js${cacheBuster}`);
        const { initializeNavigationListeners } = await import(`./listeners/navigationListeners.js${cacheBuster}`);
        const { initializeOrderListeners } = await import(`./listeners/orderListeners.js${cacheBuster}`);
        const { initializeFinanceListeners } = await import(`./listeners/financeListeners.js${cacheBuster}`);
        const { initializeModalAndPricingListeners } = await import(`./listeners/modalAndPricingListeners.js${cacheBuster}`);


        // ========================================================
        // 2. ESTADO GLOBAL
        // ========================================================

        let userCompanyId = null;
        let userCompanyName = null;
        let userBankBalanceConfig = { initialBalance: 0 };
        let isAdminUser = false; 

        let currentDashboardView = 'orders';
        let currentOrdersView = 'pending';
        let partCounter = 0;
        let currentOptionType = ''; 
        
        let orderUpdateDebounce = null;
        let financeUpdateDebounce = null;
        let lastFilterValue = 'thisMonth';

        const defaultOptions = {
            partTypes: ['Gola redonda manga curta', 'Gola redonda manga longa', 'Gola redonda manga longa com capuz', 'Gola redonda manga curta (sublimada na frente)', 'Gola polo manga curta', 'Gola polo manga longa', 'Gola V manga curta', 'Gola V manga longa', 'Short', 'Calça'],
            materialTypes: ['Malha fria', 'Drifity', 'Cacharrel', 'PP', 'Algodão Fio 30', 'TNT drive', 'Piquê', 'Brim']
        };

        // ========================================================
        // 3. RENDERIZAÇÃO SEGURA
        // ========================================================
        
        const safeRenderFinance = (source, transactions, config, pendingValue) => {
            let finalValue = pendingValue ?? 0;
            UI.renderFinanceDashboard(transactions, config, finalValue);
        };

        // ========================================================
        // 4. LÓGICA CORE (Inicialização & SaaS Check)
        // ========================================================
        
        const initializeAppLogic = async (user) => {
            console.log("🚀 [MAIN] Inicializando Sistema...");
            
            // A. Definição de Admin
            const ADMIN_EMAILS = ['admin@paglucro.com', 'saianolucrobr@gmail.com']; 
            if (ADMIN_EMAILS.includes(user.email)) {
                isAdminUser = true;
                console.log("👑 Modo Administrador Ativado");
            }

            // B. Mapeamento de Usuário
            const userMappingRef = doc(db, "user_mappings", user.uid);
            const userMappingSnap = await getDoc(userMappingRef);
            
            if (userMappingSnap.exists()) {
                userCompanyId = userMappingSnap.data().companyId;
                const companyRef = doc(db, "companies", userCompanyId);
                const companySnap = await getDoc(companyRef);

                if (companySnap.exists()) {
                    const companyData = companySnap.data();
                    
                    // ============================================================
                    // 🛡️ SEGURANÇA AVANÇADA SAAS (Bloqueio & Vencimento)
                    // ============================================================

                    // 1. Exclusão Lógica ou Bloqueio Manual
                    if (companyData.isDeleted === true || companyData.isBlocked === true) {
                        if (!isAdminUser) {
                            console.warn("🚫 Acesso negado: Conta bloqueada ou excluída.");
                            document.getElementById('blockedModal').classList.remove('hidden');
                            document.getElementById('blockedLogoutBtn').onclick = handleLogout;
                            return; // Encerra execução (não carrega dados)
                        }
                    }

                    // 2. Verificação de Assinatura (Grace Period)
                    if (!isAdminUser && !companyData.isLifetime && companyData.dueDate) {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        
                        const [y, m, d] = companyData.dueDate.split('-').map(Number);
                        const dueDate = new Date(y, m - 1, d);
                        
                        // Calcula dias de atraso
                        const diffTime = today - dueDate;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays > 5) {
                            // CASO CRÍTICO: Vencido há mais de 5 dias -> BLOQUEIO
                            console.warn(`🚫 Plano vencido há ${diffDays} dias.`);
                            document.getElementById('blockedModal').classList.remove('hidden');
                            document.getElementById('blockedLogoutBtn').onclick = handleLogout;
                            return; // Encerra execução
                        } 
                        else if (diffDays > 0) {
                            // CASO ALERTA: Vencido entre 1 e 5 dias -> AVISO (Permite uso)
                            console.warn(`⚠️ Tolerância: Vencido há ${diffDays} dias.`);
                            document.getElementById('paymentWarningModal').classList.remove('hidden');
                        }
                    }

                    // 3. O Espião (Último Acesso) & Correção de Email
                    updateDoc(companyRef, { 
                        lastAccess: serverTimestamp(),
                        email: user.email 
                    }).catch(e => console.warn("Erro ao rastrear acesso:", e));

                    // 4. Mensageria Inteligente (Lê e apaga)
                    if (companyData.adminMessage && companyData.adminMessage.trim() !== "") {
                        UI.showInfoModal(`🔔 MENSAGEM DO SUPORTE:\n\n${companyData.adminMessage}`);
                        
                        // Limpa a mensagem no banco para não repetir
                        updateDoc(companyRef, { adminMessage: "" })
                            .catch(e => console.error("Erro ao limpar mensagem lida:", e));
                    }

                    // ============================================================
                    // FIM DA LÓGICA DE SEGURANÇA
                    // ============================================================

                    userCompanyName = companyData.companyName || user.email;
                    userBankBalanceConfig = companyData.bankBalanceConfig || { initialBalance: 0 };
                } else {
                    userCompanyName = user.email; 
                    userBankBalanceConfig = { initialBalance: 0 };
                }
                
                // Configuração da UI após passar pela segurança
                UI.DOM.userEmail.textContent = userCompanyName;
                if (UI.DOM.periodFilter) UI.DOM.periodFilter.value = 'thisMonth';

                console.log("🔌 [MAIN] Conectando serviços...");
                initializeOrderService(userCompanyId, handleOrderChange, () => currentOrdersView);
                initializeFinanceService(userCompanyId, handleFinanceChange, () => userBankBalanceConfig);
                initializePricingService(userCompanyId, handlePricingChange); 
                
                const now = new Date();
                const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                const pendingRevenue = calculateTotalPendingRevenue ? calculateTotalPendingRevenue(startOfThisMonth, endOfThisMonth) : 0;
                
                // Renderização Inicial
                UI.renderOrders(getAllOrders(), currentOrdersView);
                safeRenderFinance('Init', getAllTransactions(), userBankBalanceConfig, pendingRevenue);
                initializeIdleTimer(UI.DOM, handleLogout);
                initializeAndPopulateDatalists(); 
                UI.updateNavButton(currentDashboardView);
                
                // Exibição do App e Carregamento do Admin
                setTimeout(async () => {
                    UI.DOM.authContainer.classList.add('hidden'); 
                    UI.DOM.app.classList.remove('hidden');
                    
                    if (isAdminUser) {
                        console.log("👑 Carregando módulo Admin v2...");
                        try {
                            const { initializeAdminPanel } = await import(`./admin.js${cacheBuster}`);
                            initializeAdminPanel();
                        } catch (e) {
                            console.error("Erro ao carregar painel admin:", e);
                        }
                    }
                    
                    // Refresh de segurança nos dados financeiros
                    setTimeout(async () => {
                        if (UI.DOM.periodFilter && !UI.DOM.periodFilter.value) UI.DOM.periodFilter.value = 'thisMonth';
                        if (calculateTotalPendingRevenue) {
                            const dates = getCurrentDashboardDates(); 
                            const freshPending = calculateTotalPendingRevenue(dates.startDate, dates.endDate);
                            safeRenderFinance('SafetyRefresh', getAllTransactions(), userBankBalanceConfig, freshPending);
                        }
                    }, 2000); 

                    requestAnimationFrame(() => requestAnimationFrame(() => checkBackupReminder()));
                }, 0);

            } else {
                UI.showInfoModal("Erro: Usuário não associado a nenhuma empresa. Fale com o suporte.");
                handleLogout();
            }
        };

        const cleanupApplication = () => {
            UI.DOM.app.classList.add('hidden');
            UI.DOM.authContainer.classList.remove('hidden');
            
            // Garante que os modais de bloqueio sumam ao deslogar
            document.getElementById('blockedModal').classList.add('hidden');
            document.getElementById('paymentWarningModal').classList.add('hidden');
            
            cleanupOrderService();
            cleanupFinanceService();
            cleanupPricingService();
            
            userCompanyId = null;
            userCompanyName = null;
            userBankBalanceConfig = { initialBalance: 0 };
            isAdminUser = false;
        };

        // Ouvinte de Autenticação
        onAuthStateChanged(auth, (user) => {
            if (user) {
                initializeAppLogic(user);
            } else {
                cleanupApplication();
            }
        });


        // ========================================================
        // 5. HANDLERS E HELPERS
        // ========================================================

        const getCurrentDashboardDates = () => {
            const now = new Date();
            const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            if (!UI.DOM.periodFilter) return { startDate: defaultStart, endDate: defaultEnd };
            
            let filter = UI.DOM.periodFilter.value || 'thisMonth';
            if (filter !== lastFilterValue) lastFilterValue = filter;

            let startDate = null, endDate = null;

            if (filter === 'custom') {
                if (UI.DOM.startDateInput.value) startDate = new Date(UI.DOM.startDateInput.value + 'T00:00:00');
                if (UI.DOM.endDateInput.value) endDate = new Date(UI.DOM.endDateInput.value + 'T23:59:59');
                if (!startDate || !endDate) { startDate = defaultStart; endDate = defaultEnd; }
            } else {
                switch(filter) {
                    case 'thisMonth': startDate = defaultStart; endDate = defaultEnd; break;
                    case 'lastMonth': 
                        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                        break;
                    case 'thisYear': 
                        startDate = new Date(now.getFullYear(), 0, 1);
                        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                        break;
                    default: startDate = defaultStart; endDate = defaultEnd;
                }
            }
            return { startDate, endDate };
        };

        const handleOrderChange = (type, order, viewType) => {
            const isDelivered = order.orderStatus === 'Entregue';
            const shouldShow = (viewType === 'pending' && !isDelivered) || (viewType === 'delivered' && isDelivered);

            if (type === 'removed') UI.removeOrderCard(order.id);
            else if (shouldShow) {
                if (type === 'added') UI.addOrderCard(order, viewType);
                else UI.updateOrderCard(order, viewType);
            } else {
                UI.removeOrderCard(order.id);
            }

            if (calculateTotalPendingRevenue) {
                if (orderUpdateDebounce) clearTimeout(orderUpdateDebounce);
                orderUpdateDebounce = setTimeout(() => {
                    const { startDate, endDate } = getCurrentDashboardDates();
                    const pendingRevenue = calculateTotalPendingRevenue(startDate, endDate);
                    safeRenderFinance('OrderChange', getAllTransactions(), userBankBalanceConfig, pendingRevenue);
                }, 200);
            }
        };

        const handleFinanceChange = (type, transaction, config) => {
            const { startDate, endDate } = getCurrentDashboardDates();
            const tDate = new Date(transaction.date + 'T00:00:00');
            const term = UI.DOM.transactionSearchInput.value.toLowerCase();
            
            const passesDate = (!startDate || tDate >= startDate) && (!endDate || tDate <= endDate);
            const passesSearch = transaction.description.toLowerCase().includes(term);

            if (!passesDate || !passesSearch) {
                if (type !== 'added') UI.removeTransactionRow(transaction.id);
            } else {
                if (type === 'removed') UI.removeTransactionRow(transaction.id);
                else if (type === 'added') UI.addTransactionRow(transaction);
                else UI.updateTransactionRow(transaction);
            }

            if (calculateTotalPendingRevenue) {
                if (financeUpdateDebounce) clearTimeout(financeUpdateDebounce);
                financeUpdateDebounce = setTimeout(() => {
                    const currentDates = getCurrentDashboardDates();
                    const pendingRevenue = calculateTotalPendingRevenue(currentDates.startDate, currentDates.endDate);
                    safeRenderFinance('FinanceChange', getAllTransactions(), config, pendingRevenue);
                }, 250);
            }
        };

        const handlePricingChange = (type, item) => {
            const isEditMode = !UI.DOM.editPriceTableBtn.classList.contains('hidden');
            const mode = isEditMode ? 'view' : 'edit';
            if (type === 'removed') UI.removePriceTableRow(item.id);
            else if (type === 'added') UI.addPriceTableRow(item, mode);
            else UI.updatePriceTableRow(item, mode);
        };

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

        // Backup & Restore
        const handleBackup = () => {
            const orders = getAllOrders();
            const transactions = getAllTransactions();
            if (!orders.length && !transactions.length) return UI.showInfoModal("Não há dados para backup.");
            
            const dataStr = JSON.stringify({ orders, transactions }, null, 2);
            const url = URL.createObjectURL(new Blob([dataStr], { type: 'application/json' }));
            const link = document.createElement('a');
            link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            localStorage.setItem(`lastAutoBackupTimestamp_${userCompanyId}`, Date.now().toString());
            UI.showInfoModal("Backup realizado com sucesso!");
        };

        const handleRestore = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data || (!data.orders && !data.transactions)) throw new Error("Formato inválido");
                    
                    const choice = await UI.showConfirmModal("Importar Backup:", "Adicionar aos existentes", "Substituir tudo");
                    if (choice === null) return;
                    
                    UI.showInfoModal("Processando restauração...");
                    const batch = writeBatch(db);
                    const ordersRef = collection(db, `companies/${userCompanyId}/orders`);
                    const transRef = collection(db, `companies/${userCompanyId}/transactions`);

                    if (!choice) { // Substituir tudo
                        getAllOrders().forEach(o => batch.delete(doc(ordersRef, o.id)));
                        getAllTransactions().forEach(t => batch.delete(doc(transRef, t.id)));
                    }

                    (data.orders || []).forEach(o => batch.set(doc(ordersRef), o));
                    (data.transactions || []).forEach(t => batch.set(doc(transRef), t));
                    
                    await batch.commit();
                    UI.showInfoModal("Dados restaurados com sucesso!");
                } catch (error) {
                    console.error(error);
                    UI.showInfoModal("Erro ao processar arquivo de backup.");
                }
            };
            reader.readText(file);
            event.target.value = '';
        };

        const checkBackupReminder = () => {
            const last = localStorage.getItem(`lastAutoBackupTimestamp_${userCompanyId}`);
            if (!last || (Date.now() - parseInt(last)) > (7 * 24 * 60 * 60 * 1000)) {
                UI.DOM.backupReminderBanner.classList.remove('hidden', 'toast-enter');
                void UI.DOM.backupReminderBanner.offsetWidth;
                UI.DOM.backupReminderBanner.classList.add('toast-enter');
            }
        };

        // Inicialização dos Listeners
        initializeAuthListeners(UI);
        initializeNavigationListeners(UI, {
            handleBackup,
            handleRestore,
            getOrders: getAllOrders,
            getTransactions: getAllTransactions,
            getConfig: () => userBankBalanceConfig,
            getState: () => ({ currentDashboardView, currentOrdersView }),
            setState: (newState) => {
                if (newState.currentDashboardView) currentDashboardView = newState.currentDashboardView;
                if (newState.currentOrdersView) currentOrdersView = newState.currentOrdersView;
            }
        });

        initializeOrderListeners(UI, {
            getState: () => ({ partCounter }),
            setState: (newState) => {
                if (newState.partCounter !== undefined) partCounter = newState.partCounter;
                if (newState.currentOptionType) currentOptionType = newState.currentOptionType;
            },
            getOptionsFromStorage,
            services: {
                saveOrder, getOrderById, getAllOrders, deleteOrder,
                saveTransaction, deleteTransaction, getTransactionByOrderId,        
                getTransactionsByOrderId, deleteAllTransactionsByOrderId
            },
            userCompanyName: () => userCompanyName 
        });

        const FinanceUIProxy = Object.create(UI);
        FinanceUIProxy.renderFinanceDashboard = (transactions, config) => {
            const { startDate, endDate } = getCurrentDashboardDates();
            safeRenderFinance('ListenerProxy', transactions, config, calculateTotalPendingRevenue(startDate, endDate));
        };

        initializeFinanceListeners(FinanceUIProxy, { 
            services: {
                saveTransaction, deleteTransaction, markTransactionAsPaid,
                getAllTransactions, saveInitialBalance, getTransactionById,              
                calculateTotalPendingRevenue, updateOrderDiscountFromFinance   
            },
            getConfig: () => userBankBalanceConfig,
            setConfig: (s) => { if (s.initialBalance !== undefined) userBankBalanceConfig.initialBalance = s.initialBalance; }
        });

        initializeModalAndPricingListeners(UI, {
            services: { getAllPricingItems, savePriceTableChanges, deletePriceItem },
            helpers: { getOptionsFromStorage, saveOptionsToStorage },
            getState: () => ({ currentOptionType })
        });

    } catch (error) {
        console.error("Critical Init Error:", error);
        document.body.innerHTML = `<div style="text-align:center;padding:50px;color:red"><h1>Erro de Inicialização</h1><p>Por favor, limpe o cache do navegador.</p><small>${error.message}</small></div>`;
    }
}
main();

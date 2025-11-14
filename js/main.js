// ========================================================
// PARTE 1: INICIALIZAÇÃO DINÂMICA (v5.7.7 "Bomba Atômica")
// ========================================================

// Esta função 'main' assíncrona agora envolve todo o aplicativo.
// Isso nos permite usar 'await import()' para carregar dinamicamente
// todos os módulos com um cache-buster de timestamp,
// derrotando o cache agressivo do proxy/CDN.

async function main() {
    
    // 1. Gerar o cache-buster.
    // Este é o 'v=timestamp' usado para forçar o recarregamento
    // de todos os módulos dependentes.
    const cacheBuster = `?v=${new Date().getTime()}`;

    try {
        // ========================================================
        // PARTE 1.A: IMPORTAÇÕES DINÂMICAS DE MÓDULOS
        // ========================================================

        // Firebase Core (externo, não precisa de cache-buster local)
        const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
        const { doc, getDoc, writeBatch, collection } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
        
        // Configuração do Firebase (local, precisa de cache-buster)
        const { db, auth } = await import(`./firebaseConfig.js${cacheBuster}`);

        // Módulo de Autenticação
        const { handleLogout } = await import(`./auth.js${cacheBuster}`);

        // Módulos de Serviços de Negócio
        const { initializeOrderService, saveOrder, deleteOrder, getOrderById, getAllOrders, cleanupOrderService } = await import(`./services/orderService.js${cacheBuster}`);
        const { 
            initializeFinanceService, 
            saveTransaction, 
            deleteTransaction, 
            markTransactionAsPaid, 
            saveInitialBalance, 
            getAllTransactions, 
            cleanupFinanceService, 
            getTransactionByOrderId,
            deleteAllTransactionsByOrderId 
        } = await import(`./services/financeService.js${cacheBuster}`);
        const { initializePricingService, savePriceTableChanges, deletePriceItem, getAllPricingItems, cleanupPricingService } = await import(`./services/pricingService.js${cacheBuster}`);

        // Módulo de Utilitários
        const { initializeIdleTimer } = await import(`./utils.js${cacheBuster}`);

        // Módulo de Interface do Usuário (UI)
        // Carrega o "Arquivo-Barril" (ui.js). 
        // O import() dinâmico de um barril retorna o namespace (como o 'UI' que usávamos).
        const UI = await import(`./ui.js${cacheBuster}`);

        // Módulos de Listeners
        const { initializeAuthListeners } = await import(`./listeners/authListeners.js${cacheBuster}`);
        // v5.7.16: Corrigido o erro de digitação de 'cacheBster' para 'cacheBuster'
        const { initializeNavigationListeners } = await import(`./listeners/navigationListeners.js${cacheBuster}`);
        const { initializeOrderListeners } = await import(`./listeners/orderListeners.js${cacheBuster}`);
        const { initializeFinanceListeners } = await import(`./listeners/financeListeners.js${cacheBuster}`);
        const { initializeModalAndPricingListeners } = await import(`./listeners/modalAndPricingListeners.js${cacheBuster}`);


        // ========================================================
        // PARTE 2: ESTADO GLOBAL E CONFIGURAÇÕES DA APLICAÇÃO
        // ========================================================
        // (Sem alterações lógicas nesta seção)

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
        // (v5.7.16: Lógica de ordenação mantida)

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
                initializeOrderService(userCompanyId, handleOrderChange, () => currentOrdersView);
                initializeFinanceService(userCompanyId, handleFinanceChange, () => userBankBalanceConfig);
                initializePricingService(userCompanyId, handlePricingChange); 
                
                // --- RENDERIZAÇÃO INICIAL ---
                UI.renderOrders(getAllOrders(), currentOrdersView);
                UI.renderFinanceDashboard(getAllTransactions(), userBankBalanceConfig);
                
                // --- INICIALIZAÇÃO DE LÓGICA E UI AUXILIAR ---
                initializeIdleTimer(UI.DOM, handleLogout);
                initializeAndPopulateDatalists(); 
                UI.updateNavButton(currentDashboardView);
                
                // --- TORNAR APP VISÍVEL ---
                UI.DOM.authContainer.classList.add('hidden');
                UI.DOM.app.classList.remove('hidden');
                
                // --- CHAMADAS PÓS-RENDERIZAÇÃO (v5.7.16) ---
                // O banner deve ser chamado DEPOIS que #app está visível.
                checkBackupReminder();

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

        // PONTO DE ENTRADA PRINCIPAL (MOVIMENTADO)
        // Agora é chamado *dentro* do 'main', após os imports.
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
        // (Sem alterações lógicas nesta seção)

        const handleOrderChange = (type, order, viewType) => {
            const isDelivered = order.orderStatus === 'Entregue';

            if (viewType === 'pending') {
                if (isDelivered) {
                    UI.removeOrderCard(order.id);
                    return; 
                } else {
                    switch (type) {
                        case 'added': UI.addOrderCard(order, viewType); break;
                        case 'modified': UI.updateOrderCard(order, viewType); break;
                        case 'removed': UI.removeOrderCard(order.id); break;
                    }
                }
            } 
            else if (viewType === 'delivered') {
                if (!isDelivered) {
                    UI.removeOrderCard(order.id);
                    return; 
                } else {
                    switch (type) {
                        case 'added': UI.addOrderCard(order, viewType); break;
                        case 'modified': UI.updateOrderCard(order, viewType); break;
                        case 'removed': UI.removeOrderCard(order.id); break;
                    }
                }
            }
        };

        const handleFinanceChange = (type, transaction, config) => {
            UI.renderFinanceKPIs(getAllTransactions(), config);
            
            const filter = UI.DOM.periodFilter.value;
            const now = new Date();
            let startDate, endDate;

            if (filter === 'custom') {
                startDate = UI.DOM.startDateInput.value ? new Date(UI.DOM.startDateInput.value + 'T00:00:00') : null;
                endDate = UI.DOM.endDateInput.value ? new Date(UI.DOM.endDateInput.value + 'T23:59:59') : null;
            } else {
                // Lógica de filtro de data padrão (thisMonth, lastMonth, thisYear)
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
                if (type === 'modified' || type === 'removed') {
                    UI.removeTransactionRow(transaction.id);
                }
                return; 
            }

            switch (type) {
                case 'added': UI.addTransactionRow(transaction); break;
                case 'modified': UI.updateTransactionRow(transaction); break;
                case 'removed': UI.removeTransactionRow(transaction.id); break;
            }
        };

        const handlePricingChange = (type, item) => {
            const isEditMode = !UI.DOM.editPriceTableBtn.classList.contains('hidden');
            const mode = isEditMode ? 'view' : 'edit';
            
            switch (type) {
                case 'added': UI.addPriceTableRow(item, mode); break;
                case 'modified': UI.updatePriceTableRow(item, mode); break;
                case 'removed': UI.removePriceTableRow(item.id); break;
            }
        };


        // ========================================================
        // PARTE 5: FUNÇÕES DE LÓGICA TRANSVERSAL (Cross-Cutting)
        // ========================================================
        // (Sem alterações lógicas nesta seção)

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
            // ... (código permanece, mas não é chamado)
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
            const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000;

            let needsReminder = false;
            
            if (!lastBackup) {
                // Caso 1: Nunca fez backup
                needsReminder = true;
            } else {
                // Caso 2: O backup está antigo
                if ((Date.now() - parseInt(lastBackup)) > sevenDaysInMillis) {
                    needsReminder = true;
                }
            }

            if (needsReminder) {
                // ========================================================
                // INÍCIO DA CORREÇÃO v5.7.19 (Bug de Repaint v5.7.17)
                // ========================================================
                // DIAGNÓSTICO: As tentativas de 'setTimeout' (v5.7.11) e
                // 'requestAnimationFrame' (v5.7.18) falharam. Isso prova
                // que o bug é um problema de "reflow" extremamente teimoso.
                
                // SOLUÇÃO: Forçar o "reflow" (re-layout) do navegador.
                
                // 1. Removemos a classe. Neste ponto, o DOM é atualizado,
                //    mas o navegador ainda não "pintou" a mudança.
                UI.DOM.backupReminderBanner.classList.remove('hidden');

                // 2. Forçamos o navegador a ler uma propriedade de layout
                //    (como 'offsetWidth'). Isso obriga o navegador a
                //    "flushar" sua fila de renderização e recalcular o
                //    layout, "pintando" a mudança (passo 1) no processo.
                //    A variável '_' é descartada, seu propósito é apenas
                //    forçar a leitura.
                const _ = UI.DOM.backupReminderBanner.offsetWidth;
                // ========================================================
                // FIM DA CORREÇÃO v5.7.19
                // ========================================================
            }
        };

        // ========================================================
        // PARTE 6: INICIALIZAÇÃO DOS EVENT LISTENERS
        // ========================================================
        // (Sem alterações lógicas nesta seção)

        // Delega a anexação de todos os event listeners para módulos especialistas,
        // injetando as dependências necessárias (handlers, serviços e estado).

        initializeAuthListeners();

        initializeNavigationListeners({
            handleBackup,
            handleRestore,
            getOrders: getAllOrders,
            getTransactions: getAllTransactions,
            getConfig: () => userBankBalanceConfig,
            getState: () => ({ currentDashboardView, currentOrdersView }),
            setState: (newState) => {
                if (newState.currentDashboardView !== undefined) {
                    currentDashboardView = newState.currentDashboardView;
                }
                if (newState.currentOrdersView !== undefined) {
                    currentOrdersView = newState.currentOrdersView;
                }
            }
        });

        initializeOrderListeners({
            getState: () => ({ partCounter }),
            setState: (newState) => {
                if (newState.partCounter !== undefined) partCounter = newState.partCounter;
                if (newState.currentOptionType !== undefined) currentOptionType = newState.currentOptionType;
            },
            getOptionsFromStorage,
            services: {
                saveOrder,
                getOrderById,
                getAllOrders,
                deleteOrder,
                saveTransaction,
                deleteTransaction,
                getTransactionByOrderId,
                deleteAllTransactionsByOrderId
            },
            userCompanyName: () => userCompanyName 
        });

        initializeFinanceListeners({
            services: {
                saveTransaction,
                deleteTransaction,
                markTransactionAsPaid,
                getAllTransactions,
                saveInitialBalance
            },
            getConfig: () => userBankBalanceConfig,
            setConfig: (newState) => {
                if (newState.initialBalance !== undefined) {
                    userBankBalanceConfig.initialBalance = newState.initialBalance;
                }
            }
        });

        initializeModalAndPricingListeners({
            services: {
                getAllPricingItems,
                savePriceTableBtn,
                deletePriceItem
            },
            helpers: {
                getOptionsFromStorage,
                saveOptionsToStorage
            },
            getState: () => ({ currentOptionType })
        });

    } catch (error) {
        console.error("Falha crítica ao inicializar o PagLucro Gestor:", error);
        // v5.7.7: Exibe um erro amigável se os módulos falharem ao carregar.
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center; font-family: sans-serif;">
                <h1 style="color: #D90000;">Erro Crítico de Inicialização</h1>
                <p>Não foi possível carregar os componentes da aplicação.</p>
                <p>Isso pode ser um problema de conexão ou um cache corrompido.</p>
                <p>Por favor, tente <strong>limpar o cache do seu navegador (Ctrl+Shift+R ou Cmd+Shift+R)</strong> e recarregar a página.</p>
                <p style="margin-top: 20px; font-size: 0.8em; color: #666;">Detalhe do erro: ${error.message}</p>
            </div>
        `;
    }
}

// ========================================================
// PARTE 7: PONTO DE ENTRADA DA APLICAÇÃO (v5.7.7)
// ========================================================
// Inicia a função 'main' para carregar dinamicamente 
// todos os módulos e iniciar a aplicação.
main();

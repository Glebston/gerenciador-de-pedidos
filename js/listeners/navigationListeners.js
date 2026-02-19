// js/listeners/navigationListeners.js
// ==========================================================
// MÓDULO NAVIGATION LISTENERS (v6.0.0 - BACKDROP STRATEGY)
// Status: SOLUÇÃO DEFINITIVA (Simples e Robusta)
// ==========================================================

import { resetIdleTimer } from '../security/sessionManager.js';

export function initializeNavigationListeners(UI, deps) {

    // --- 1. Eventos Globais de Sistema ---
    window.addEventListener('load', () => {
        if (localStorage.getItem('cookieConsent') !== 'true') {
            if(UI.DOM.cookieBanner) UI.DOM.cookieBanner.classList.remove('hidden');
        }
    });
    
    // Timer de inatividade
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => window.addEventListener(event, resetIdleTimer));

    // --- 2. Navegação Principal ---
    if (UI.DOM.financeDashboardBtn) {
        UI.DOM.financeDashboardBtn.addEventListener('click', () => {
            let { currentDashboardView } = deps.getState();
            currentDashboardView = currentDashboardView === 'orders' ? 'finance' : 'orders';
            deps.setState({ currentDashboardView }); 
            UI.DOM.ordersDashboard.classList.toggle('hidden', currentDashboardView !== 'orders');
            UI.DOM.financeDashboard.classList.toggle('hidden', currentDashboardView === 'orders');
            UI.updateNavButton(currentDashboardView);
            
            if (currentDashboardView === 'finance') {
                UI.renderFinanceDashboard(deps.getTransactions(), deps.getConfig());
            } else {
                const { currentOrdersView } = deps.getState();
                UI.renderOrders(deps.getOrders(), currentOrdersView);
            }
        });
    }

    // --- 3. CONTROLE MESTRE DE CLIQUES (FAB BACKDROP SYSTEM) ---
    
    // Captura os elementos soltos no DOM (Nova Estrutura)
    const fabMainBtn = document.getElementById('fabMainBtn');
    const fabMenu = document.getElementById('fabMenu');
    const fabBackdrop = document.getElementById('fabBackdrop');
    const iconPlus = document.getElementById('fabIconPlus');
    const iconClose = document.getElementById('fabIconClose');

    // Função ÚNICA que abre ou fecha tudo
    const toggleFabSystem = () => {
        if (!fabMenu || !fabBackdrop) return;

        // Verifica se está fechado (contém 'hidden')
        const isClosed = fabMenu.classList.contains('hidden');

        if (isClosed) {
            // ABRIR: Remove 'hidden' do menu e da cortina
            fabMenu.classList.remove('hidden');
            fabBackdrop.classList.remove('hidden');
            
            // Visual do Botão: Fica Vermelho
            if (fabMainBtn) {
                fabMainBtn.classList.remove('bg-blue-600');
                fabMainBtn.classList.add('bg-red-600');
            }
            
            // Animação de Ícones: Some o (+) e aparece o (X)
            if (iconPlus) iconPlus.classList.add('opacity-0', 'rotate-90');
            if (iconClose) iconClose.classList.remove('opacity-0', 'rotate-90');
            
        } else {
            // FECHAR: Adiciona 'hidden' de volta
            fabMenu.classList.add('hidden');
            fabBackdrop.classList.add('hidden');
            
            // Visual do Botão: Volta pra Azul
            if (fabMainBtn) {
                fabMainBtn.classList.remove('bg-red-600');
                fabMainBtn.classList.add('bg-blue-600');
            }
            
            // Animação de Ícones: Volta o (+) e some o (X)
            if (iconPlus) iconPlus.classList.remove('opacity-0', 'rotate-90');
            if (iconClose) iconClose.classList.add('opacity-0', 'rotate-90');
        }
    };

    // Listener A: Clique no Botão Principal
    if (fabMainBtn) {
        fabMainBtn.onclick = (e) => {
            e.stopPropagation(); // Impede que o clique passe para o document
            toggleFabSystem();
        };
    }

    // Listener B: Clique na Cortina Invisível (Fundo)
    if (fabBackdrop) {
        fabBackdrop.onclick = () => {
            toggleFabSystem(); // Clicou fora? Fecha tudo.
        };
    }

    // Listener C: Clique em qualquer opção do menu
    if (fabMenu) {
        fabMenu.addEventListener('click', () => {
            toggleFabSystem(); // Escolheu uma opção? Fecha o menu.
        });
    }

    // --- 4. Dropdown de Usuário (Mantido Simples) ---
    document.addEventListener('click', (e) => {
        if (UI.DOM.userMenuBtn && UI.DOM.userDropdown) {
            if (UI.DOM.userMenuBtn.contains(e.target)) {
                UI.DOM.userDropdown.classList.toggle('hidden');
            } else if (!UI.DOM.userDropdown.contains(e.target)) {
                UI.DOM.userDropdown.classList.add('hidden');
            }
        }
    });

    // --- Outros Listeners (Mantidos) ---
    if (UI.DOM.toggleViewBtn) {
        UI.DOM.toggleViewBtn.addEventListener('click', () => {
            let { currentOrdersView } = deps.getState();
            currentOrdersView = currentOrdersView === 'pending' ? 'delivered' : 'pending';
            deps.setState({ currentOrdersView });
            UI.DOM.toggleViewBtn.textContent = currentOrdersView === 'pending' ? 'Ver Entregues' : 'Ver Pendentes';
            UI.renderOrders(deps.getOrders(), currentOrdersView);
        });
    }
    if (UI.DOM.backupBtn) UI.DOM.backupBtn.addEventListener('click', deps.handleBackup);
    if (UI.DOM.restoreFileInput) UI.DOM.restoreFileInput.addEventListener('change', deps.handleRestore);
    if (UI.DOM.requestDeletionBtn) {
        UI.DOM.requestDeletionBtn.addEventListener('click', async () => { 
            const confirmed = await UI.showConfirmModal("Enviar solicitação?", "Sim", "Cancelar");
            if (confirmed) UI.showInfoModal(`Envie e-mail para paglucrobr@gmail.com`);
        });
    }
    if (UI.DOM.cookieAcceptBtn) {
        UI.DOM.cookieAcceptBtn.addEventListener('click', () => { 
            localStorage.setItem('cookieConsent', 'true'); 
            if(UI.DOM.cookieBanner) UI.DOM.cookieBanner.classList.add('hidden'); 
        });
    }
    if (UI.DOM.backupNowBtn) {
        UI.DOM.backupNowBtn.addEventListener('click', () => { 
            deps.handleBackup(); 
            if(UI.DOM.backupReminderBanner) UI.DOM.backupReminderBanner.classList.add('hidden'); 
        });
    }
    if (UI.DOM.dismissBackupReminderBtn) {
        UI.DOM.dismissBackupReminderBtn.addEventListener('click', () => {
            if(UI.DOM.backupReminderBanner) UI.DOM.backupReminderBanner.classList.add('hidden');
        });
    }
}

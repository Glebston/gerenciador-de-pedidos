
// js/listeners/ navigationListeners.js

// v5.7.21: Removida a importação estática de 'UI'.
// O 'UI' agora é injetado pelo main.js (Orquestrador)
// import * as UI from '../ui.js'; 
import { resetIdleTimer } from '../utils.js'; // Importa o utilitário

/**
 * Inicializa listeners de navegação, menu de usuário e eventos globais da UI.
 * @param {object} UI - O módulo UI (injetado pelo main.js)
 * @param {object} deps - Dependências injetadas (handlers, state, etc.)
 * @param {Function} deps.handleBackup - Handler para o backup
 * @param {Function} deps.handleRestore - Handler para a restauração
 * @param {Function} deps.getOrders - Getter para getAllOrders
 * @param {Function} deps.getTransactions - Getter para getAllTransactions
 * @param {Function} deps.getConfig - Getter para userBankBalanceConfig
 * @param {Function} deps.getState - Getter para o estado da view (currentDashboardView, currentOrdersView)
 * @param {Function} deps.setState - Setter para o estado da view
 */
// v5.7.21: A função agora aceita 'UI' como o primeiro argumento.
export function initializeNavigationListeners(UI, deps) {

    // --- Eventos Globais da Aplicação ---
    // v5.7.21: Corrigido o 'UI.handleCookieConsent()' que estava quebrado
    // (estava usando a UI estática nula)
    window.addEventListener('load', () => {
        if (localStorage.getItem('cookieConsent') !== 'true') {
            UI.DOM.cookieBanner.classList.remove('hidden');
        }
    });
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => window.addEventListener(event, resetIdleTimer));

    // --- Navegação Principal ---
    UI.DOM.financeDashboardBtn.addEventListener('click', () => {
        let { currentDashboardView } = deps.getState();
        
        currentDashboardView = currentDashboardView === 'orders' ? 'finance' : 'orders';
        deps.setState({ currentDashboardView }); // Atualiza o estado central

        UI.DOM.ordersDashboard.classList.toggle('hidden', currentDashboardView !== 'orders');
        UI.DOM.financeDashboard.classList.toggle('hidden', currentDashboardView === 'orders');
        UI.updateNavButton(currentDashboardView);
        
        if (currentDashboardView === 'finance') {
            // Renderiza o dashboard financeiro (KPIs e lista) ao trocar para esta view
            UI.renderFinanceDashboard(deps.getTransactions(), deps.getConfig());
        } else {
            // Renderiza os pedidos ao trocar para esta view
            const { currentOrdersView } = deps.getState();
            UI.renderOrders(deps.getOrders(), currentOrdersView);
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
        let { currentOrdersView } = deps.getState();

        currentOrdersView = currentOrdersView === 'pending' ? 'delivered' : 'pending';
        deps.setState({ currentOrdersView }); // Atualiza o estado central

        UI.DOM.toggleViewBtn.textContent = currentOrdersView === 'pending' ? 'Ver Entregues' : 'Ver Pendentes';
        // Faz uma renderização completa com base no cache local ao trocar de view
        UI.renderOrders(deps.getOrders(), currentOrdersView);
    });

    UI.DOM.backupBtn.addEventListener('click', deps.handleBackup);
    UI.DOM.restoreFileInput.addEventListener('change', deps.handleRestore);

    UI.DOM.requestDeletionBtn.addEventListener('click', async () => { 
        const confirmed = await UI.showConfirmModal("Isto registrará uma solicitação. Envie um e-mail ao administrador para formalizar. Continuar?", "Sim", "Cancelar");
        if (confirmed) {
            UI.showInfoModal(`Para concluir, envie um e-mail para paglucrobr@gmail.com solicitando a remoção da sua conta.`);
        }
    });

    // --- Banners (Cookie & Backup) ---

    UI.DOM.cookieAcceptBtn.addEventListener('click', () => { 
        localStorage.setItem('cookieConsent', 'true'); 
        UI.DOM.cookieBanner.classList.add('hidden'); 
    });
    
    UI.DOM.backupNowBtn.addEventListener('click', () => { 
        deps.handleBackup(); 
        UI.DOM.backupReminderBanner.classList.add('hidden'); 
    });
    
    UI.DOM.dismissBackupReminderBtn.addEventListener('click', () => UI.DOM.backupReminderBanner.classList.add('hidden'));
}

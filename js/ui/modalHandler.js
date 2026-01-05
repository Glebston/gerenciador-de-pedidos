// ===========================================================
// MÓDULO MODAL HANDLER (v4.3.0)
// Responsabilidade: Gerenciar a exibição e lógica de 
// todos os modais da aplicação (Info, Confirm, Quitação, etc.)
// ==========================================================

// Importa o DOM do especialista dom.js
import { DOM, CHECK_ICON_SVG } from './dom.js';

// Importa a função de helper (v5.7.6: Corrigida importação de ui.js para helpers.js)
import { updateSourceSelectionUI } from './helpers.js';

export const showInfoModal = (message) => {
    DOM.infoModalMessage.textContent = message;
    DOM.infoModal.classList.remove('hidden');
};

export const showForgotPasswordModal = () => {
    return new Promise((resolve) => {
        DOM.resetEmailInput.value = '';
        DOM.forgotPasswordModal.classList.remove('hidden');
        DOM.resetEmailInput.focus();

        const handleSend = () => {
            cleanupAndResolve(DOM.resetEmailInput.value.trim());
        };

        const handleCancel = () => {
            cleanupAndResolve(null);
        };

        const cleanupAndResolve = (value) => {
            DOM.sendResetEmailBtn.removeEventListener('click', handleSend);
            DOM.cancelResetBtn.removeEventListener('click', handleCancel);
            DOM.forgotPasswordModal.classList.add('hidden');
            resolve(value);
        };

        DOM.sendResetEmailBtn.addEventListener('click', handleSend, { once: true });
        DOM.cancelResetBtn.addEventListener('click', handleCancel, { once: true });
    });
};

export const showConfirmModal = (message, okText = "OK", cancelText = "Cancelar") => {
    return new Promise((resolve) => {
        DOM.confirmModalMessage.textContent = message;
        DOM.confirmOkBtn.textContent = okText;
        DOM.confirmCancelBtn.textContent = cancelText;
        DOM.confirmModal.classList.remove('hidden');

        const confirmListener = () => resolvePromise(true);
        const cancelListener = () => resolvePromise(false);

        const resolvePromise = (value) => {
            DOM.confirmModal.classList.add('hidden');
            DOM.confirmOkBtn.removeEventListener('click', confirmListener);
            DOM.confirmCancelBtn.removeEventListener('click', cancelListener);
            resolve(value);
        };

        DOM.confirmOkBtn.addEventListener('click', confirmListener, { once: true });
        DOM.confirmCancelBtn.addEventListener('click', cancelListener, { once: true });
    });
};

export const showSettlementModal = (orderId, amount) => {
    return new Promise((resolve) => {
        DOM.settlementOrderId.value = orderId;
        DOM.settlementAmountDisplay.textContent = `R$ ${amount.toFixed(2)}`;
        DOM.settlementDate.value = new Date().toISOString().split('T')[0];
        
        // Define 'banco' como padrão ao abrir
        updateSourceSelectionUI(DOM.settlementSourceContainer, 'banco');

        DOM.settlementModal.classList.remove('hidden');
        DOM.settlementDate.focus(); // Foco na data

        const handleConfirm = () => {
            const selectedSourceEl = DOM.settlementSourceContainer.querySelector('.source-selector.active');
            if (!selectedSourceEl) {
                // Feedback sutil se nenhuma origem for selecionada
                const container = DOM.settlementSourceContainer;
                container.classList.add('ring-2', 'ring-red-500', 'rounded-md');
                setTimeout(() => container.classList.remove('ring-2', 'ring-red-500', 'rounded-md'), 1000);
                return;
            }
            
            const data = {
                date: DOM.settlementDate.value,
                source: selectedSourceEl.dataset.source
            };
            cleanupAndResolve(data);
        };

        const handleCancel = () => {
            cleanupAndResolve(null);
        };
        
        const handleSourceClick = (e) => {
             const target = e.target.closest('.source-selector');
             if (target) {
                updateSourceSelectionUI(DOM.settlementSourceContainer, target.dataset.source);
             }
        };

        const cleanupAndResolve = (value) => {
            DOM.settlementModal.classList.add('hidden');
            DOM.settlementConfirmBtn.removeEventListener('click', handleConfirm);
            DOM.settlementCancelBtn.removeEventListener('click', handleCancel);
            DOM.settlementSourceContainer.removeEventListener('click', handleSourceClick); // Limpa o listener de origem
            resolve(value);
        };

        // Adiciona listeners
        DOM.settlementConfirmBtn.addEventListener('click', handleConfirm, { once: false }); // 'once: false' por causa da validação
        DOM.settlementCancelBtn.addEventListener('click', handleCancel, { once: true });
        DOM.settlementSourceContainer.addEventListener('click', handleSourceClick);
    });
};

// ========================================================
// v5.7.6: INÍCIO - Funções adicionadas para modais com bug de z-index
// Estes são os modais com z-50 que conflitam com o banner z-50
// ========================================================

/**
 * (v5.7.6) Abre o modal de Pedido e aplica o remendo de z-index.
 */
export const showOrderModal = () => {
    DOM.orderModal.style.zIndex = '55'; // Remendo JS para sobrepor CSS em cache
    DOM.orderModal.classList.remove('hidden');
};

/**
 * (v5.7.6) Fecha o modal de Pedido.
 */
export const hideOrderModal = () => {
    DOM.orderModal.classList.add('hidden');
    // Não é necessário redefinir o z-index, pois ele será aplicado na próxima abertura
};

/**
 * (v5.7.6) Abre o modal de Transação e aplica o remendo de z-index.
 */
export const showTransactionModal = () => {
    DOM.transactionModal.style.zIndex = '55'; // Remendo JS para sobrepor CSS em cache
    DOM.transactionModal.classList.remove('hidden');
};

/**
 * (v5.7.6) Fecha o modal de Transação.
 */
export const hideTransactionModal = () => {
    DOM.transactionModal.classList.add('hidden');
};

/**
 * (v5.7.6) Abre o modal de Tabela de Preços e aplica o remendo de z-index.
 */
export const showPriceTableModal = () => {
    DOM.priceTableModal.style.zIndex = '55'; // Remendo JS para sobrepor CSS em cache
    DOM.priceTableModal.classList.remove('hidden');
};

/**
 * (v5.7.6) Fecha o modal de Tabela de Preços.
 */
export const hidePriceTableModal = () => {
    DOM.priceTableModal.classList.add('hidden');
};

/**
 * (v5.7.6) Abre o modal de Visualização (Detalhes do Pedido) e aplica o remendo de z-index.
 */
export const showViewModal = () => {
    DOM.viewModal.style.zIndex = '55'; // Remendo JS para sobrepor CSS em cache
    DOM.viewModal.classList.remove('hidden');
};

/**
 * (v5.7.6) Fecha o modal de Visualização.
 */
export const hideViewModal = () => {
    DOM.viewModal.classList.add('hidden');
};

// ========================================================
// v5.7.6: FIM - Funções adicionadas
// ========================================================

// js/security/sessionManager.js
// ==========================================================
// GERENCIADOR DE SESSÃO E SEGURANÇA (v1.0 - Isolado)
// Responsável por: Timer de Inatividade e Logout Automático
// ===========================================================

let idleTimeout, countdownInterval;
let domElements, logoutHandlerCallback; 
let lastActivityTime = Date.now();

// Configurações (30 minutos de inatividade, 60s de aviso)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; 
const COUNTDOWN_SECONDS = 60;

// --- Lógica Interna (Privada) ---

const startCountdown = () => {
    if (domElements && domElements.idleModal) {
        domElements.idleModal.classList.remove('hidden');
        let secondsLeft = COUNTDOWN_SECONDS;
        
        if (domElements.countdownTimer) {
            domElements.countdownTimer.textContent = secondsLeft;
        }

        countdownInterval = setInterval(() => {
            secondsLeft--;
            if (domElements.countdownTimer) {
                domElements.countdownTimer.textContent = secondsLeft;
            }
            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                if (logoutHandlerCallback) logoutHandlerCallback();
            }
        }, 1000);
    }
};

const handleUserActivity = () => {
    const now = Date.now();
    // Throttle: Só reseta se passou mais de 1s desde a última atividade
    // (Evita disparar mil vezes enquanto o mouse move)
    if (now - lastActivityTime > 1000) {
        lastActivityTime = now;
        resetIdleTimer();
    }
};

// --- Funções Públicas (Exportadas) ---

export const resetIdleTimer = () => {
    if (!domElements || !logoutHandlerCallback) return; 
    
    clearTimeout(idleTimeout);
    clearInterval(countdownInterval);
    
    if (domElements.idleModal) {
        domElements.idleModal.classList.add('hidden');
    }
    
    idleTimeout = setTimeout(startCountdown, IDLE_TIMEOUT_MS);
};

export const initializeIdleTimer = (dom, logoutHandler) => {
    domElements = dom;
    logoutHandlerCallback = logoutHandler;
    
    if (domElements.stayLoggedInBtn) {
        domElements.stayLoggedInBtn.addEventListener('click', resetIdleTimer);
    }

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
        // 'passive: true' melhora a performance de scroll
        document.addEventListener(event, handleUserActivity, { passive: true });
    });

    resetIdleTimer();
};

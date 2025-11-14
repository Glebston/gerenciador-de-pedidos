// js/listeners/authListeners.js

// Importações necessárias
// v5.7.22: REMOVIDA importação estática de UI.
// import * as UI from '../ui.js'; 
import { handleLogin, handleLogout, handleForgotPassword } from '../auth.js'; // Importa as funções de lógica de autenticação

/**
 * Inicializa todos os event listeners relacionados à autenticação (login, logout, etc.).
 * Esta função é chamada uma vez no main.js para anexar os listeners.
 * * v5.7.22: A função agora recebe o módulo 'UI' injetado pelo main.js
 * para resolver o "conflito de módulo" (estático vs. dinâmico).
 */
export function initializeAuthListeners(UI) {
    
    // Listener do formulário de login
    UI.DOM.loginForm.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        handleLogin(UI.DOM.loginEmail.value, UI.DOM.loginPassword.value); 
    });

    // Listener do botão "Esqueci minha senha"
    UI.DOM.forgotPasswordBtn.addEventListener('click', handleForgotPassword);

    // Listener do botão de logout
    UI.DOM.logoutBtn.addEventListener('click', handleLogout);
}

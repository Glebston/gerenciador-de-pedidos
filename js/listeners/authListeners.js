// js/listeners/authListeners.js

// Importações necessárias
import * as UI from '../ui.js'; // Importa o barril da UI (que contém o DOM)
import { handleLogin, handleLogout, handleForgotPassword } from '../auth.js'; // Importa as funções de lógica de autenticação

/**
 * Inicializa todos os event listeners relacionados à autenticação (login, logout, etc.).
 * Esta função é chamada uma vez no main.js para anexar os listeners.
 */
export function initializeAuthListeners() {
    
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

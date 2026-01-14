// Importa as funções de autenticação do SDK do Firebase
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Importa a instância 'auth' já inicializada e as funções de modais da UI
import { auth } from './firebaseConfig.js';
import { showInfoModal, showForgotPasswordModal } from './ui.js';

/**
 * Lida com a tentativa de login do usuário, recebendo as credenciais.
 * @param {string} email - O email do usuário.
 * @param {string} password - A senha do usuário.
 */
export const handleLogin = async (email, password) => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // O sucesso do login será detectado pelo listener onAuthStateChanged em main.js,
        // que então cuidará de inicializar o resto da aplicação.
    } catch (error) {
        console.error("Erro de login:", error.code);
        showInfoModal("E-mail ou senha incorretos.");
    }
};

/**
 * Executa o processo de logout do usuário.
 */
export const handleLogout = () => {
    signOut(auth).catch(error => {
        console.error("Erro ao fazer logout:", error);
        showInfoModal("Ocorreu um erro ao tentar sair.");
    });
};

/**
 * Inicia e gerencia o fluxo de recuperação de senha.
 */
export const handleForgotPassword = async () => {
    const email = await showForgotPasswordModal();
    
    if (!email) {
        return; // O usuário fechou ou cancelou o modal.
    }
    
    try {
        await sendPasswordResetEmail(auth, email);
        // Exibimos a mesma mensagem em caso de sucesso ou falha para não revelar se um e-mail está cadastrado.
        showInfoModal("Se uma conta existir para este e-mail, um link para redefinição de senha foi enviado.");
    } catch (error) {
        console.error("Erro na tentativa de redefinição de senha (silenciado para o usuário):", error.code);
        showInfoModal("Se uma conta existir para este e-mail, um link para redefinição de senha foi enviado.");
    }
};

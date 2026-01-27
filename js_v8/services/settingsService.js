// js/services/settingsService.js
// ==========================================================
// MÓDULO DE CONFIGURAÇÕES (v1.0.0)
// Responsabilidade: Salvar e Buscar dados da empresa (PIX, Zap)
// Caminho no Banco: companies/{uid}/config/payment
// ==========================================================

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebaseConfig.js';

/**
 * Busca as configurações salvas da empresa.
 * @param {string} companyId - ID da empresa logada.
 * @returns {Object|null} - Objeto com pixKey, whatsapp, etc. ou null se não existir.
 */
export const getCompanySettings = async (companyId) => {
    if (!companyId) return null;
    
    try {
        // Salva numa sub-coleção 'config' para organizar melhor
        const ref = doc(db, `companies/${companyId}/config/payment`);
        const snap = await getDoc(ref);
        
        if (snap.exists()) {
            return snap.data();
        } else {
            return null; // Empresa ainda não configurou nada
        }
    } catch (error) {
        console.error("Erro ao buscar configurações:", error);
        throw error;
    }
};

/**
 * Salva (ou atualiza) as configurações da empresa.
 * @param {string} companyId - ID da empresa logada.
 * @param {Object} settingsData - Dados do formulário { pixKey, pixBeneficiary, entryPercent, whatsapp }.
 */
export const saveCompanySettings = async (companyId, settingsData) => {
    if (!companyId) throw new Error("ID da empresa inválido");

    try {
        const ref = doc(db, `companies/${companyId}/config/payment`);
        // O { merge: true } garante que se adicionarmos novos campos no futuro, não apagamos os antigos
        await setDoc(ref, settingsData, { merge: true });
        return true;
    } catch (error) {
        console.error("Erro ao salvar configurações:", error);
        throw error;
    }
};

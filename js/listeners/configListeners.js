// js/listeners/configListeners.js
// ==========================================================
// LISTENER DE CONFIGURAÇÕES (v1.1.0 - COMPANY AWARE)
// Responsabilidade: Gerenciar a UI de Configurações da Empresa.
// Conecta o HTML (View) ao Service (Model) usando o ID da Empresa.
// ==========================================================

import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebaseConfig.js';
import { getCompanySettings, saveCompanySettings } from "../services/settingsService.js";

// Referências aos Elementos do DOM
const DOM = {
    openBtn: document.getElementById('companySettingsBtn'),
    modal: document.getElementById('settingsModal'),
    closeBtn: document.getElementById('closeSettingsModalBtn'),
    cancelBtn: document.getElementById('cancelSettingsBtn'),
    form: document.getElementById('settingsForm'),
    saveBtn: document.getElementById('saveSettingsBtn'),
    saveText: document.getElementById('saveSettingsText'),
    
    // Inputs
    pixKey: document.getElementById('settingPixKey'),
    pixBeneficiary: document.getElementById('settingPixBeneficiary'),
    entryPercent: document.getElementById('settingEntryPercent'),
    whatsapp: document.getElementById('settingWhatsapp')
};

// Cache para não buscar o mapeamento toda hora
let cachedCompanyId = null;

/**
 * Função auxiliar para descobrir o ID da Empresa baseado no Usuário Logado.
 * (Mesma lógica do main.js)
 */
const getCompanyId = async (user) => {
    if (cachedCompanyId) return cachedCompanyId;

    try {
        const mappingRef = doc(db, "user_mappings", user.uid);
        const mappingSnap = await getDoc(mappingRef);
        
        if (mappingSnap.exists()) {
            cachedCompanyId = mappingSnap.data().companyId;
            return cachedCompanyId;
        } else {
            console.error("Mapeamento de usuário não encontrado.");
            return null;
        }
    } catch (error) {
        console.error("Erro ao buscar companyId:", error);
        return null;
    }
};

/**
 * Função principal que inicializa todos os ouvintes.
 */
export const initConfigListeners = () => {
    if (!DOM.openBtn || !DOM.modal) {
        console.warn('Elementos de configuração não encontrados no DOM.');
        return;
    }

    DOM.openBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await openSettingsModal();
    });

    DOM.closeBtn?.addEventListener('click', closeSettingsModal);
    DOM.cancelBtn?.addEventListener('click', closeSettingsModal);

    DOM.form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSaveSettings();
    });
};

const openSettingsModal = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        alert("Erro: Usuário não autenticado.");
        return;
    }

    // 1. Descobre o ID da Empresa
    const companyId = await getCompanyId(user);
    if (!companyId) {
        alert("Erro crítico: Empresa não vinculada.");
        return;
    }

    DOM.modal.classList.remove('hidden');
    setFormLoading(true);

    try {
        // 2. Busca usando o ID da Empresa (Correto)
        const settings = await getCompanySettings(companyId);

        if (settings) {
            DOM.pixKey.value = settings.pixKey || '';
            DOM.pixBeneficiary.value = settings.pixBeneficiary || '';
            // Converte de 0.5 para 50 para exibição
            DOM.entryPercent.value = (settings.entryPercentage !== undefined) ? (settings.entryPercentage * 100) : ''; 
            DOM.whatsapp.value = settings.whatsappNumber || '';
        } else {
            DOM.form.reset();
        }
    } catch (error) {
        console.error(error);
        alert("Não foi possível carregar as configurações.");
        closeSettingsModal();
    } finally {
        setFormLoading(false);
    }
};

const handleSaveSettings = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const companyId = await getCompanyId(user);
    if (!companyId) return;

    const originalText = DOM.saveText.innerText;
    DOM.saveText.innerText = "Salvando...";
    DOM.saveBtn.disabled = true;
    DOM.saveBtn.classList.add('opacity-50', 'cursor-not-allowed');

    // Tratamento de input para % (Ex: "50" vira 0.5, "0,5" vira 0.005)
    // Se o usuário digitar "50", dividimos por 100 -> 0.5
    let rawPercent = DOM.entryPercent.value.replace(',', '.');
    let percentValue = (parseFloat(rawPercent) || 0) / 100;

    const settingsData = {
        pixKey: DOM.pixKey.value.trim(),
        pixBeneficiary: DOM.pixBeneficiary.value.trim(),
        entryPercentage: percentValue, 
        whatsappNumber: DOM.whatsapp.value.replace(/\D/g, '')
    };

    try {
        await saveCompanySettings(companyId, settingsData);
        alert("Configurações salvas com sucesso!");
        closeSettingsModal();
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar. Tente novamente.");
    } finally {
        DOM.saveText.innerText = originalText;
        DOM.saveBtn.disabled = false;
        DOM.saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
};

const closeSettingsModal = () => {
    DOM.modal.classList.add('hidden');
};

const setFormLoading = (isLoading) => {
    const inputs = DOM.form.querySelectorAll('input');
    inputs.forEach(input => input.disabled = isLoading);
    DOM.pixKey.placeholder = isLoading ? "Carregando..." : "CPF, CNPJ, Email ou Aleatória";
};

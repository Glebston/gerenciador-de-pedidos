// js/listeners/settingsLogic.js
// ========================================================
// LÓGICA DE CONFIGURAÇÕES & UPLOAD (v1.3 - Refatorado)
// Responsabilidade: Gerenciar modal, Uploads e Salvar dados
// ========================================================

import { getCompanySettings, saveCompanySettings } from "../services/settingsService.js";
import { auth } from "../firebaseConfig.js"; 

// [REFATORAÇÃO] Importando serviço central de imagens
import { fileToBase64, uploadToImgBB } from "../services/imageService.js";

const DOM = {
    modal: document.getElementById('settingsModal'), 
    
    // Logo e Upload
    logoInput: document.getElementById('logoInput'),
    logoPreview: document.getElementById('logoPreview'),
    logoPlaceholder: document.getElementById('logoPlaceholder'),
    uploadLoader: document.getElementById('uploadLoader'),
    uploadStatus: document.getElementById('uploadStatus'),
    logoUrlHidden: document.getElementById('logoUrl'), // Input oculto onde fica o link final
    
    // Campos de Texto
    pixKey: document.getElementById('pixKey'),
    pixBeneficiary: document.getElementById('pixBeneficiary'),
    entryPercent: document.getElementById('entryPercent'),
    whatsapp: document.getElementById('whatsapp'),
    
    // Botões
    saveBtn: document.getElementById('saveSettingsBtn'),
    closeBtn: document.getElementById('closeSettingsModalBtn'),
    cancelBtn: document.getElementById('cancelSettingsBtn')
};

// --- 1. ABRIR E CARREGAR DADOS ---
export async function openSettingsModal() {
    const user = auth.currentUser;
    if (!user) return;

    // Reseta estado visual
    if(DOM.saveBtn) {
        DOM.saveBtn.innerHTML = `Salvar Alterações`;
        DOM.saveBtn.disabled = false;
    }
    if(DOM.uploadStatus) DOM.uploadStatus.textContent = "";
    
    // Pega ID da empresa injetado pelo main.js
    const companyId = (DOM.modal && DOM.modal.dataset.companyId) || user.uid;

    try {
        const data = await getCompanySettings(companyId);
        
        if (data) {
            if(DOM.pixKey) DOM.pixKey.value = data.pixKey || "";
            if(DOM.pixBeneficiary) DOM.pixBeneficiary.value = data.pixBeneficiary || "";
            if(DOM.entryPercent) DOM.entryPercent.value = data.entryPercent || "50";
            if(DOM.whatsapp) DOM.whatsapp.value = data.whatsapp || "";
            
            // Se já tem logo salvo, mostra ele
            if (data.logoUrl) {
                if(DOM.logoUrlHidden) DOM.logoUrlHidden.value = data.logoUrl;
                if(DOM.logoPreview) {
                    DOM.logoPreview.src = data.logoUrl;
                    DOM.logoPreview.classList.remove('hidden');
                }
                if(DOM.logoPlaceholder) DOM.logoPlaceholder.classList.add('hidden');
            } else {
                // Reseta para placeholder se não tiver logo
                if(DOM.logoPreview) {
                    DOM.logoPreview.src = "";
                    DOM.logoPreview.classList.add('hidden');
                }
                if(DOM.logoPlaceholder) DOM.logoPlaceholder.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error("Erro ao carregar configs:", error);
    }
}

// --- 2. PREVIEW E UPLOAD IMEDIATO (Centralizado) ---
if (DOM.logoInput) {
    DOM.logoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 2.1 Preview Local
        const reader = new FileReader();
        reader.onload = (ev) => {
            if(DOM.logoPreview) {
                DOM.logoPreview.src = ev.target.result;
                DOM.logoPreview.classList.remove('hidden');
            }
            if(DOM.logoPlaceholder) DOM.logoPlaceholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);

        // 2.2 Upload via imageService
        try {
            if(DOM.uploadLoader) DOM.uploadLoader.classList.remove('hidden');
            if(DOM.uploadStatus) {
                DOM.uploadStatus.textContent = "Enviando imagem...";
                DOM.uploadStatus.className = "text-[10px] text-blue-600 font-bold mt-1 h-3";
            }
            if(DOM.saveBtn) DOM.saveBtn.disabled = true; // Trava salvar

            // [NOVO] Usa o serviço centralizado
            const base64 = await fileToBase64(file);
            const imageUrl = await uploadToImgBB(base64);

            if (imageUrl) {
                if(DOM.logoUrlHidden) DOM.logoUrlHidden.value = imageUrl; // SUCESSO!
                if(DOM.uploadStatus) {
                    DOM.uploadStatus.textContent = "Imagem carregada com sucesso!";
                    DOM.uploadStatus.className = "text-[10px] text-green-600 font-bold mt-1 h-3";
                }
            } else {
                throw new Error("O serviço não retornou uma URL válida.");
            }

        } catch (error) {
            console.error(error);
            if(DOM.uploadStatus) {
                DOM.uploadStatus.textContent = "Erro ao enviar: " + error.message;
                DOM.uploadStatus.className = "text-[10px] text-red-600 font-bold mt-1 h-3";
            }
            if(DOM.logoUrlHidden) DOM.logoUrlHidden.value = ""; 
        } finally {
            if(DOM.uploadLoader) DOM.uploadLoader.classList.add('hidden');
            if(DOM.saveBtn) DOM.saveBtn.disabled = false; // Destrava salvar
        }
    });
}

// --- 3. SALVAR TUDO ---
if (DOM.saveBtn) {
    DOM.saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const user = auth.currentUser;
        if (!user) return;

        const originalText = DOM.saveBtn.innerHTML;
        DOM.saveBtn.textContent = "Salvando...";
        DOM.saveBtn.disabled = true;

        const settingsData = {
            pixKey: DOM.pixKey ? DOM.pixKey.value : "",
            pixBeneficiary: DOM.pixBeneficiary ? DOM.pixBeneficiary.value : "",
            entryPercent: DOM.entryPercent ? DOM.entryPercent.value : "50",
            whatsapp: DOM.whatsapp ? DOM.whatsapp.value : "",
            logoUrl: DOM.logoUrlHidden ? DOM.logoUrlHidden.value : ""
        };

        try {
            const companyId = (DOM.modal && DOM.modal.dataset.companyId) || user.uid;
            
            // Salva no serviço dedicado de settings
            await saveCompanySettings(companyId, settingsData);
            
            // Feedback Visual
            DOM.saveBtn.textContent = "Salvo!";
            setTimeout(() => {
                if(DOM.modal) DOM.modal.classList.add('hidden');
                DOM.saveBtn.innerHTML = originalText;
                DOM.saveBtn.disabled = false;
                
                // Recarrega a página para atualizar o logo no menu (opcional, mas bom)
                window.location.reload();
            }, 1000);

        } catch (error) {
            alert("Erro ao salvar: " + error.message);
            DOM.saveBtn.innerHTML = originalText;
            DOM.saveBtn.disabled = false;
        }
    });
}

// Fechar Modal
if (DOM.closeBtn) DOM.closeBtn.addEventListener('click', () => DOM.modal.classList.add('hidden'));
if (DOM.cancelBtn) DOM.cancelBtn.addEventListener('click', () => DOM.modal.classList.add('hidden'));

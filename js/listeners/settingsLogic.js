// js/listeners/settingsLogic.js
// ========================================================
// LÓGICA DE CONFIGURAÇÕES & UPLOAD (v1.2 - Production Ready)
// Responsabilidade: Gerenciar modal, Uploads e Salvar dados
// ========================================================

import { getCompanySettings, saveCompanySettings } from "../services/settingsService.js";
import { auth } from "../firebaseConfig.js"; 

// --- CONFIGURAÇÃO DA CHAVE DE API (IMGBB) ---
const IMGBB_API_KEY = "f012978df48f3596b193c06e05589442"; 

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
    DOM.saveBtn.innerHTML = `Salvar Alterações`;
    DOM.saveBtn.disabled = true;
    DOM.uploadStatus.textContent = "";
    
    // Pega ID da empresa injetado pelo main.js
    const companyId = DOM.modal.dataset.companyId || user.uid;

    try {
        const data = await getCompanySettings(companyId);
        
        if (data) {
            DOM.pixKey.value = data.pixKey || "";
            DOM.pixBeneficiary.value = data.pixBeneficiary || "";
            DOM.entryPercent.value = data.entryPercent || "50";
            DOM.whatsapp.value = data.whatsapp || "";
            
            // Se já tem logo salvo, mostra ele
            if (data.logoUrl) {
                DOM.logoUrlHidden.value = data.logoUrl;
                DOM.logoPreview.src = data.logoUrl;
                DOM.logoPreview.classList.remove('hidden');
                DOM.logoPlaceholder.classList.add('hidden');
            } else {
                // Reseta para placeholder se não tiver logo
                DOM.logoPreview.src = "";
                DOM.logoPreview.classList.add('hidden');
                DOM.logoPlaceholder.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error("Erro ao carregar configs:", error);
    } finally {
        DOM.saveBtn.disabled = false;
    }
}

// --- 2. PREVIEW E UPLOAD IMEDIATO ---
if (DOM.logoInput) {
    DOM.logoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 2.1 Preview Local (Para o usuário ver o que escolheu na hora)
        const reader = new FileReader();
        reader.onload = (ev) => {
            DOM.logoPreview.src = ev.target.result;
            DOM.logoPreview.classList.remove('hidden');
            DOM.logoPlaceholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);

        // 2.2 Upload Silencioso
        try {
            DOM.uploadLoader.classList.remove('hidden');
            DOM.uploadStatus.textContent = "Enviando imagem...";
            DOM.uploadStatus.className = "text-[10px] text-blue-600 font-bold mt-1 h-3";
            DOM.saveBtn.disabled = true; // Trava salvar enquanto envia

            const formData = new FormData();
            formData.append("image", file);

            // Envio para o ImgBB usando a SUA chave
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                const imageUrl = result.data.url;
                DOM.logoUrlHidden.value = imageUrl; // <--- SUCESSO! Guarda o link aqui.
                DOM.uploadStatus.textContent = "Imagem carregada com sucesso!";
                DOM.uploadStatus.className = "text-[10px] text-green-600 font-bold mt-1 h-3";
            } else {
                throw new Error(result.error?.message || "Erro no upload");
            }

        } catch (error) {
            console.error(error);
            DOM.uploadStatus.textContent = "Erro ao enviar: " + error.message;
            DOM.uploadStatus.className = "text-[10px] text-red-600 font-bold mt-1 h-3";
            // Limpa o campo oculto se falhou
            DOM.logoUrlHidden.value = ""; 
        } finally {
            DOM.uploadLoader.classList.add('hidden');
            DOM.saveBtn.disabled = false; // Destrava salvar
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
            pixKey: DOM.pixKey.value,
            pixBeneficiary: DOM.pixBeneficiary.value,
            entryPercent: DOM.entryPercent.value,
            whatsapp: DOM.whatsapp.value,
            logoUrl: DOM.logoUrlHidden.value // Pega o link que veio do upload
        };

        try {
            const companyId = DOM.modal.dataset.companyId || user.uid;
            await saveCompanySettings(companyId, settingsData);
            
            // Feedback Visual Rápido
            DOM.saveBtn.textContent = "Salvo!";
            setTimeout(() => {
                DOM.modal.classList.add('hidden');
                DOM.saveBtn.innerHTML = originalText;
                DOM.saveBtn.disabled = false;
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

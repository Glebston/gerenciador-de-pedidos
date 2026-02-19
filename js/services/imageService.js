// js/services/imageService.js
// ==========================================================
// SERVIÇO DE IMAGENS E ARQUIVOS (v1.0 - Refatorado)
// Centraliza upload (ImgBB), conversão Base64 e Branding
// ==========================================================

import { 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { db, auth } from '../firebaseConfig.js'; // Caminho ajustado para subir um nível

// --- Configurações ---
const IMGBB_API_KEY = "f012978df48f3596b193c06e05589442";

/**
 * Converte um arquivo (File Object) para Base64 (sem prefixo de data url).
 * Usado para uploads via API.
 */
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

/**
 * Converte uma URL de imagem (ex: ImgBB) para Base64 completo (DataURL).
 * Vital para gerar PDFs com imagens que estão na nuvem (evita CORS em alguns casos e garante embed).
 */
export const urlToBase64 = async (url) => {
    try {
        // Adiciona timestamp para evitar cache agressivo que corrompe imagens
        const cleanUrl = url.includes('?') ? `${url}&v=${Date.now()}` : `${url}?v=${Date.now()}`;
        
        const response = await fetch(cleanUrl);
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn("Falha ao converter imagem remota para Base64:", error);
        return null;
    }
};

/**
 * Faz upload de uma string Base64 para o ImgBB.
 */
export const uploadToImgBB = async (base64Image) => {
    const formData = new FormData();
    formData.append('image', base64Image);
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) return data.data.url;
        throw new Error(data.error.message);
    } catch (error) {
        console.error('Erro no upload para ImgBB:', error);
        return null;
    }
};

/**
 * Busca Logo e Telefone da empresa no Firestore para usar no PDF.
 * (Movido de utils.js para cá pois trata-se de "recurso de imagem/branding")
 */
export const fetchCompanyBrandingData = async () => {
    try {
        const user = auth.currentUser;
        if (!user) return null;

        // 1. Descobre o CompanyID através do mapeamento
        const mappingRef = doc(db, "user_mappings", user.uid);
        const mappingSnap = await getDoc(mappingRef);
        
        if (!mappingSnap.exists()) return null;
        const companyId = mappingSnap.data().companyId;

        // 2. Busca configuração de pagamento/branding
        const configRef = doc(db, `companies/${companyId}/config/payment`);
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const data = configSnap.data();
            return {
                logoUrl: data.logoUrl || null,
                phone: data.whatsappNumber || null
            };
        }
        return null;
    } catch (error) {
        console.error("Erro buscando branding:", error);
        return null;
    }
};

// js/utils.js
// =========================================================================
// MÓDULO DE UTILITÁRIOS GERAIS (v6.0 - Refatorado)
// Contém apenas funções puras de formatação e ordenação.
// Lógica pesada movida para: services/pdfService, services/imageService, etc.
// =========================================================================

// --- Constantes ---
const SIZES_ORDER = [
    'PP', 'P', 'M', 'G', 'GG', 'XG',
    '2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos'
];

// --- Funções de Ordenação ---

/**
 * Ordena um objeto de tamanhos (ex: {M: 2, P: 1}) seguindo a ordem lógica de vestuário.
 */
export const sortSizes = (sizesObject) => {
    return Object.entries(sizesObject).sort((a, b) => {
        const indexA = SIZES_ORDER.indexOf(a[0]);
        const indexB = SIZES_ORDER.indexOf(b[0]);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB; 
    });
};

// --- Funções de Formatação ---

/**
 * Formata um número de telefone para exibição (ex: (83) 99999-9999).
 * Aceita 10 ou 11 dígitos, com ou sem o prefixo 55.
 */
export const formatPhoneDisplay = (phone) => {
    if (!phone) return "";
    let clean = phone.replace(/\D/g, '');
    
    // Remove o 55 se vier do banco com DDI
    if (clean.startsWith('55') && clean.length > 11) clean = clean.substring(2);
    
    if (clean.length === 11) return `(${clean.substring(0,2)}) ${clean.substring(2,7)}-${clean.substring(7)}`;
    if (clean.length === 10) return `(${clean.substring(0,2)}) ${clean.substring(2,6)}-${clean.substring(6)}`;
    
    return phone; // Retorna original se não casar com padrão
};

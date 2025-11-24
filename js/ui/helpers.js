// js/ui/helpers.js
// ==========================================================
// MÓDULO UI HELPERS (v5.19.1 - IMPROVED UX BUTTONS)
// Responsabilidade: Fornecer funções "ajudantes" visuais.
// Atualizado: Melhoria na affordance dos botões Banco/Caixa.
// ==========================================================

import { DOM, CHECK_ICON_SVG } from './dom.js';

// Funções de UI Geral
export const updateNavButton = (currentDashboardView) => {
    const isOrdersView = currentDashboardView === 'orders';
    if (isOrdersView) {
        DOM.financeDashboardBtn.innerHTML = `📊 Financeiro`;
    } else {
        DOM.financeDashboardBtn.innerHTML = `📋 Pedidos`;
    }
};

export const handleCookieConsent = () => {
    if (localStorage.getItem('cookieConsent')) {
        DOM.cookieBanner.classList.add('hidden');
    } else {
        DOM.cookieBanner.classList.remove('hidden');
    }
};

/**
 * Atualiza a UI dos seletores de origem (Banco/Caixa)
 * Transformando-os visualmente em botões clicáveis com feedback claro.
 * @param {HTMLElement} container - O elemento container
 * @param {string} selectedSource - 'banco' ou 'caixa'
 */
export const updateSourceSelectionUI = (container, selectedSource) => {
    if (!container) return;
    
    container.querySelectorAll('.source-selector').forEach(btn => {
        const source = btn.dataset.source;
        const isSelected = source === selectedSource;
        
        // Limpa classes de estado anteriores para garantir consistência
        btn.classList.remove(
            'active', 'bg-white', 'bg-indigo-50', 'bg-gray-100', 
            'border-gray-300', 'border-indigo-500', 'border-gray-500', 
            'text-gray-700', 'text-indigo-700', 'text-gray-900',
            'ring-1', 'ring-indigo-500', 'ring-gray-500', 'shadow-sm'
        );

        // Adiciona classes base para "Aparência de Botão Clicável"
        btn.classList.add(
            'cursor-pointer', 
            'transition-all', 
            'duration-200', 
            'border', 
            'rounded-md', 
            'shadow-sm', // Sombra suave para profundidade
            'hover:shadow-md' // Feedback no hover
        );

        if (isSelected) {
            // Estilo ATIVO (Selecionado)
            if (source === 'banco') {
                btn.classList.add('bg-indigo-50', 'border-indigo-500', 'text-indigo-700', 'ring-1', 'ring-indigo-500');
            } else {
                btn.classList.add('bg-gray-100', 'border-gray-500', 'text-gray-900', 'ring-1', 'ring-gray-500');
            }
            btn.classList.add('active'); // Mantém classe lógica
        } else {
            // Estilo INATIVO (Mas clicável)
            btn.classList.add('bg-white', 'border-gray-300', 'text-gray-700', 'hover:bg-gray-50', 'hover:border-gray-400');
        }
        
        // Gerencia o ícone de check
        const iconPlaceholder = btn.querySelector('.icon-placeholder');
        if (iconPlaceholder) {
            iconPlaceholder.innerHTML = isSelected ? CHECK_ICON_SVG : '';
        }
    });
};

export const populateDatalists = (partTypes, materialTypes) => {
    DOM.partTypeList.innerHTML = partTypes.map(opt => `<option value="${opt}"></option>`).join('');
    DOM.partMaterialList.innerHTML = materialTypes.map(opt => `<option value="${opt}"></option>`).join('');
};

export const openOptionsModal = (type, options) => {
    const title = type === 'partTypes' ? 'Tipos de Peça' : 'Tipos de Material';
    DOM.optionsModalTitle.textContent = `Gerenciar ${title}`;
    DOM.optionsList.innerHTML = options.map((opt, index) =>
        `<div class="flex justify-between items-center p-2 bg-gray-100 rounded-md">
            <span>${opt}</span>
            <button class="delete-option-btn text-red-500 hover:text-red-700 font-bold" data-index="${index}">&times;</button>
        </div>`
    ).join('');
    DOM.optionsModal.classList.remove('hidden');
};

export const formatPhoneNumber = (value) => {
    if (!value) return "";
    value = value.replace(/\D/g,'');
    value = value.replace(/^(\d{2})(\d)/g,'($1) $2');
    value = value.replace(/(\d)(\d{4})$/,'$1-$2');
    return value;
}

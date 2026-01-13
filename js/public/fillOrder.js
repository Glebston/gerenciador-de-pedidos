// js/public/fillOrder.js
// ========================================================
// MÓDULO PÚBLICO: PREENCHIMENTO DE PEDIDOS (v3.2 - Fix Tela Final)
// Responsabilidade: Salvar dados, Branding e Tela de Agradecimento (Overlay).
// ========================================================

import { 
    doc, 
    getDoc, 
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { db } from '../firebaseConfig.js';

// --- 1. CONFIGURAÇÃO DE DADOS ---

const sizeLabels = {
    // Baby Look
    'BL-PP': 'PP (Baby Look)', 'BL-P':  'P (Baby Look)', 'BL-M':  'M (Baby Look)',
    'BL-G':  'G (Baby Look)', 'BL-GG': 'GG (Baby Look)', 'BL-XG': 'XG (Baby Look)',
    // Normal
    'PP': 'PP (Normal)', 'P':  'P (Normal)', 'M':  'M (Normal)',
    'G':  'G (Normal)', 'GG': 'GG (Normal)', 'XG': 'XG (Normal)',
    // Infantil
    '2':  '2 anos (Infantil)', '4':  '4 anos (Infantil)', '6':  '6 anos (Infantil)',
    '8':  '8 anos (Infantil)', '10': '10 anos (Infantil)', '12': '12 anos (Infantil)'
};

const sizeWeights = {
    // Baby Look (100-199)
    'PP (Baby Look)': 100, 'P (Baby Look)': 101, 'M (Baby Look)': 102,
    'G (Baby Look)': 103, 'GG (Baby Look)': 104, 'XG (Baby Look)': 105,
    // Normal (200-299)
    'PP (Normal)': 200, 'P (Normal)': 201, 'M (Normal)': 202,
    'G (Normal)': 203, 'GG (Normal)': 204, 'XG (Normal)': 205,
    // Infantil (300-399)
    '2 anos (Infantil)': 300, '4 anos (Infantil)': 301, '6 anos (Infantil)': 302,
    '8 anos (Infantil)': 303, '10 anos (Infantil)': 304, '12 anos (Infantil)': 305
};

// --- 2. ESTADO ---
const state = {
    companyId: null,
    orderId: null,
    partIndex: null,
    orderData: null,
    targetPart: null,
    items: [],
    lastSentItems: [],
    companyWhatsapp: null 
};

// --- 3. DOM ---
const DOM = {
    // Header & Branding
    defaultHeader: document.getElementById('defaultHeader'),
    companyLogo: document.getElementById('companyLogo'),
    statusBadge: document.getElementById('statusBadge'),
    
    // Info e Form
    orderInfo: document.getElementById('orderInfo'),
    clientName: document.getElementById('clientName'), 
    deliveryDate: document.getElementById('deliveryDate'),
    companyPhone: document.getElementById('companyPhone'),
    
    inputForm: document.getElementById('inputForm'),
    itemName: document.getElementById('itemName'),
    itemNumber: document.getElementById('itemNumber'),
    itemSize: document.getElementById('itemSize'),
    addItemBtn: document.getElementById('addItemBtn'),
    
    // Listas e Footer
    listContainer: document.getElementById('listContainer'),
    itemsList: document.getElementById('itemsList'),
    listCountBadge: document.getElementById('listCountBadge'),
    fixedFooter: document.getElementById('fixedFooter'),
    totalItemsDisplay: document.getElementById('totalItemsDisplay'),
    saveListBtn: document.getElementById('saveListBtn'),
    
    // Feedback
    successModal: document.getElementById('successModal'),
    summaryListContent: document.getElementById('summaryListContent'),
    copySummaryBtn: document.getElementById('copySummaryBtn'),
    feedback: document.getElementById('feedbackMessage')
};

// --- 4. INICIALIZAÇÃO ---
async function init() {
    const params = new URLSearchParams(window.location.search);
    state.companyId = params.get('cid');
    state.orderId = params.get('oid');
    const indexParam = params.get('partIndex');

    if (!state.companyId || !state.orderId || indexParam === null) {
        showError("Link inválido.");
        return;
    }
    state.partIndex = parseInt(indexParam);

    try {
        updateStatus("Carregando...", "blue");

        const [orderSnap, configSnap] = await Promise.all([
            getDoc(doc(db, "companies", state.companyId, "orders", state.orderId)),
            getDoc(doc(db, `companies/${state.companyId}/config/payment`))
        ]);

        if (!orderSnap.exists()) { showError("Pedido não encontrado."); return; }
        state.orderData = orderSnap.data();
        
        if (['Entregue', 'Finalizado', 'Cancelado'].includes(state.orderData.orderStatus)) {
            showError("Pedido já encerrado."); return;
        }

        if (!state.orderData.parts || !state.orderData.parts[state.partIndex]) {
            showError("Peça não encontrada."); return;
        }

        state.targetPart = state.orderData.parts[state.partIndex];
        if (state.targetPart.partInputType !== 'detalhado') {
            showError("Esta peça não aceita lista de nomes."); return;
        }

        applyBranding(configSnap.exists() ? configSnap.data() : null);

        renderInterface();
        DOM.inputForm.classList.remove('hidden');
        if(DOM.feedback) DOM.feedback.classList.add('hidden');
        updateStatus("Conectado", "green");
        
    } catch (error) {
        console.error("Init Error:", error);
        showError("Erro de conexão.");
    }
}

function applyBranding(config) {
    if (!config) return;

    if (config.logoUrl && DOM.companyLogo && DOM.defaultHeader) {
        DOM.companyLogo.src = config.logoUrl;
        DOM.companyLogo.classList.remove('hidden');
        DOM.defaultHeader.classList.add('hidden');
    }

    if (config.whatsapp) {
        let phone = config.whatsapp.replace(/\D/g, ''); 
        if (phone.startsWith('55') && phone.length > 11) {
            phone = phone.substring(2);
        }
        state.companyWhatsapp = phone; 

        if (DOM.companyPhone) {
            const displayPhone = phone.length > 2
                ? `(${phone.slice(0,2)}) ${phone.slice(2,7)}-${phone.slice(7)}`
                : phone;
            DOM.companyPhone.textContent = `Dúvidas? Fale conosco: ${displayPhone}`;
            DOM.companyPhone.classList.remove('hidden');
        }
    }
}

// --- 5. RENDERIZAÇÃO ---
function renderInterface() {
    DOM.orderInfo.classList.remove('hidden');
    document.title = `${state.targetPart.type} - Preenchimento`;
    if(DOM.defaultHeader.querySelector('h1')) DOM.defaultHeader.querySelector('h1').textContent = state.targetPart.type;
    if(DOM.defaultHeader.querySelector('p')) DOM.defaultHeader.querySelector('p').textContent = state.orderData.clientName;
    
    if(DOM.clientName) DOM.clientName.innerHTML = `<span class="text-gray-500 text-xs uppercase block">Modelo</span> ${state.targetPart.material || 'Padrão'}`;
    if(DOM.deliveryDate) DOM.deliveryDate.innerHTML = `<span class="text-gray-500 text-xs uppercase block">Cor Predom.</span> ${state.targetPart.colorMain || 'Única'}`;
}

function updateListUI() {
    DOM.itemsList.innerHTML = '';
    DOM.listCountBadge.textContent = state.items.length;
    DOM.totalItemsDisplay.textContent = `${state.items.length} novos itens`;

    state.items.length > 0 
        ? (DOM.listContainer.classList.remove('hidden'), DOM.fixedFooter.classList.remove('hidden'))
        : (DOM.listContainer.classList.add('hidden'), DOM.fixedFooter.classList.add('hidden'));

    state.items.forEach((item, index) => {
        const shortSize = item.size.split(' ')[0]; 
        const card = document.createElement('div');
        card.className = "bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center fade-in mb-2";
        
        card.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="bg-indigo-100 text-indigo-700 font-bold w-12 h-10 flex items-center justify-center rounded-lg text-xs p-1 text-center leading-tight">
                   ${shortSize}
                </div>
                <div>
                    <p class="font-bold text-gray-800 leading-none">${item.name}</p>
                    <p class="text-xs text-gray-500 mt-1">
                        ${item.size} ${item.number ? `• Nº ${item.number}` : ''}
                    </p>
                </div>
            </div>
            <button onclick="removeItem(${index})" class="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
            </button>
        `;
        DOM.itemsList.appendChild(card);
    });
}

window.removeItem = (index) => {
    state.items.splice(index, 1);
    updateListUI();
};

function renderSuccessSummary(items) {
    DOM.summaryListContent.innerHTML = '';
    if(!items || items.length === 0) return;

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center text-sm p-3 bg-white rounded border border-gray-200 shadow-sm";
        div.innerHTML = `
            <div class="flex-1">
                <span class="font-bold text-gray-800">${item.name}</span>
                <span class="text-gray-400 mx-1">-</span>
                <span class="font-semibold text-indigo-700">${item.size}</span>
                ${item.number ? `<span class="text-gray-400 mx-1">-</span> <span class="text-gray-800 font-mono">${item.number}</span>` : ''}
            </div>
        `;
        DOM.summaryListContent.appendChild(div);
    });
}

// --- 7. AÇÕES E FLUXO DE ENCERRAMENTO ---

function injectFinishButton() {
    if (document.getElementById('finishInteractionBtn')) return;

    const btnContainer = DOM.copySummaryBtn.parentNode;
    if (!btnContainer) return;

    const finishBtn = document.createElement('button');
    finishBtn.id = 'finishInteractionBtn';
    finishBtn.className = "w-full py-3 mt-3 rounded-xl border border-gray-200 text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-700 transition-colors text-sm flex items-center justify-center gap-2";
    finishBtn.innerHTML = `<span>Encerrar Atendimento</span>`;
    
    finishBtn.onclick = showThankYouScreen;
    btnContainer.appendChild(finishBtn);
}

// [CORREÇÃO] Overlay de Tela Cheia (Garante que apareça por cima de tudo)
function showThankYouScreen() {
    // Esconde o modal de botões para não ficar duplicado
    DOM.successModal.classList.add('hidden');

    // Cria um container fixo que cobre 100% da tela (z-index alto)
    const overlay = document.createElement('div');
    overlay.className = "fixed inset-0 bg-gray-50 z-[100] flex flex-col items-center justify-center p-4 animate-fade-in";
    
    let whatsappLink = '#';
    let hasContact = false;
    if (state.companyWhatsapp) {
        hasContact = true;
        const rawPhone = state.companyWhatsapp.startsWith('55') ? state.companyWhatsapp : `55${state.companyWhatsapp}`;
        whatsappLink = `https://wa.me/${rawPhone}`;
    }

    overlay.innerHTML = `
        <div class="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-gray-100 text-center">
            <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Tudo Pronto!</h2>
            <p class="text-gray-500 mb-8 leading-relaxed">
                Suas informações foram enviadas com sucesso para a fábrica.
            </p>
            
            ${hasContact ? `
            <div class="bg-blue-50 p-5 rounded-xl border border-blue-100 mb-6">
                <p class="text-xs font-bold text-blue-800 uppercase mb-2 tracking-wide">Precisa de ajuda?</p>
                <p class="text-sm text-blue-700 mb-3">Para alterações ou dúvidas, fale conosco.</p>
                <a href="${whatsappLink}" target="_blank" class="block w-full py-3 bg-white text-blue-600 font-bold rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.68-2.031-.967-.272-.297-.471-.446-.718-.595-.248-.149-.521-.025-.719.198-.198.223-7.733 1.017-.942 1.264s.371.496.842.744c4.05 2.132 5.093 2.503 6.634 3.167.953.411 2.288.375 2.924.269.843-.14 1.758-7.19 2.006-.991.248-.297.422-.496.248-.248-.174-.471-.323-.768-.472z"/></svg>
                    Chamar no WhatsApp
                </a>
            </div>
            ` : ''}
            
            <p class="text-xs text-gray-400">Você já pode fechar esta página.</p>
        </div>
    `;
    
    // Adiciona direto ao corpo do documento para garantir que fique por cima
    document.body.appendChild(overlay);
}

// --- 8. LISTENERS ---

DOM.addItemBtn.addEventListener('click', () => {
    const name = DOM.itemName.value.trim();
    const number = DOM.itemNumber.value.trim();
    const rawSize = DOM.itemSize.value; 

    if (!name) { alert("Digite o nome."); DOM.itemName.focus(); return; }
    if (!rawSize) { alert("Escolha um tamanho."); DOM.itemSize.focus(); return; }

    const prettySize = sizeLabels[rawSize] || rawSize;

    state.items.push({ 
        name: name, 
        number: number || "", 
        size: prettySize 
    });

    DOM.itemName.value = '';
    DOM.itemNumber.value = '';
    DOM.itemName.focus(); 
    updateListUI();
    DOM.listContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
});

function getWeight(sizeStr) {
    return sizeWeights[sizeStr] || 999; 
}

DOM.saveListBtn.addEventListener('click', async () => {
    if (state.items.length === 0) return;
    if (!confirm(`Confirma o envio de ${state.items.length} itens para a fábrica?`)) return;

    const originalText = DOM.saveListBtn.innerHTML;
    DOM.saveListBtn.disabled = true;
    DOM.saveListBtn.innerHTML = `Organizando e Enviando...`;

    try {
        state.items.sort((a, b) => getWeight(a.size) - getWeight(b.size));

        const orderRef = doc(db, "companies", state.companyId, "orders", state.orderId);
        const freshSnap = await getDoc(orderRef);
        
        if (!freshSnap.exists()) throw new Error("Pedido não encontrado.");
        
        const updatedParts = [...freshSnap.data().parts];
        if(!updatedParts[state.partIndex]) throw new Error("Peça original foi removida.");

        if (!updatedParts[state.partIndex].details) updatedParts[state.partIndex].details = [];
        updatedParts[state.partIndex].details.push(...state.items);

        await updateDoc(orderRef, { parts: updatedParts });

        state.lastSentItems = [...state.items]; 
        state.items = []; 
        
        renderSuccessSummary(state.lastSentItems);
        
        DOM.successModal.classList.remove('hidden');
        injectFinishButton(); 
        
        updateListUI(); 

    } catch (error) {
        console.error("Save Error:", error);
        alert(`Erro ao salvar: ${error.message}`);
    } finally {
        DOM.saveListBtn.disabled = false;
        DOM.saveListBtn.innerHTML = originalText;
    }
});

if(DOM.copySummaryBtn) {
    DOM.copySummaryBtn.addEventListener('click', async () => {
        if(!state.lastSentItems.length) return;

        let textToCopy = `*LISTA ENVIADA - ${state.targetPart.type.toUpperCase()}*\n`;
        textToCopy += `Pedido: ${state.orderData.clientName}\n`;
        textToCopy += `----------------------------------\n`;

        state.lastSentItems.forEach(item => {
            const numberPart = item.number ? ` - ${item.number}` : '';
            textToCopy += `${item.name} - ${item.size}${numberPart}\n`;
        });
        
        textToCopy += `----------------------------------\n`;
        textToCopy += `Total: ${state.lastSentItems.length} itens.`;

        try {
            await navigator.clipboard.writeText(textToCopy);
            
            const originalHtml = DOM.copySummaryBtn.innerHTML;
            DOM.copySummaryBtn.innerHTML = `✅ Copiado!`;
            DOM.copySummaryBtn.classList.add('bg-green-100', 'text-green-700', 'border-green-200');
            DOM.copySummaryBtn.classList.remove('bg-indigo-50', 'text-indigo-700');
            
            setTimeout(() => {
                DOM.copySummaryBtn.innerHTML = originalHtml;
                DOM.copySummaryBtn.classList.remove('bg-green-100', 'text-green-700', 'border-green-200');
                DOM.copySummaryBtn.classList.add('bg-indigo-50', 'text-indigo-700');
            }, 2000);

        } catch (err) {
            alert("Erro ao copiar. Tente selecionar manualmente.");
        }
    });
}

function showError(msg) {
    if(DOM.feedback) {
        DOM.feedback.innerHTML = `<div class="bg-red-50 text-red-600 p-6 rounded-xl border border-red-200 shadow-sm text-center"><p class="font-bold text-lg text-gray-800">Atenção</p><p class="text-sm mt-1">${msg}</p></div>`;
        DOM.feedback.classList.remove('hidden');
    }
    if(DOM.inputForm) DOM.inputForm.classList.add('hidden');
    if(DOM.orderInfo) DOM.orderInfo.classList.add('hidden');
    if(DOM.fixedFooter) DOM.fixedFooter.classList.add('hidden');
    if(DOM.statusBadge) DOM.statusBadge.parentElement.classList.add('hidden'); 
}

function updateStatus(text, color) {
    if(DOM.statusBadge) {
        DOM.statusBadge.textContent = text;
        DOM.statusBadge.className = `text-xs px-2 py-1 rounded-full bg-${color}-100 text-${color}-800 border border-${color}-200 font-medium`;
    }
}

init();

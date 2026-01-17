// js/approval.js
// ==========================================================
// MÓDULO PÚBLICO DE APROVAÇÃO (v2.0.3 - Fix Query & DOM)
// Responsabilidade: Renderizar pedido, calcular totais e 
// gerenciar fluxo de aprovação com dados da empresa (SaaS).
// ==========================================================

// 1. Configurações Dinâmicas (Inicia com padrões seguros)
let companyConfig = {
    pixKey: "",           // Será preenchido pelo banco
    pixBeneficiary: "",   // Será preenchido pelo banco
    entryPercentage: 0.50, // Padrão 50% caso não configurado
    whatsappNumber: "",   // Para envio do comprovante e exibição
    logoUrl: ""           // [NOVO] Logo da empresa
};

// 2. Importações
import { db } from './firebaseConfig.js'; 
import { calculateOrderTotals } from './financialCalculator.js'; 
import { 
    collectionGroup, 
    query, 
    where, 
    getDocs, 
    getDoc, 
    doc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Referências DOM ---
const DOM = {
    loading: document.getElementById('loadingState'),
    error: document.getElementById('errorState'),
    content: document.getElementById('orderContent'),
    footer: document.getElementById('actionFooter'),
    headerStatus: document.getElementById('headerStatus'),
    
    // [NOVO] Branding
    brandingHeader: document.getElementById('brandingHeader'),

    // Dados
    clientName: document.getElementById('clientName'),
    deliveryDate: document.getElementById('deliveryDate'),
    mockupGallery: document.getElementById('mockupGallery'),
    itemsTable: document.getElementById('itemsTableBody'),
    obs: document.getElementById('generalObservation'),
    
    // Botões
    btnApprove: document.getElementById('btnApprove'),
    btnRequest: document.getElementById('btnRequestChanges'),
    
    // Modal
    modal: document.getElementById('feedbackModal'),
    modalContent: document.getElementById('modalContent')
};

// Variáveis Globais
let currentOrderDoc = null;
let currentOrderData = null;

// --- Utilitários ---

const formatMoney = (value) => {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateStr) => {
    if(!dateStr) return '--';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

// [NOVO] Formatador de Telefone Visual
const formatPhoneVisual = (phone) => {
    if (!phone) return "";
    // Remove tudo que não é dígito
    let clean = phone.replace(/\D/g, '');
    
    // Se começar com 55 e for longo, remove o DDI
    if (clean.startsWith('55') && clean.length > 11) {
        clean = clean.substring(2);
    }
    
    // Aplica máscara (XX) XXXXX-XXXX
    if (clean.length === 11) {
        return `(${clean.substring(0,2)}) ${clean.substring(2,7)}-${clean.substring(7)}`;
    }
    // Aplica máscara (XX) XXXX-XXXX (Fixo)
    if (clean.length === 10) {
        return `(${clean.substring(0,2)}) ${clean.substring(2,6)}-${clean.substring(6)}`;
    }
    
    return phone; // Retorna original se não casar com máscaras
};

// --- Funções Principais ---

// 1. Carregar Configurações da Empresa (Pix, Logo, Percentual, Whats)
async function loadCompanySettings(companyId) {
    try {
        // TENTATIVA 1: Buscar na nova estrutura (config/payment)
        const configRef = doc(db, `companies/${companyId}/config/payment`);
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const data = configSnap.data();
            companyConfig = {
                ...companyConfig,
                pixKey: data.pixKey || "",
                pixBeneficiary: data.pixBeneficiary || "",
                whatsappNumber: data.whatsappNumber || "", 
                logoUrl: data.logoUrl || "",
                entryPercentage: data.entryPercentage ? parseFloat(data.entryPercentage) / 100 : 0.50
            };
        } else {
            throw new Error("Configuração nova não encontrada, tentando fallback...");
        }

    } catch (error) {
        // TENTATIVA 2 (FALLBACK): Buscar na raiz da empresa (Legado)
        // Necessário para ambientes de Produção que ainda não migraram
        try {
            const companyDoc = await getDoc(doc(db, "companies", companyId));
            if (companyDoc.exists()) {
                const data = companyDoc.data();
                companyConfig = {
                    ...companyConfig,
                    pixKey: data.pixKey || "",
                    pixBeneficiary: data.pixBeneficiary || "",
                    // CORREÇÃO: Lê whatsApp da raiz se não existir na config nova
                    whatsappNumber: data.whatsapp || data.whatsappNumber || "" 
                };
            }
        } catch (fallbackError) {
            console.error("Erro crítico ao carregar dados da empresa:", fallbackError);
        }
    }
}

// 2. Aplicar Branding (Logo e Telefone)
function applyBranding() {
    // A. Injetar Telefone no Cabeçalho
    if (companyConfig.whatsappNumber) {
        const visualPhone = formatPhoneVisual(companyConfig.whatsappNumber);
        
        // Cria elemento de telefone
        const phoneEl = document.createElement('a');
        phoneEl.href = `https://wa.me/${companyConfig.whatsappNumber.replace(/\D/g, '')}`;
        phoneEl.target = "_blank";
        phoneEl.className = "text-sm font-bold text-gray-700 hover:text-green-600 transition-colors block mt-1";
        phoneEl.innerHTML = `<i class="fa-brands fa-whatsapp text-green-500 mr-1"></i>${visualPhone}`;
        
        // Procura onde inserir (substituindo ou adicionando)
        const brandingDiv = DOM.brandingHeader;
        // Se já tiver o container padrão, tenta inserir dentro dele se for compatível
        // Estratégia simples: remove o texto "Confira seu pedido" se quiser substituir, ou adiciona ao lado
        
        // Vamos criar a estrutura visual correta baseada no seu print
        // Se houver logo, substitui o ícone. Se houver telefone, insere.
        
        // Limpa e reconstrói o header de branding para garantir consistência
        let logoHtml = `<div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-primary"><i class="fa-solid fa-shirt text-xl"></i></div>`;
        
        if (companyConfig.logoUrl) {
            logoHtml = `<img src="${companyConfig.logoUrl}" class="w-12 h-12 rounded-full object-contain bg-white border border-gray-200 shadow-sm" alt="Logo">`;
        }
        
        brandingDiv.innerHTML = `
            ${logoHtml}
            <div class="flex flex-col">
                <span class="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Nosso WhatsApp</span>
                ${phoneEl.outerHTML}
            </div>
        `;
    }
}

// 3. Renderizar Pedido
function renderOrder(data, docId) {
    // 3.1 Cabeçalho
    DOM.clientName.textContent = `${data.clientName} - ${data.teamName || ''}`;
    DOM.deliveryDate.textContent = formatDate(data.deliveryDate);
    
    // Status
    DOM.headerStatus.className = "px-4 py-2 rounded-lg text-sm font-bold shadow-sm";
    
    if (data.status === 'Aguardando Aprovação' || data.orderStatus === 'Aguardando Aprovação') {
        DOM.headerStatus.classList.add('bg-blue-100', 'text-blue-800');
        DOM.headerStatus.textContent = 'AGUARDANDO SUA APROVAÇÃO';
        DOM.footer.classList.remove('hidden'); 
    } else if (data.status === 'Aprovado' || data.orderStatus === 'Aprovado' || data.orderStatus === 'Aprovado pelo Cliente') {
        DOM.headerStatus.classList.add('bg-green-100', 'text-green-800');
        DOM.headerStatus.textContent = '✅ PEDIDO APROVADO';
        DOM.footer.classList.add('hidden'); 
    } else if (data.status === 'Correção Solicitada' || data.orderStatus === 'Alteração Solicitada') {
        DOM.headerStatus.classList.add('bg-yellow-100', 'text-yellow-800');
        DOM.headerStatus.textContent = '⚠️ EM ANÁLISE (Correção Solicitada)';
        DOM.footer.classList.add('hidden');
    } else {
        DOM.headerStatus.classList.add('bg-gray-100', 'text-gray-800');
        DOM.headerStatus.textContent = (data.orderStatus || data.status || 'Pendente').toUpperCase();
        
        // Se não for status de ação, esconde footer
        if (!['Pendente', 'Aguardando Aprovação'].includes(data.orderStatus)) {
            DOM.footer.classList.add('hidden');
        } else {
             DOM.footer.classList.remove('hidden');
        }
    }

    // 3.2 Mockups (Imagens)
    DOM.mockupGallery.innerHTML = '';
    // Suporte para ambos os formatos de array de imagens (mockupImages ou mockupUrls)
    const images = data.mockupImages || data.mockupUrls || [];
    
    if (images.length > 0) {
        images.forEach(url => {
            const imgContainer = document.createElement('div');
            imgContainer.className = "relative group rounded-lg overflow-hidden shadow-sm border border-gray-100";
            imgContainer.innerHTML = `
                <img src="${url}" class="w-full h-auto object-cover max-h-[500px]" alt="Arte">
                <a href="${url}" target="_blank" class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <span class="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-700 text-xs px-3 py-1 rounded-full shadow-lg font-bold">
                        <i class="fa-solid fa-expand mr-1"></i> Ver Original
                    </span>
                </a>
            `;
            DOM.mockupGallery.appendChild(imgContainer);
        });
    } else {
        DOM.mockupGallery.innerHTML = '<p class="text-gray-500 text-center col-span-2 py-8">Nenhum layout anexado.</p>';
    }

    // 3.3 Itens e Totais
    DOM.itemsTable.innerHTML = '';
    
    // Tenta usar orderItems (novo) ou parts (antigo)
    const items = data.orderItems || data.parts || [];
    
    if (items.length > 0) {
        items.forEach(item => {
            // Lógica unificada para exibir item
            let itemName = item.type || item.name || 'Item Personalizado';
            let details = item.details || item.material || '';
            let quantity = item.quantity || 0;

            // Se for estrutura antiga (parts), calcula quantidade somando tamanhos
            if (!item.quantity && item.sizes) {
                 // Soma complexa de tamanhos aninhados
                 quantity = Object.values(item.sizes).flatMap(x => typeof x === 'object' ? Object.values(x) : x).reduce((a,b)=> Number(a)+Number(b), 0);
            }

            const tr = document.createElement('tr');
            tr.className = "border-b last:border-0";
            tr.innerHTML = `
                <td class="py-3">
                    <div class="font-medium text-gray-800">${itemName}</div>
                    <div class="text-xs text-gray-500">${details}</div>
                </td>
                <td class="py-3 text-right font-medium text-gray-700">${quantity}</td>
            `;
            DOM.itemsTable.appendChild(tr);
        });
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-3 text-gray-500 italic">Detalhes consolidados (ver totais)</td>
            <td class="py-3 text-right">-</td>
        `;
        DOM.itemsTable.appendChild(tr);
    }

    // Cálculo Financeiro (Card)
    const totals = calculateOrderTotals(data); // Passa o objeto completo para o calculador
    
    // Inserir Card Financeiro (Lógica de UI)
    const financeHtml = `
        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 space-y-2 text-sm">
            <div class="flex justify-between text-gray-600">
                <span>Total do Pedido</span>
                <span class="font-bold">${formatMoney(totals.total || totals.totalValue)}</span>
            </div>
            ${(totals.paid > 0) ? `
            <div class="flex justify-between text-blue-600">
                <span>Pago / Sinal</span>
                <span>- ${formatMoney(totals.paid)}</span>
            </div>` : ''}
             <div class="flex justify-between text-red-600 font-bold text-base mt-2 pt-2 border-t border-slate-200">
                <span>Restante</span>
                <span>${formatMoney(totals.remaining || (totals.totalValue - (totals.paid || 0)))}</span>
            </div>
        </div>
    `;
    
    // Remove anterior se existir e adiciona novo
    const oldFin = document.getElementById('financeCard');
    if(oldFin) oldFin.remove();
    
    const finDiv = document.createElement('div');
    finDiv.id = 'financeCard';
    finDiv.innerHTML = financeHtml;
    DOM.itemsTable.parentElement.after(finDiv);

    // Obs
    if(data.observations || data.generalObservation) {
        DOM.obs.textContent = data.observations || data.generalObservation;
    }
}

// 4. Inicialização (Entrada do Script)
async function init() {
    try {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('id');

        if (!orderId) throw new Error("Link inválido (ID não fornecido).");

        // CORREÇÃO CRÍTICA: Volta a usar 'id' em vez de 'orderId'
        // Isso evita o erro de índice no Firebase e encontra o documento correto
        const ordersQuery = query(collectionGroup(db, 'orders'), where('id', '==', orderId));
        const querySnapshot = await getDocs(ordersQuery);

        if (querySnapshot.empty) {
            // Tratamento visual quando não acha
            DOM.loading.classList.add('hidden');
            DOM.error.classList.remove('hidden');
            return;
        }

        currentOrderDoc = querySnapshot.docs[0];
        currentOrderData = currentOrderDoc.data();
        
        // Pega ID da Empresa dona do pedido
        const companyId = currentOrderDoc.ref.parent.parent.id;

        // A. Carrega Configurações
        await loadCompanySettings(companyId);

        // B. Aplica Branding (Logo e Fone)
        applyBranding();

        // C. Renderiza Pedido
        renderOrder(currentOrderData, currentOrderDoc.id);

        // Remove Loading
        DOM.loading.classList.add('hidden');
        DOM.content.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        DOM.loading.classList.add('hidden');
        DOM.error.classList.remove('hidden');
        
        // CORREÇÃO DOM: Usa o seletor correto para o parágrafo de erro
        const pError = DOM.error.querySelector('p');
        if(pError) pError.textContent = "Erro técnico: " + err.message;
    }
}

// 5. Ações de Botões

// Aprovado
DOM.btnApprove.addEventListener('click', async () => {
    if(!confirm("Confirmar aprovação do layout e dos dados?")) return;

    const originalBtnText = DOM.btnApprove.innerHTML;
    DOM.btnApprove.innerHTML = "Processando...";
    DOM.btnApprove.disabled = true;

    try {
        // Atualiza Status
        await updateDoc(currentOrderDoc.ref, {
            status: 'Aprovado', // Legado
            orderStatus: 'Aprovado pelo Cliente', // Novo
            approvedAt: new Date().toISOString(),
            approvedByClient: true
        });

        alert("✅ Pedido aprovado com sucesso! Vamos iniciar a produção.");
        location.reload();

    } catch (err) {
        alert("Erro ao aprovar: " + err.message);
        DOM.btnApprove.innerHTML = originalBtnText;
        DOM.btnApprove.disabled = false;
    }
});

// Solicitar Alteração - Abre Modal
DOM.btnRequest.addEventListener('click', () => {
    DOM.modalContent.innerHTML = `
        <h3 class="text-lg font-bold text-gray-800 mb-2">O que precisa ajustar?</h3>
        <textarea id="feedbackText" class="w-full p-3 border rounded-lg mb-4 h-32" placeholder="Ex: O nome no peito está errado..."></textarea>
        <div class="flex gap-2">
            <button onclick="closeModal()" class="flex-1 py-2 bg-gray-200 rounded-lg font-bold">Cancelar</button>
            <button onclick="sendFeedback()" class="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold">Enviar</button>
        </div>
    `;
    DOM.modal.classList.remove('hidden');
});

// Funções Globais para o Modal
window.sendFeedback = async () => {
    const feedbackText = document.getElementById('feedbackText').value.trim();
    if (!feedbackText) return alert("Por favor, descreva o ajuste.");

    try {
        await updateDoc(currentOrderDoc.ref, {
            status: 'Correção Solicitada',
            orderStatus: 'Alteração Solicitada',
            clientFeedback: feedbackText,
            feedbackAt: new Date().toISOString()
        });

        alert("Solicitação enviada!");
        location.reload();

    } catch (err) {
        alert("Erro ao enviar: " + err.message);
    }
};

window.closeModal = () => {
    DOM.modal.classList.add('hidden');
};

// Iniciar
init();

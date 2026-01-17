// js/approval.js
// ==========================================================
// MÓDULO PÚBLICO DE APROVAÇÃO (v2.0.2 - Hotfix Fallback WhatsApp)
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
        // Definida no Dossiê Técnico como padrão oficial
        const configRef = doc(db, `companies/${companyId}/config/payment`);
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const data = configSnap.data();
            companyConfig = {
                ...companyConfig,
                pixKey: data.pixKey || "",
                pixBeneficiary: data.pixBeneficiary || "",
                whatsappNumber: data.whatsappNumber || "", // Pega da config nova
                logoUrl: data.logoUrl || "",
                entryPercentage: data.entryPercentage ? parseFloat(data.entryPercentage) / 100 : 0.50
            };
            console.log("Configuração carregada de config/payment");
        } else {
            throw new Error("Configuração nova não encontrada, tentando fallback...");
        }

    } catch (error) {
        // TENTATIVA 2 (FALLBACK): Buscar na raiz da empresa (Legado)
        // Necessário para ambientes de Produção que ainda não migraram
        console.warn("Usando configuração fallback (raiz da empresa):", error);
        try {
            const companyDoc = await getDoc(doc(db, "companies", companyId));
            if (companyDoc.exists()) {
                const data = companyDoc.data();
                companyConfig = {
                    ...companyConfig,
                    pixKey: data.pixKey || "",
                    pixBeneficiary: data.pixBeneficiary || "",
                    // CORREÇÃO APLICADA AQUI:
                    // Adicionado fallback para ler o whatsapp da raiz se não existir na config nova
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
        phoneEl.innerText = visualPhone; // Ex: (83) 99916-3523
        
        // Insere após o rótulo "NOSSO WHATSAPP"
        // O HTML tem: <div> <p>NOSSO WHATSAPP</p> </div>
        const labelContainer = DOM.brandingHeader.querySelector('div:last-child');
        if(labelContainer) {
            labelContainer.appendChild(phoneEl);
        }
    } else {
        // Se não tiver telefone (erro), mantém comportamento padrão ou esconde
        console.warn("Nenhum telefone configurado para exibição.");
    }

    // B. Injetar Logo (se houver)
    if (companyConfig.logoUrl) {
        const imgContainer = DOM.brandingHeader.querySelector('.w-12'); // A div com fundo cinza
        if (imgContainer) {
            imgContainer.innerHTML = ''; // Limpa o ícone padrão
            const img = document.createElement('img');
            img.src = companyConfig.logoUrl;
            img.alt = "Logo da Empresa";
            img.className = "w-full h-full object-contain rounded-full"; // Ajuste visual
            imgContainer.appendChild(img);
            imgContainer.classList.remove('bg-gray-100'); // Remove fundo cinza pra ficar clean
        }
    }
}

// 3. Renderizar Pedido
function renderOrder(data, docId) {
    // 3.1 Cabeçalho
    DOM.clientName.textContent = `${data.clientName} - ${data.teamName || 'Cliente Final'}`;
    DOM.deliveryDate.textContent = formatDate(data.deliveryDate);
    
    // Status
    DOM.headerStatus.className = "px-4 py-2 rounded-lg text-sm font-bold shadow-sm";
    
    if (data.status === 'Aguardando Aprovação') {
        DOM.headerStatus.classList.add('bg-blue-100', 'text-blue-800');
        DOM.headerStatus.textContent = 'AGUARDANDO SUA APROVAÇÃO';
        DOM.footer.classList.remove('hidden'); // Mostra botões
    } else if (data.status === 'Aprovado') {
        DOM.headerStatus.classList.add('bg-green-100', 'text-green-800');
        DOM.headerStatus.textContent = '✅ PEDIDO APROVADO';
        DOM.footer.classList.add('hidden'); // Esconde botões
    } else if (data.status === 'Correção Solicitada') {
        DOM.headerStatus.classList.add('bg-yellow-100', 'text-yellow-800');
        DOM.headerStatus.textContent = '⚠️ EM ANÁLISE (Correção Solicitada)';
        DOM.footer.classList.add('hidden');
    } else {
        DOM.headerStatus.classList.add('bg-gray-100', 'text-gray-800');
        DOM.headerStatus.textContent = data.status.toUpperCase();
        DOM.footer.classList.add('hidden');
    }

    // 3.2 Mockups (Imagens)
    DOM.mockupGallery.innerHTML = '';
    if (data.mockupImages && data.mockupImages.length > 0) {
        data.mockupImages.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.className = "w-full h-64 object-contain bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:scale-105 transition-transform";
            img.onclick = () => window.open(url, '_blank');
            DOM.mockupGallery.appendChild(img);
        });
    } else {
        DOM.mockupGallery.innerHTML = '<p class="text-gray-500 text-center col-span-2 py-8">Nenhum layout anexado.</p>';
    }

    // 3.3 Itens e Totais
    DOM.itemsTable.innerHTML = '';
    
    // Se tiver itens detalhados (Novo padrão)
    if (data.orderItems && data.orderItems.length > 0) {
        data.orderItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "border-b last:border-0";
            tr.innerHTML = `
                <td class="py-3">
                    <div class="font-medium text-gray-800">${item.type}</div>
                    <div class="text-xs text-gray-500">${item.details || ''}</div>
                    ${item.name ? `<div class="text-xs text-blue-600 font-bold mt-1">Nome: ${item.name}</div>` : ''}
                    ${item.number ? `<div class="text-xs text-blue-600 font-bold">Número: ${item.number}</div>` : ''}
                    ${item.size ? `<span class="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded mt-1">Tam: ${item.size}</span>` : ''}
                </td>
                <td class="py-3 text-right font-medium text-gray-700">${item.quantity}</td>
            `;
            DOM.itemsTable.appendChild(tr);
        });
    } else {
        // Legado (se não tiver itens detalhados, tenta usar dados gerais)
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-3 text-gray-500 italic">Detalhes consolidados (ver totais)</td>
            <td class="py-3 text-right">-</td>
        `;
        DOM.itemsTable.appendChild(tr);
    }

    // Cálculo Financeiro
    const totals = calculateOrderTotals(data.orderItems || [], data.additionalServices || [], data.discount || 0);
    
    // Atualiza resumo financeiro na tela
    document.getElementById('totalQty').textContent = totals.totalQuantity;
    document.getElementById('totalValue').textContent = formatMoney(totals.totalValue);
    
    // Entrada (Calculada com base na % da empresa)
    const entryValue = totals.totalValue * companyConfig.entryPercentage;
    document.getElementById('entryValue').textContent = formatMoney(entryValue);

    // Obs
    DOM.obs.textContent = data.observations || "Nenhuma observação adicional.";
}

// 4. Inicialização (Entrada do Script)
async function init() {
    try {
        // Pega ID da URL (?id=...)
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('id');

        if (!orderId) throw new Error("Link inválido (ID não fornecido).");

        // Busca Pedido (Collection Group para achar independente da empresa)
        const ordersQuery = query(collectionGroup(db, 'orders'), where('orderId', '==', orderId));
        const querySnapshot = await getDocs(ordersQuery);

        if (querySnapshot.empty) throw new Error("Pedido não encontrado ou link expirado.");

        currentOrderDoc = querySnapshot.docs[0];
        currentOrderData = currentOrderDoc.data();
        
        // Pega ID da Empresa dona do pedido
        const companyId = currentOrderDoc.ref.parent.parent.id;

        // A. Carrega Configurações da Empresa (Await para garantir dados antes de renderizar)
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
        document.getElementById('errorMessage').textContent = err.message;
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
            status: 'Aprovado',
            approvedAt: new Date().toISOString(),
            approvedByClient: true
        });

        // Feedback Visual
        alert("✅ Pedido aprovado com sucesso! Vamos iniciar a produção.");
        location.reload();

    } catch (err) {
        alert("Erro ao aprovar: " + err.message);
        DOM.btnApprove.innerHTML = originalBtnText;
        DOM.btnApprove.disabled = false;
    }
});

// Solicitar Alteração
DOM.btnRequest.addEventListener('click', () => {
    DOM.modal.classList.remove('hidden');
});

// Enviar Feedback (Modal)
window.sendFeedback = async () => {
    const feedbackText = document.getElementById('feedbackText').value.trim();
    if (!feedbackText) return alert("Por favor, descreva o que precisa ser alterado.");

    const btn = document.querySelector('#feedbackModal button[onclick="sendFeedback()"]');
    const originalText = btn.innerText;
    btn.innerText = "Enviando...";
    btn.disabled = true;

    try {
        await updateDoc(currentOrderDoc.ref, {
            status: 'Correção Solicitada',
            clientFeedback: feedbackText,
            feedbackAt: new Date().toISOString()
        });

        alert("Solicitação enviada! Entraremos em contato para ajustar.");
        location.reload();

    } catch (err) {
        alert("Erro ao enviar: " + err.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.closeModal = () => {
    DOM.modal.classList.add('hidden');
};

// Iniciar
init();

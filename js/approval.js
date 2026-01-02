// js/approval.js
// ==========================================================
// MÓDULO PÚBLICO DE APROVAÇÃO (v1.0.2 - AWAITING APPROVAL SUPPORT)
// Responsabilidade: Renderizar pedido para cliente final
// e gerenciar interações de Aprovação/Ajuste.
// ==========================================================

// 1. Importamos o banco de dados PRONTO do seu arquivo de configuração
import { db } from './firebaseConfig.js'; 

// 2. Importamos apenas as ferramentas necessárias da MESMA versão do seu projeto (11.6.1)
import { 
    collectionGroup, 
    query, 
    where, 
    getDocs, 
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

// Variável global para guardar referência do documento atual
let currentOrderDoc = null;
let currentOrderData = null;

// --- Utilitários de Renderização ---

const formatDate = (dateStr) => {
    if(!dateStr) return '--';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

const showModal = (htmlContent, autoClose = false) => {
    DOM.modalContent.innerHTML = htmlContent;
    DOM.modal.classList.remove('hidden');
    if (autoClose) {
        setTimeout(() => DOM.modal.classList.add('hidden'), 3000);
    }
};

const closeModal = () => DOM.modal.classList.add('hidden');

// --- Lógica Principal (Load Order) ---

const loadOrder = async () => {
    try {
        // Pega ID da URL
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('id');

        if (!orderId) throw new Error("ID não fornecido");

        // Busca Otimizada (Collection Group)
        // Procura em TODAS as coleções chamadas 'orders' pelo ID específico
        const q = query(collectionGroup(db, 'orders'), where('id', '==', orderId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            DOM.loading.classList.add('hidden');
            DOM.error.classList.remove('hidden');
            DOM.headerStatus.innerText = "Não Encontrado";
            DOM.headerStatus.className = "text-xs font-bold uppercase px-2 py-1 rounded bg-red-100 text-red-600";
            return;
        }

        // Pedido Encontrado
        const docRef = querySnapshot.docs[0];
        currentOrderDoc = docRef.ref;
        currentOrderData = docRef.data();
        
        renderOrder(currentOrderData);

    } catch (error) {
        console.error("Erro ao carregar:", error);
        DOM.loading.classList.add('hidden');
        DOM.error.classList.remove('hidden');
        DOM.error.querySelector('p').textContent = "Erro de conexão ou link inválido.";
    }
};

// --- Renderização ---

const renderOrder = (order) => {
    // A. Cabeçalho
    DOM.clientName.textContent = order.clientName;
    DOM.deliveryDate.textContent = formatDate(order.deliveryDate);
    
    // Status Visual
    // Adicionado mapeamento para 'Aguardando Aprovação'
    const statusMap = {
        'Pendente': { color: 'bg-yellow-100 text-yellow-800', label: 'Novo / Pendente' },
        'Aguardando Aprovação': { color: 'bg-cyan-100 text-cyan-800', label: 'Aguardando Sua Aprovação' }, // Visual Ciano
        'Aprovado pelo Cliente': { color: 'bg-green-100 text-green-800', label: 'Aprovado' },
        'Alteração Solicitada': { color: 'bg-red-100 text-red-800', label: 'Alteração Solicitada' },
        'Em Produção': { color: 'bg-blue-100 text-blue-800', label: 'Em Produção' },
        'Entregue': { color: 'bg-gray-100 text-gray-800', label: 'Entregue' }
    };
    
    // Fallback seguro se o status não estiver mapeado
    const statusConfig = statusMap[order.orderStatus] || { color: 'bg-gray-100 text-gray-800', label: order.orderStatus };
    DOM.headerStatus.className = `text-xs font-bold uppercase px-2 py-1 rounded ${statusConfig.color}`;
    DOM.headerStatus.textContent = statusConfig.label;

    // B. Mockups (Galeria)
    DOM.mockupGallery.innerHTML = '';
    if (order.mockupUrls && order.mockupUrls.length > 0) {
        order.mockupUrls.forEach(url => {
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
        DOM.mockupGallery.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Nenhuma imagem anexada.</p>';
    }

    // C. Itens (Tabela Simplificada)
    DOM.itemsTable.innerHTML = '';
    (order.parts || []).forEach(p => {
        let detailsHtml = `<span class="font-bold text-gray-700">${p.type}</span>`;
        detailsHtml += `<div class="text-xs text-gray-500 mt-0.5">${p.material} | ${p.colorMain}</div>`;
        
        // Formatação de Tamanhos
        if (p.partInputType === 'comum') {
            if (p.sizes) {
                const sizesStr = Object.entries(p.sizes).map(([cat, sizesObj]) => {
                    const s = Object.entries(sizesObj)
                        .filter(([,q]) => q > 0)
                        .map(([k,v]) => `${k}(${v})`).join(', ');
                    return s ? `<div class="mt-1"><span class="font-semibold text-gray-600 text-[10px] uppercase">${cat}:</span> ${s}</div>` : '';
                }).join('');
                detailsHtml += sizesStr;
            }
            if(p.specifics && p.specifics.length) {
                detailsHtml += `<div class="mt-1 text-xs text-blue-600"><i class="fa-solid fa-ruler-combined mr-1"></i>${p.specifics.length} item(s) sob medida</div>`;
            }
        } else if (p.details && p.details.length) {
            detailsHtml += `<div class="mt-1 text-xs bg-slate-50 p-1 rounded border border-slate-100">
                <div class="font-semibold text-gray-500 mb-1">Lista de Nomes (${p.details.length}):</div>
                ${p.details.map(d => `<span class="inline-block bg-white border px-1 rounded mr-1 mb-1">${d.name} (${d.size})</span>`).join('')}
            </div>`;
        }

        const totalQty = (Object.values(p.sizes || {}).flatMap(x=>Object.values(x)).reduce((a,b)=>a+b,0)) 
                       + (p.specifics?.length||0) 
                       + (p.details?.length||0);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-3 align-top border-b border-gray-50">${detailsHtml}</td>
            <td class="p-3 align-top text-center font-bold text-gray-700 border-b border-gray-50">${totalQty}</td>
        `;
        DOM.itemsTable.appendChild(row);
    });

    // D. Observações
    if (order.generalObservation) {
        DOM.obs.textContent = order.generalObservation;
        DOM.obs.className = "text-gray-700 text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-100";
    }

    // E. Controle do Footer (Ação)
    // AQUI ESTÁ A CORREÇÃO: Permitimos interação também se for 'Aguardando Aprovação'
    const isActionable = [
        'Pendente', 
        'Aguardando Aprovação', // <--- Permite aprovar/rejeitar
        'Alteração Solicitada'  // Permite ver os botões caso o cliente mude de ideia antes da sua edição
    ].includes(order.orderStatus);
    
    if (isActionable) {
        DOM.loading.classList.add('hidden');
        DOM.content.classList.remove('hidden');
        DOM.footer.classList.remove('hidden'); // Exibe os botões
    } else {
        DOM.loading.classList.add('hidden');
        DOM.content.classList.remove('hidden');
        DOM.footer.classList.add('hidden'); // Esconde os botões
        
        // Mensagem de Bloqueio (Caso já aprovado ou finalizado)
        const alertDiv = document.createElement('div');
        const statusLabel = statusMap[order.orderStatus] ? statusMap[order.orderStatus].label : order.orderStatus;
        
        alertDiv.className = "bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm text-center mb-4";
        alertDiv.innerHTML = `<i class="fa-solid fa-lock mr-2"></i>Este pedido já está em: <strong>${statusLabel}</strong>.`;
        
        // Remove alertas antigos para não acumular
        const existingAlert = DOM.content.querySelector('.bg-blue-50');
        if (existingAlert) existingAlert.remove();
        
        DOM.content.prepend(alertDiv);
    }
};

// --- Ações ---

// APROVAR
DOM.btnApprove.addEventListener('click', async () => {
    if (!currentOrderDoc) return;

    const confirmed = confirm("Tem certeza que deseja APROVAR este layout para produção?");
    if (!confirmed) return;

    DOM.btnApprove.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processando...';
    DOM.btnApprove.disabled = true;

    try {
        await updateDoc(currentOrderDoc, {
            orderStatus: 'Aprovado pelo Cliente',
            approvalDate: new Date().toISOString(),
            approvalMeta: {
                userAgent: navigator.userAgent,
                timestamp: Date.now()
            }
        });

        showModal(`
            <div class="text-green-500 text-5xl mb-4"><i class="fa-solid fa-circle-check"></i></div>
            <h3 class="text-xl font-bold text-gray-800 mb-2">Sucesso!</h3>
            <p class="text-gray-600">O layout foi aprovado. A produção será iniciada em breve.</p>
            <button onclick="location.reload()" class="mt-6 bg-gray-800 text-white px-6 py-2 rounded-lg w-full">OK</button>
        `);
        
        DOM.footer.classList.add('hidden');

    } catch (error) {
        console.error("Erro ao aprovar:", error);
        alert("Ocorreu um erro ao salvar a aprovação. Tente novamente.");
        DOM.btnApprove.innerHTML = '<i class="fa-solid fa-check-double"></i> APROVAR ARTE';
        DOM.btnApprove.disabled = false;
    }
});

// SOLICITAR ALTERAÇÃO
DOM.btnRequest.addEventListener('click', () => {
    showModal(`
        <h3 class="text-lg font-bold text-gray-800 mb-2 text-left">O que precisa ser ajustado?</h3>
        <textarea id="changeReason" class="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32" placeholder="Ex: O nome 'João' está errado, deveria ser 'John'. Ou: Aumentar a logo nas costas."></textarea>
        <div class="flex gap-3 mt-4">
            <button id="cancelModal" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold">Cancelar</button>
            <button id="confirmChange" class="flex-1 bg-red-500 text-white py-2 rounded-lg font-bold hover:bg-red-600">Enviar Solicitação</button>
        </div>
    `);

    document.getElementById('cancelModal').onclick = closeModal;
    
    document.getElementById('confirmChange').onclick = async () => {
        const reason = document.getElementById('changeReason').value.trim();
        if (!reason) return alert("Por favor, descreva o ajuste necessário.");

        const btn = document.getElementById('confirmChange');
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...';
        btn.disabled = true;

        try {
            const newObs = (currentOrderData.generalObservation || '') + `\n\n[Solicitação do Cliente em ${new Date().toLocaleDateString()}]: ${reason}`;

            await updateDoc(currentOrderDoc, {
                orderStatus: 'Alteração Solicitada',
                generalObservation: newObs
            });

            showModal(`
                <div class="text-blue-500 text-5xl mb-4"><i class="fa-solid fa-paper-plane"></i></div>
                <h3 class="text-xl font-bold text-gray-800 mb-2">Solicitação Enviada</h3>
                <p class="text-gray-600">Recebemos seu pedido de ajuste. Entraremos em contato em breve.</p>
                <button onclick="location.reload()" class="mt-6 bg-gray-800 text-white px-6 py-2 rounded-lg w-full">OK</button>
            `);

        } catch (error) {
            console.error("Erro ao solicitar:", error);
            alert("Erro ao enviar solicitação.");
            closeModal();
        }
    };
});

// Inicializar
loadOrder();

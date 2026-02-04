// js/listeners/catalogListeners.js
// ========================================================
// OUVINTES DO CATÁLOGO (v2.2 - Final Production Fix)
// Responsabilidade: Interface, Upsell e Geração de Link Correto
// ========================================================

import { auth } from "../firebaseConfig.js";
import { renderCatalogUI } from "../ui/catalogRenderer.js"; // Certifique-se que o render aceita (items, total, active)
import { 
    getCatalogItems, 
    addCatalogItem, 
    updateCatalogItem, 
    deleteCatalogItem, 
    toggleItemStatus, 
    uploadCatalogImage,
    getRealCompanyId // <--- A IMPORTAÇÃO DE OURO
} from "../services/catalogService.js";

const DOM = {
    // Navegação
    menuBtn: document.getElementById('catalogDashboardBtn'),
    catalogView: document.getElementById('catalogDashboard'),
    ordersView: document.getElementById('ordersDashboard'),
    financeView: document.getElementById('financeDashboard'),
    searchContainer: document.getElementById('searchContainer'),
    financeMenuBtn: document.getElementById('financeDashboardBtn'),

    // Modal e Forms
    modal: document.getElementById('catalogModal'),
    form: document.getElementById('catalogForm'),
    saveBtn: document.getElementById('saveCatalogBtn'), // Verifique se o ID no HTML é saveCatalogBtn ou saveProductBtn
    cancelBtn: document.getElementById('cancelCatalogBtn'),
    closeXBtn: document.getElementById('closeCatalogModalBtn'),
    openModalBtn: document.getElementById('addCatalogItemBtn'), // Botão "Novo Produto"

    // Inputs do Form
    itemId: document.getElementById('catalogItemId'),
    title: document.getElementById('catalogTitle'),
    category: document.getElementById('catalogCategory'),
    price: document.getElementById('catalogPrice'),
    description: document.getElementById('catalogDescription'),
    imageInput: document.getElementById('catalogImageInput'), // Verifique ID no HTML (ex: prodImage)
    imagePreview: document.getElementById('catalogImagePreview'),
    imagePlaceholder: document.getElementById('catalogImagePlaceholder'),
    uploadLoader: document.getElementById('catalogUploadLoader'),

    // Interface Principal
    list: document.getElementById('catalogList'), // Onde os cards são renderizados
    storeLinkInput: document.getElementById('storeLinkInput'), // Input que mostra o link
    copyLinkBtn: document.getElementById('copyLinkBtn') // Botão de copiar
};

let tempImageUrl = ""; 

export function initCatalogListeners() {
    
    // 1. Botão do Menu (Upsell & Entrada)
    if (DOM.menuBtn) {
        DOM.menuBtn.classList.remove('hidden');
        
        DOM.menuBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Lógica de Plano (Adapte conforme seu sistema real de planos)
            const userPlan = localStorage.getItem('userPlan'); 
            // Se quiser bloquear: if (userPlan !== 'pro') return alert("Exclusivo Premium");

            await openCatalogDashboard();
        });
    }

    // 2. Correção do "Fantasma" (Ao clicar em Financeiro, esconde Catálogo)
    if (DOM.financeMenuBtn) {
        DOM.financeMenuBtn.addEventListener('click', () => {
            if(DOM.catalogView) DOM.catalogView.classList.add('hidden');
        });
    }

    // 3. Botão Voltar (Adicione este ID ao seu HTML se não existir)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#exitCatalogBtn') || e.target.id === 'backToOrdersBtn') {
            e.preventDefault();
            closeCatalogDashboard();
        }
    });

    // 4. Copiar Link (Nova Funcionalidade)
    if (DOM.copyLinkBtn) {
        DOM.copyLinkBtn.addEventListener('click', copyStoreLink);
    }

    // 5. Modal e Edição
    if (DOM.openModalBtn) DOM.openModalBtn.addEventListener('click', () => openModal());
    if (DOM.cancelBtn) DOM.cancelBtn.addEventListener('click', closeModal);
    if (DOM.closeXBtn) DOM.closeXBtn.addEventListener('click', closeModal);
    if (DOM.imageInput) DOM.imageInput.addEventListener('change', handleImageSelect);
    if (DOM.saveBtn) DOM.saveBtn.addEventListener('click', handleSave);
    
    // 6. Ações na Lista (Delegate)
    if (DOM.list) {
        DOM.list.addEventListener('click', handleListActions);
        DOM.list.addEventListener('change', handleListChanges);
    }
}

// --- NAVEGAÇÃO E CARREGAMENTO ---

async function openCatalogDashboard() {
    // Esconde outros painéis
    if(DOM.ordersView) DOM.ordersView.classList.add('hidden');
    if(DOM.financeView) DOM.financeView.classList.add('hidden');
    if(DOM.searchContainer) DOM.searchContainer.classList.add('hidden');
    
    // Mostra Catálogo com Loading
    DOM.catalogView.classList.remove('hidden');
    
    // Fecha dropdown se existir
    document.getElementById('userDropdown')?.classList.add('hidden');

    try {
        // A. Gera o Link Correto (A Mágica acontece aqui)
        if (DOM.storeLinkInput) {
            const realId = await getRealCompanyId(); // <--- Busca o ID ECP...
            const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '').replace('dashboard', '') + 'catalogo.html';
            DOM.storeLinkInput.value = `${baseUrl}?uid=${realId}`;
        }

        // B. Carrega Dados (O Service já sabe qual ID usar)
        await loadCatalogData();

    } catch (error) {
        console.error("Erro fatal:", error);
        if(DOM.list) DOM.list.innerHTML = `<p class="text-red-500 text-center p-4">Erro ao carregar: ${error.message}</p>`;
    }
}

function closeCatalogDashboard() {
    DOM.catalogView.classList.add('hidden');
    if(DOM.ordersView) DOM.ordersView.classList.remove('hidden');
    if(DOM.searchContainer) DOM.searchContainer.classList.remove('hidden');
}

async function loadCatalogData() {
    try {
        // Chama o service (que usa getRealCompanyId internamente)
        const data = await getCatalogItems(); 
        
        // Renderiza (Ajuste conforme o retorno do seu renderizador)
        // Se o renderCatalogUI esperar (items, companyId), passamos null no ID pois não precisa mais
        renderCatalogUI(data, null); 
        
    } catch (error) {
        console.error(error);
        if(DOM.list) DOM.list.innerHTML = `<p class="text-center text-gray-500 py-10">Não foi possível carregar os produtos.</p>`;
    }
}

// --- MANIPULAÇÃO DO LINK ---

function copyStoreLink() {
    if(!DOM.storeLinkInput) return;
    DOM.storeLinkInput.select();
    document.execCommand('copy');
    
    const originalText = DOM.copyLinkBtn.innerHTML;
    DOM.copyLinkBtn.innerHTML = `<span class="text-green-600 font-bold">Copiado!</span>`;
    setTimeout(() => DOM.copyLinkBtn.innerHTML = originalText, 2000);
}

// --- MODAL ---

function openModal(item = null) {
    DOM.modal.classList.remove('hidden');
    DOM.saveBtn.disabled = false;
    DOM.saveBtn.textContent = item ? "Salvar Alterações" : "Criar Produto";
    
    if(DOM.uploadLoader) DOM.uploadLoader.classList.add('hidden');

    if (item) {
        // Modo Edição
        DOM.itemId.value = item.id;
        DOM.title.value = item.title;
        DOM.category.value = item.category;
        DOM.price.value = item.price;
        DOM.description.value = item.description;
        tempImageUrl = item.imageUrl;
        
        if(DOM.imagePreview) {
            DOM.imagePreview.src = item.imageUrl;
            DOM.imagePreview.classList.remove('hidden');
        }
        if(DOM.imagePlaceholder) DOM.imagePlaceholder.classList.add('hidden');
    } else {
        // Modo Criação
        DOM.form.reset();
        DOM.itemId.value = "";
        tempImageUrl = "";
        if(DOM.imagePreview) DOM.imagePreview.classList.add('hidden');
        if(DOM.imagePlaceholder) DOM.imagePlaceholder.classList.remove('hidden');
    }
}

function closeModal() {
    DOM.modal.classList.add('hidden');
}

// --- UPLOAD E SAVE ---

async function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Preview local imediato
    const reader = new FileReader();
    reader.onload = (ev) => {
        if(DOM.imagePreview) {
            DOM.imagePreview.src = ev.target.result;
            DOM.imagePreview.classList.remove('hidden');
        }
        if(DOM.imagePlaceholder) DOM.imagePlaceholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

async function handleSave(e) {
    e.preventDefault();
    
    // Validação Básica
    const title = DOM.title.value.trim();
    if (!title) return alert("O título é obrigatório.");

    const file = DOM.imageInput.files[0];
    const isEditing = !!DOM.itemId.value;

    // Se for novo e não tiver foto nem URL temporária
    if (!isEditing && !file && !tempImageUrl) return alert("Selecione uma imagem.");

    // UI Loading
    const originalText = DOM.saveBtn.textContent;
    DOM.saveBtn.disabled = true;
    DOM.saveBtn.textContent = "Salvando...";
    if(DOM.uploadLoader) DOM.uploadLoader.classList.remove('hidden');

    try {
        let finalImageUrl = tempImageUrl;
        
        // Se tem arquivo novo, faz upload
        if (file) {
            finalImageUrl = await uploadCatalogImage(file);
        }

        const itemData = {
            title: title,
            category: DOM.category.value.trim(),
            price: DOM.price.value.trim(),
            description: DOM.description.value.trim(),
            imageUrl: finalImageUrl
        };

        if (isEditing) {
            await updateCatalogItem(DOM.itemId.value, itemData);
        } else {
            await addCatalogItem(itemData);
        }

        closeModal();
        await loadCatalogData(); // Recarrega a lista

    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        DOM.saveBtn.disabled = false;
        DOM.saveBtn.textContent = originalText;
        if(DOM.uploadLoader) DOM.uploadLoader.classList.add('hidden');
    }
}

// --- LISTA (Delegation) ---

async function handleListActions(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!action || !id) return;

    if (action === 'deleteItem') {
        if (confirm("Excluir este produto?")) {
            try {
                await deleteCatalogItem(id);
                await loadCatalogData();
            } catch (error) {
                alert("Erro: " + error.message);
            }
        }
    }

    if (action === 'editItem') {
        // Busca os dados atuais na memória ou recarrega
        // Simplificação: Recarrega do banco ou busca no DOM se tiver
        try {
            const data = await getCatalogItems(); 
            // Nota: getCatalogItems agora retorna objeto { items: [] }
            const item = data.items.find(i => i.id === id);
            if (item) openModal(item);
        } catch (err) {
            console.error(err);
        }
    }
}

async function handleListChanges(e) {
    const toggle = e.target;
    if (toggle.type === 'checkbox' && toggle.dataset.action === 'toggleStatus') {
        const id = toggle.dataset.id;
        const newStatus = toggle.checked;

        try {
            await toggleItemStatus(id, newStatus);
            // Opcional: Atualizar contadores visuais
        } catch (error) {
            alert(error.message);
            toggle.checked = !newStatus; // Reverte visualmente em caso de erro
        }
    }
}

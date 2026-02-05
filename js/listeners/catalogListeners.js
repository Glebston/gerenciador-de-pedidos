// js/listeners/catalogListeners.js
// ========================================================
// OUVINTES DO CATÁLOGO (v2.4 - SAFE CLICK MODE)
// Correção Definitiva: Gera o link apenas no clique para evitar uid=null
// ========================================================

import { auth } from "../firebaseConfig.js";
import { renderCatalogUI } from "../ui/catalogRenderer.js"; 
import { 
    getCatalogItems, 
    addCatalogItem, 
    updateCatalogItem, 
    deleteCatalogItem, 
    toggleItemStatus, 
    uploadCatalogImage,
    getRealCompanyId 
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
    saveBtn: document.getElementById('saveCatalogBtn'),
    cancelBtn: document.getElementById('cancelCatalogBtn'),
    closeXBtn: document.getElementById('closeCatalogModalBtn'),
    openModalBtn: document.getElementById('addCatalogItemBtn'),

    // Inputs do Form
    itemId: document.getElementById('catalogItemId'),
    title: document.getElementById('catalogTitle'),
    category: document.getElementById('catalogCategory'),
    price: document.getElementById('catalogPrice'),
    description: document.getElementById('catalogDescription'),
    imageInput: document.getElementById('catalogImageInput'),
    imagePreview: document.getElementById('catalogImagePreview'),
    imagePlaceholder: document.getElementById('catalogImagePlaceholder'),
    uploadLoader: document.getElementById('catalogUploadLoader'),

    // Interface Principal
    list: document.getElementById('catalogList'), 
    storeLinkInput: document.getElementById('storeLinkInput'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    publicStoreBtn: document.getElementById('publicStoreLink') // O Botão do Olhinho
};

let tempImageUrl = ""; 

export function initCatalogListeners() {
    
    // 1. Botão do Menu
    if (DOM.menuBtn) {
        DOM.menuBtn.classList.remove('hidden');
        DOM.menuBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await openCatalogDashboard();
        });
    }

    // 2. Correção do "Fantasma"
    if (DOM.financeMenuBtn) {
        DOM.financeMenuBtn.addEventListener('click', () => {
            if(DOM.catalogView) DOM.catalogView.classList.add('hidden');
        });
    }

    // 3. Botão Voltar
    document.addEventListener('click', (e) => {
        if (e.target.closest('#exitCatalogBtn') || e.target.id === 'backToOrdersBtn') {
            e.preventDefault();
            closeCatalogDashboard();
        }
    });

    // 4. Copiar Link
    if (DOM.copyLinkBtn) {
        DOM.copyLinkBtn.addEventListener('click', copyStoreLink);
    }

    // 5. [NOVO] OUVINTE DO BOTÃO "VER LOJA" (A CORREÇÃO BLINDADA)
    if (DOM.publicStoreBtn) {
        // Remove comportamento padrão do link HTML
        DOM.publicStoreBtn.addEventListener('click', async (e) => {
            e.preventDefault(); // Impede de abrir o href com uid=null
            await handleOpenStoreSafe(); // Abre via código
        });
    }

    // 6. Modal e Edição
    if (DOM.openModalBtn) DOM.openModalBtn.addEventListener('click', () => openModal());
    if (DOM.cancelBtn) DOM.cancelBtn.addEventListener('click', closeModal);
    if (DOM.closeXBtn) DOM.closeXBtn.addEventListener('click', closeModal);
    if (DOM.imageInput) DOM.imageInput.addEventListener('change', handleImageSelect);
    if (DOM.saveBtn) DOM.saveBtn.addEventListener('click', handleSave);
    
    // 7. Ações na Lista
    if (DOM.list) {
        DOM.list.addEventListener('click', handleListActions);
        DOM.list.addEventListener('change', handleListChanges);
    }
}

// --- FUNÇÃO DE ABERTURA SEGURA DA LOJA (NOVA) ---
async function handleOpenStoreSafe() {
    const originalText = DOM.publicStoreBtn.innerHTML;
    
    try {
        // Mostra feedback visual que está processando
        DOM.publicStoreBtn.innerHTML = `<svg class="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        
        // 1. Busca ID Fresquinho
        let realId = await getRealCompanyId();
        const user = auth.currentUser;

        // 2. Validação Agressiva (Impede null, "null", undefined)
        if (!realId || realId === 'null' || realId === 'undefined') {
            console.warn("⚠️ ID inválido detectado na abertura. Usando Fallback.");
            realId = user ? user.uid : null;
        }

        if (!realId) {
            alert("Erro: Não foi possível identificar sua conta. Tente recarregar a página.");
            return;
        }

        // 3. Monta URL e Abre
        const baseUrl = window.location.origin + window.location.pathname
            .replace('index.html', '')
            .replace('dashboard', '') 
            + 'catalogo.html';
        
        const fullUrl = `${baseUrl}?uid=${realId}`;
        
        window.open(fullUrl, '_blank');

    } catch (error) {
        console.error("Erro ao abrir loja:", error);
        alert("Erro ao abrir loja: " + error.message);
    } finally {
        DOM.publicStoreBtn.innerHTML = originalText;
    }
}


// --- NAVEGAÇÃO E CARREGAMENTO ---

async function openCatalogDashboard() {
    if(DOM.ordersView) DOM.ordersView.classList.add('hidden');
    if(DOM.financeView) DOM.financeView.classList.add('hidden');
    if(DOM.searchContainer) DOM.searchContainer.classList.add('hidden');
    
    DOM.catalogView.classList.remove('hidden');
    document.getElementById('userDropdown')?.classList.add('hidden');

    // Garante que o botão público aparece, mesmo que o link ainda não esteja pronto
    if (DOM.publicStoreBtn) DOM.publicStoreBtn.classList.remove('hidden');

    try {
        // Apenas para visualização no Input (Cópia)
        let realId = await getRealCompanyId();
        if (!realId) {
             const user = auth.currentUser;
             realId = user ? user.uid : '';
        }

        const baseUrl = window.location.origin + window.location.pathname
            .replace('index.html', '')
            .replace('dashboard', '') 
            + 'catalogo.html';
        
        if (DOM.storeLinkInput) {
            DOM.storeLinkInput.value = `${baseUrl}?uid=${realId}`;
        }

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
        const data = await getCatalogItems(); 
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
    
    const title = DOM.title.value.trim();
    if (!title) return alert("O título é obrigatório.");

    const file = DOM.imageInput.files[0];
    const isEditing = !!DOM.itemId.value;

    if (!isEditing && !file && !tempImageUrl) return alert("Selecione uma imagem.");

    const originalText = DOM.saveBtn.textContent;
    DOM.saveBtn.disabled = true;
    DOM.saveBtn.textContent = "Salvando...";
    if(DOM.uploadLoader) DOM.uploadLoader.classList.remove('hidden');

    try {
        let finalImageUrl = tempImageUrl;
        
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
        await loadCatalogData(); 

    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        DOM.saveBtn.disabled = false;
        DOM.saveBtn.textContent = originalText;
        if(DOM.uploadLoader) DOM.uploadLoader.classList.add('hidden');
    }
}

// --- LISTA ---

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
        try {
            const data = await getCatalogItems(); 
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
        } catch (error) {
            alert(error.message);
            toggle.checked = !newStatus; 
        }
    }
}

// js/listeners/catalogListeners.js
// ========================================================
// OUVINTES DO CATÁLOGO (v2.0 - Upsell & Navegação Fix)
// ========================================================

import { auth } from "../firebaseConfig.js";
import * as CatalogService from "../services/catalogService.js";
import { renderCatalogUI } from "../ui/catalogRenderer.js";

const DOM = {
    // Navegação Principal
    menuBtn: document.getElementById('catalogDashboardBtn'),
    catalogView: document.getElementById('catalogDashboard'),
    ordersView: document.getElementById('ordersDashboard'),
    financeView: document.getElementById('financeDashboard'),
    searchContainer: document.getElementById('searchContainer'),
    
    // Botões de Interceptação (Para corrigir o "Fantasma")
    financeMenuBtn: document.getElementById('financeDashboardBtn'),
    
    // Botão de Saída (Será criado no HTML no próximo passo)
    exitBtn: document.getElementById('exitCatalogBtn'),

    // Modal
    modal: document.getElementById('catalogModal'),
    form: document.getElementById('catalogForm'),
    saveBtn: document.getElementById('saveCatalogBtn'),
    cancelBtn: document.getElementById('cancelCatalogBtn'),
    closeXBtn: document.getElementById('closeCatalogModalBtn'),
    openModalBtn: document.getElementById('addCatalogItemBtn'),

    // Inputs
    itemId: document.getElementById('catalogItemId'),
    title: document.getElementById('catalogTitle'),
    category: document.getElementById('catalogCategory'),
    price: document.getElementById('catalogPrice'),
    description: document.getElementById('catalogDescription'),
    imageInput: document.getElementById('catalogImageInput'),
    imagePreview: document.getElementById('catalogImagePreview'),
    imagePlaceholder: document.getElementById('catalogImagePlaceholder'),
    uploadLoader: document.getElementById('catalogUploadLoader'),

    // Lista
    list: document.getElementById('catalogList')
};

let currentCompanyId = null;
let tempImageUrl = ""; 

export function initCatalogListeners() {
    
    if (DOM.menuBtn) {
        // --- 1. LÓGICA DE UPSELL (Cadeado) ---
        const userPlan = localStorage.getItem('userPlan');
        const isPremium = (userPlan === 'pro'); // No seu sistema: 'pro' é Premium

        // Mostra o botão para TODOS agora
        DOM.menuBtn.classList.remove('hidden'); 

        // Se NÃO for Premium, muda o visual para "Bloqueado"
        if (!isPremium) {
            DOM.menuBtn.innerHTML = `
                <div class="flex items-center gap-2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Meu Catálogo <span class="text-[10px] bg-gray-200 px-1 rounded ml-1">PRO</span>
                </div>
            `;
            // Remove hover bg-gray-50 para dar sensação de inativo, se quiser
            DOM.menuBtn.classList.add('opacity-75'); 
        }

        // --- 2. CLIQUE NO MENU ---
        DOM.menuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // TRAVA: Se não for Premium, exibe alerta e não abre
            if (!isPremium) {
                // Aqui você pode trocar por um Modal bonito depois
                alert("🔒 FUNCIONALIDADE PREMIUM\n\nO Catálogo Digital é exclusivo do plano Premium.\nFale com o suporte para liberar sua vitrine!");
                return; 
            }

            const user = auth.currentUser;
            if (!user) return;
            
            currentCompanyId = user.uid; 
            switchViewToCatalog();
            loadCatalogData();
        });
    }

    // --- 3. CORREÇÃO DO FANTASMA (Interceptor) ---
    // Quando clicar no Financeiro, garante que o Catálogo some
    if (DOM.financeMenuBtn) {
        DOM.financeMenuBtn.addEventListener('click', () => {
            if(DOM.catalogView) DOM.catalogView.classList.add('hidden');
        });
    }

    // --- 4. BOTÃO VOLTAR (Exit Strategy) ---
    // Esse botão será adicionado ao HTML no Passo 3
    // Usamos 'document.getElementById' dinâmico aqui caso o elemento ainda não exista no DOM load
    document.addEventListener('click', (e) => {
        if (e.target.closest('#exitCatalogBtn')) {
            e.preventDefault();
            // Esconde Catálogo
            DOM.catalogView.classList.add('hidden');
            // Mostra Pedidos (Padrão)
            if(DOM.ordersView) DOM.ordersView.classList.remove('hidden');
            if(DOM.searchContainer) DOM.searchContainer.classList.remove('hidden');
        }
    });

    // --- 5. MODAL E AÇÕES (Manteve igual) ---
    if (DOM.openModalBtn) DOM.openModalBtn.addEventListener('click', () => openModal());
    if (DOM.cancelBtn) DOM.cancelBtn.addEventListener('click', closeModal);
    if (DOM.closeXBtn) DOM.closeXBtn.addEventListener('click', closeModal);
    if (DOM.imageInput) DOM.imageInput.addEventListener('change', handleImageSelect);
    if (DOM.saveBtn) DOM.saveBtn.addEventListener('click', handleSave);
    if (DOM.list) {
        DOM.list.addEventListener('click', handleListActions);
        DOM.list.addEventListener('change', handleListChanges);
    }
}

// --- FUNÇÕES DE NAVEGAÇÃO ---

function switchViewToCatalog() {
    if(DOM.ordersView) DOM.ordersView.classList.add('hidden');
    if(DOM.financeView) DOM.financeView.classList.add('hidden');
    if(DOM.searchContainer) DOM.searchContainer.classList.add('hidden');
    
    DOM.catalogView.classList.remove('hidden');
    
    // Fecha o dropdown do menu para UX melhor
    const dropdown = document.getElementById('userDropdown');
    if(dropdown) dropdown.classList.add('hidden');
}

async function loadCatalogData() {
    if (!currentCompanyId) return;
    try {
        const data = await CatalogService.getCatalogItems(currentCompanyId);
        renderCatalogUI(data, currentCompanyId);
    } catch (error) {
        console.error("Erro ao carregar catálogo:", error);
        DOM.list.innerHTML = `<p class="text-red-500 text-center col-span-full">Erro ao carregar dados.</p>`;
    }
}

// --- FUNÇÕES DO MODAL ---

function openModal(item = null) {
    DOM.modal.classList.remove('hidden');
    DOM.saveBtn.disabled = false;
    DOM.saveBtn.textContent = "Salvar Produto";
    DOM.uploadLoader.classList.add('hidden');

    if (item) {
        DOM.itemId.value = item.id;
        DOM.title.value = item.title;
        DOM.category.value = item.category;
        DOM.price.value = item.price;
        DOM.description.value = item.description;
        tempImageUrl = item.imageUrl;
        DOM.imagePreview.src = item.imageUrl;
        DOM.imagePreview.classList.remove('hidden');
        DOM.imagePlaceholder.classList.add('hidden');
    } else {
        DOM.form.reset();
        DOM.itemId.value = "";
        tempImageUrl = "";
        DOM.imagePreview.src = "";
        DOM.imagePreview.classList.add('hidden');
        DOM.imagePlaceholder.classList.remove('hidden');
    }
}

function closeModal() {
    DOM.modal.classList.add('hidden');
}

// --- UPLOAD E SALVAMENTO ---

async function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        DOM.imagePreview.src = ev.target.result;
        DOM.imagePreview.classList.remove('hidden');
        DOM.imagePlaceholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

async function handleSave(e) {
    e.preventDefault();
    
    const title = DOM.title.value.trim();
    if (!title) { alert("Por favor, informe o título do produto."); return; }

    const file = DOM.imageInput.files[0];
    const isEditing = !!DOM.itemId.value;

    if (!isEditing && !file) { alert("A imagem do produto é obrigatória."); return; }

    const originalText = DOM.saveBtn.textContent;
    DOM.saveBtn.disabled = true;
    DOM.saveBtn.textContent = "Salvando...";
    DOM.uploadLoader.classList.remove('hidden');

    try {
        let finalImageUrl = tempImageUrl;
        if (file) {
            finalImageUrl = await CatalogService.uploadCatalogImage(file);
        }

        const itemData = {
            companyId: currentCompanyId,
            title: title,
            category: DOM.category.value.trim(),
            price: DOM.price.value.trim(),
            description: DOM.description.value.trim(),
            imageUrl: finalImageUrl
        };

        if (isEditing) {
            await CatalogService.updateCatalogItem(DOM.itemId.value, itemData, currentCompanyId);
        } else {
            await CatalogService.addCatalogItem(itemData);
        }

        closeModal();
        await loadCatalogData(); 

    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        DOM.saveBtn.disabled = false;
        DOM.saveBtn.textContent = originalText;
        DOM.uploadLoader.classList.add('hidden');
    }
}

// --- AÇÕES DA LISTA ---

async function handleListActions(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!action || !id) return;

    if (action === 'deleteItem') {
        if (confirm("Tem certeza que deseja excluir este produto?")) {
            try {
                await CatalogService.deleteCatalogItem(id, currentCompanyId);
                await loadCatalogData();
            } catch (error) {
                alert("Erro ao excluir: " + error.message);
            }
        }
    }

    if (action === 'editItem') {
        const result = await CatalogService.getCatalogItems(currentCompanyId);
        const item = result.items.find(i => i.id === id);
        if (item) openModal(item);
    }
}

async function handleListChanges(e) {
    const toggle = e.target;
    if (toggle.type === 'checkbox' && toggle.dataset.action === 'toggleStatus') {
        const id = toggle.dataset.id;
        const newStatus = toggle.checked;

        try {
            await CatalogService.toggleItemStatus(id, newStatus, currentCompanyId);
            await loadCatalogData(); 
        } catch (error) {
            alert(error.message); 
            toggle.checked = !newStatus; 
        }
    }
}

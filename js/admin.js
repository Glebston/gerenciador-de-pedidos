// js/admin.js
// ========================================================
// MÓDULO ADMINISTRATIVO V2 (SaaS Manager)
// Responsável por gerenciar empresas, assinaturas e acessos
// ========================================================

import { db } from './firebaseConfig.js';
import { 
    collection, 
    getDocs, 
    doc, 
    updateDoc, 
    setDoc, 
    writeBatch, 
    serverTimestamp,
    query,
    where,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Cache local para manipulação rápida sem recarregar tudo do banco
let usersCache = [];

export async function initializeAdminPanel() {
    console.log("👑 [ADMIN v2] Inicializando Gerenciador SaaS...");

    const adminBtn = document.getElementById('adminPanelBtn');
    const adminModal = document.getElementById('adminModal');
    const closeBtn = document.getElementById('closeAdminModalBtn');
    const refreshBtn = document.getElementById('adminRefreshBtn');
    const searchInput = document.getElementById('adminSearchInput');
    
    // Listeners básicos
    if (adminBtn) {
        adminBtn.classList.remove('hidden');
        adminBtn.addEventListener('click', () => {
            adminModal.classList.remove('hidden');
            loadUsers(); 
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', () => adminModal.classList.add('hidden'));
    
    if (refreshBtn) refreshBtn.addEventListener('click', loadUsers);
    
    if (searchInput) searchInput.addEventListener('input', (e) => filterUsers(e.target.value));

    // Listener para o novo botão de Criar Empresa (será adicionado no HTML no próximo passo)
    const createBtn = document.getElementById('btnCreateCompany');
    if (createBtn) {
        createBtn.addEventListener('click', handleCreateButton);
    }
}

// --- CORE: LEITURA DE DADOS ---

async function loadUsers() {
    const listBody = document.getElementById('adminUsersList');
    renderLoading(listBody);

    try {
        // Busca apenas empresas que NÃO foram excluídas logicamente
        // Se quiser ver as excluídas, remova o where ou crie um filtro na UI
        const q = query(collection(db, "companies"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        usersCache = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // Filtro manual de exclusão lógica (para garantir performance na query composta)
            if (data.isDeleted) return;

            usersCache.push({
                id: docSnap.id,
                name: data.companyName || "Sem Nome",
                email: data.email || "N/A",
                isBlocked: data.isBlocked || false,
                adminMessage: data.adminMessage || "",
                // Datas
                createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
                lastAccess: data.lastAccess ? new Date(data.lastAccess.seconds * 1000) : null,
                // Financeiro / Assinatura
                dueDate: data.dueDate || null, // Formato YYYY-MM-DD
                isLifetime: data.isLifetime || false
            });
        });

        renderTable(usersCache);

    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
        listBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500">Erro crítico: ${error.message}</td></tr>`;
    }
}

// --- RENDERIZAÇÃO INTELIGENTE ---

function renderTable(users) {
    const listBody = document.getElementById('adminUsersList');
    listBody.innerHTML = '';

    if (users.length === 0) {
        listBody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-500">Nenhuma empresa ativa encontrada.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 border-b last:border-0 transition group";
        
        // Lógica de Status de Vencimento
        const subStatus = calculateSubscriptionStatus(user.dueDate, user.isLifetime);
        
        // Formatação do Último Acesso
        const lastAccessText = user.lastAccess 
            ? user.lastAccess.toLocaleDateString('pt-BR') + ' ' + user.lastAccess.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
            : '<span class="text-gray-300">Nunca acessou</span>';

        row.innerHTML = `
            <td class="p-4 align-top">
                <div class="font-bold text-gray-900">${user.name}</div>
                <div class="text-xs text-gray-500 mb-1">${user.email}</div>
                <div class="text-[10px] text-gray-400 font-mono select-all bg-gray-100 px-1 rounded w-fit" title="Copiar UID">${user.id}</div>
            </td>
            
            <td class="p-4 align-top">
                <div class="text-xs text-gray-600 font-medium">Último Acesso:</div>
                <div class="text-xs text-blue-600 mb-2">${lastAccessText}</div>
                <div class="text-xs text-gray-400">Criado em: ${user.createdAt.toLocaleDateString('pt-BR')}</div>
            </td>

            <td class="p-4 align-top">
                <div class="flex flex-col gap-2">
                    <label class="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" class="lifetime-toggle form-checkbox h-3 w-3 text-purple-600 rounded focus:ring-purple-500" 
                               data-id="${user.id}" ${user.isLifetime ? 'checked' : ''}>
                        <span class="text-xs font-semibold ${user.isLifetime ? 'text-purple-600' : 'text-gray-500'}">
                            ${user.isLifetime ? '♾️ Vitalício' : 'Mensal'}
                        </span>
                    </label>

                    <div class="${user.isLifetime ? 'opacity-50 pointer-events-none' : ''} transition-opacity">
                        <input type="date" value="${user.dueDate || ''}" 
                               class="duedate-input text-xs border border-gray-300 rounded p-1 w-full focus:ring-1 focus:ring-blue-500"
                               data-id="${user.id}">
                    </div>

                    <div id="status-badge-${user.id}" class="text-center">
                        ${getBadgeHtml(subStatus)}
                    </div>
                </div>
            </td>

            <td class="p-4 align-top text-center">
                <label class="relative inline-flex items-center cursor-pointer" title="Bloquear Acesso">
                    <input type="checkbox" class="sr-only peer toggle-block-btn" data-id="${user.id}" ${user.isBlocked ? 'checked' : ''}>
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                </label>
                <div class="text-[10px] mt-1 font-medium ${user.isBlocked ? 'text-red-600' : 'text-green-600'}">
                    ${user.isBlocked ? 'BLOQUEADO' : 'ATIVO'}
                </div>
            </td>

            <td class="p-4 align-top">
                <div class="flex flex-col gap-1">
                    <textarea id="msg-${user.id}" rows="2" 
                              placeholder="Enviar aviso (ex: boleto pendente)..." 
                              class="text-xs border rounded p-2 w-full focus:ring-1 focus:ring-purple-500 bg-gray-50 resize-none">${user.adminMessage}</textarea>
                    <button class="save-msg-btn bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 text-xs py-1 px-2 rounded transition flex items-center justify-center gap-1" data-id="${user.id}">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                        Enviar
                    </button>
                </div>
            </td>

            <td class="p-4 align-top text-right">
                <button class="delete-user-btn text-gray-400 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-full" data-id="${user.id}" title="Excluir Empresa (Lógico)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </td>
        `;
        listBody.appendChild(row);
    });

    attachDynamicListeners();
}

// --- LÓGICA DE NEGÓCIOS ---

function calculateSubscriptionStatus(dueDateString, isLifetime) {
    if (isLifetime) return 'lifetime';
    if (!dueDateString) return 'unknown';

    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Ajuste de fuso: Cria a data como meio-dia para evitar problemas de timezone UTC
    const [y, m, d] = dueDateString.split('-').map(Number);
    const due = new Date(y, m - 1, d, 12); 

    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays < 0) return 'expired';
    if (diffDays <= 5) return 'warning'; // 5 Dias de aviso
    return 'ok';
}

function getBadgeHtml(status) {
    switch(status) {
        case 'lifetime':
            return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">VITALÍCIO</span>';
        case 'expired':
            return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">VENCIDO</span>';
        case 'warning':
            return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">A VENCER</span>';
        case 'ok':
            return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">EM DIA</span>';
        default:
            return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">SEM DATA</span>';
    }
}

// --- LISTENERS DINÂMICOS ---

function attachDynamicListeners() {
    // 1. Salvar Data de Vencimento
    document.querySelectorAll('.duedate-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const newDate = e.target.value;
            await updateField(id, 'dueDate', newDate);
            refreshRowUI(id, newDate, null);
        });
    });

    // 2. Toggle Vitalício
    document.querySelectorAll('.lifetime-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const isLifetime = e.target.checked;
            await updateField(id, 'isLifetime', isLifetime);
            
            // UI Update Imediato (Hack visual)
            const row = e.target.closest('tr');
            const dateInputDiv = row.querySelector('.duedate-input').parentElement;
            
            if (isLifetime) {
                dateInputDiv.classList.add('opacity-50', 'pointer-events-none');
            } else {
                dateInputDiv.classList.remove('opacity-50', 'pointer-events-none');
            }
            // Recalcula badge
            const dateInput = row.querySelector('.duedate-input');
            refreshRowUI(id, dateInput.value, isLifetime);
        });
    });

    // 3. Bloqueio
    document.querySelectorAll('.toggle-block-btn').forEach(btn => {
        btn.addEventListener('change', async (e) => {
            await updateField(e.target.dataset.id, 'isBlocked', e.target.checked);
            // Atualiza o texto do lado
            const label = e.target.parentElement.nextElementSibling;
            label.textContent = e.target.checked ? 'BLOQUEADO' : 'ATIVO';
            label.className = `text-[10px] mt-1 font-medium ${e.target.checked ? 'text-red-600' : 'text-green-600'}`;
        });
    });

    // 4. Salvar Mensagem
    document.querySelectorAll('.save-msg-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            const id = btn.dataset.id;
            const msg = document.getElementById(`msg-${id}`).value;
            
            // Feedback Visual no botão
            const originalContent = btn.innerHTML;
            btn.innerHTML = '...';
            await updateField(id, 'adminMessage', msg);
            btn.innerHTML = '<span class="text-green-600">✓</span>';
            setTimeout(() => btn.innerHTML = originalContent, 1500);
        });
    });

    // 5. Exclusão Lógica
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            const id = btn.dataset.id;
            const confirmDelete = window.confirm(`ATENÇÃO:\n\nTem certeza que deseja DELETAR a empresa do ID:\n${id}?\n\nEla sumirá desta lista e perderá o acesso imediatamente.`);
            
            if (confirmDelete) {
                await deleteCompanyLogical(id);
                // Remove da tabela visualmente
                const row = btn.closest('tr');
                row.style.opacity = '0.3';
                row.style.pointerEvents = 'none';
                setTimeout(() => row.remove(), 1000);
            }
        });
    });
}

// --- AÇÕES DO BANCO DE DADOS (DATABASE ACTIONS) ---

async function updateField(companyId, field, value) {
    try {
        const ref = doc(db, "companies", companyId);
        await updateDoc(ref, { [field]: value });
        
        // Atualiza cache local
        const user = usersCache.find(u => u.id === companyId);
        if (user) user[field] = value;
        
    } catch (error) {
        console.error(`Erro ao atualizar ${field}:`, error);
        alert(`Erro ao salvar: ${error.message}`);
    }
}

async function deleteCompanyLogical(companyId) {
    try {
        const ref = doc(db, "companies", companyId);
        // Exclusão lógica: Marca como deletado, bloqueado e adiciona timestamp
        await updateDoc(ref, { 
            isDeleted: true,
            isBlocked: true,
            deletedAt: serverTimestamp()
        });
        
        // Remove do cache
        usersCache = usersCache.filter(u => u.id !== companyId);
        
    } catch (error) {
        console.error("Erro na exclusão:", error);
        alert("Falha ao excluir usuário.");
    }
}

// --- CRIAÇÃO DE NOVA EMPRESA (FLUXO DE 2 PASSOS) ---

async function handleCreateButton() {
    // Como ainda não temos o modal HTML, usaremos prompts nativos por segurança
    // Na próxima etapa (index.html), faremos um modal bonito.
    
    const uid = prompt("PASSO 1/3: Cole o UID do usuário (criado no Firebase Console):");
    if (!uid) return;
    if (uid.length < 10) return alert("UID inválido. Verifique se copiou corretamente.");

    const email = prompt("PASSO 2/3: Digite o Email do cliente:");
    if (!email || !email.includes('@')) return alert("Email inválido.");

    const name = prompt("PASSO 3/3: Nome da Empresa:");
    if (!name) return;

    await createNewCompany(uid.trim(), email.trim(), name.trim());
}

async function createNewCompany(uid, email, name) {
    try {
        // Usa Batch para atomicidade (tudo ou nada)
        const batch = writeBatch(db);

        // 1. Cria o documento da empresa
        const companyRef = doc(db, "companies", uid);
        batch.set(companyRef, {
            companyName: name,
            email: email,
            createdAt: serverTimestamp(),
            isBlocked: false,
            isDeleted: false,
            isLifetime: false,
            dueDate: null, // Sem data ainda
            bankBalanceConfig: { initialBalance: 0 }
        });

        // 2. Cria o mapeamento de usuário (CRÍTICO para o login funcionar)
        const mappingRef = doc(db, "user_mappings", uid);
        batch.set(mappingRef, {
            companyId: uid,
            email: email
        });

        await batch.commit();

        alert(`✅ Sucesso!\n\nA empresa "${name}" foi configurada.\nO usuário já pode fazer login.`);
        loadUsers(); // Recarrega a tabela

    } catch (error) {
        console.error("Erro ao criar empresa:", error);
        alert(`Erro ao criar: ${error.message}`);
    }
}

// --- HELPERS VISUAIS ---

function renderLoading(container) {
    container.innerHTML = `
        <tr><td colspan="7" class="p-8 text-center">
            <div class="flex flex-col items-center justify-center gap-2">
                <svg class="animate-spin h-6 w-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-sm text-gray-500">Buscando dados SaaS...</span>
            </div>
        </td></tr>`;
}

function refreshRowUI(id, dueDateValue, isLifetimeValue) {
    const badgeContainer = document.getElementById(`status-badge-${id}`);
    if (!badgeContainer) return;
    
    // Se isLifetimeValue for null, tenta pegar do cache ou do DOM atual
    let finalLifetime = isLifetimeValue;
    if (finalLifetime === null) {
        const checkbox = document.querySelector(`.lifetime-toggle[data-id="${id}"]`);
        finalLifetime = checkbox ? checkbox.checked : false;
    }

    const subStatus = calculateSubscriptionStatus(dueDateValue, finalLifetime);
    badgeContainer.innerHTML = getBadgeHtml(subStatus);
}

function filterUsers(term) {
    if (!term) {
        renderTable(usersCache);
        return;
    }
    const lowerTerm = term.toLowerCase();
    const filtered = usersCache.filter(u => 
        u.name.toLowerCase().includes(lowerTerm) || 
        u.email.toLowerCase().includes(lowerTerm) ||
        u.id.toLowerCase().includes(lowerTerm)
    );
    renderTable(filtered);
}

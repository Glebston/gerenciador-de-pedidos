// js/admin.js
// =========================================================
// MÓDULO ADMINISTRATIVO V3.1 (CRM, Histórico e Correções)
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
    arrayUnion,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let usersCache = [];

export async function initializeAdminPanel() {
    console.log("👑 [ADMIN v3.1] Inicializando CRM com Edição/Exclusão...");

    const adminBtn = document.getElementById('adminPanelBtn');
    const adminModal = document.getElementById('adminModal');
    const closeBtn = document.getElementById('closeAdminModalBtn');
    const refreshBtn = document.getElementById('adminRefreshBtn');
    const searchInput = document.getElementById('adminSearchInput');
    const createBtn = document.getElementById('btnCreateCompany');
    
    // Listeners do Painel Principal
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
    if (createBtn) createBtn.addEventListener('click', handleCreateButton);

    // Listeners do Modal de Detalhes
    const closeDetailsBtn = document.getElementById('closeClientDetailsBtn');
    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', () => {
            document.getElementById('adminClientModal').classList.add('hidden');
        });
    }
}

// --- CORE: LEITURA DE DADOS ---

async function loadUsers() {
    const listBody = document.getElementById('adminUsersList');
    renderLoading(listBody);

    try {
        const q = query(collection(db, "companies"));
        const querySnapshot = await getDocs(q);
        
        usersCache = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.isDeleted) return;

            // Sanitização de dados antigos
            let creationDate = new Date("2024-01-01"); 
            if (data.createdAt && data.createdAt.seconds) {
                creationDate = new Date(data.createdAt.seconds * 1000);
            }

            usersCache.push({
                id: docSnap.id,
                name: data.companyName || "Empresa (Sem Nome)",
                email: data.email || "Email não registrado",
                isBlocked: data.isBlocked || false,
                adminMessage: data.adminMessage || "",
                createdAt: creationDate,
                lastAccess: data.lastAccess ? new Date(data.lastAccess.seconds * 1000) : null,
                dueDate: data.dueDate || null,
                isLifetime: data.isLifetime || false,
                paymentHistory: data.paymentHistory || [],
                internalNotes: data.internalNotes || ""
            });
        });

        usersCache.sort((a, b) => b.createdAt - a.createdAt);
        renderTable(usersCache);

    } catch (error) {
        console.error("Erro ao carregar empresas:", error);
        listBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500">Erro crítico: ${error.message}</td></tr>`;
    }
}

// --- RENDERIZAÇÃO DA LISTA ---

function renderTable(users) {
    const listBody = document.getElementById('adminUsersList');
    listBody.innerHTML = '';

    if (users.length === 0) {
        listBody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-gray-500">Nenhuma empresa encontrada.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 border-b last:border-0 transition group";
        
        const subStatus = calculateSubscriptionStatus(user.dueDate, user.isLifetime);
        
        const lastAccessText = user.lastAccess 
            ? user.lastAccess.toLocaleDateString('pt-BR') + ' ' + user.lastAccess.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
            : '<span class="text-gray-300">Nunca acessou</span>';

        const isLegacy = user.name === "Empresa (Sem Nome)";
        const nameDisplay = isLegacy 
            ? `<span class="text-orange-600 font-bold" title="Edite o nome deste usuário antigo">${user.name} ⚠️</span>` 
            : `<span class="font-bold text-gray-900">${user.name}</span>`;

        const showRenewBtn = user.dueDate && !user.isLifetime;
        const renewBtnHtml = showRenewBtn 
            ? `<button class="renew-btn ml-2 text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 p-1 rounded transition" title="Renovar +1 Mês" data-id="${user.id}">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               </button>`
            : '';

        row.innerHTML = `
            <td class="p-4 align-top">
                <div>${nameDisplay}</div>
                <div class="text-xs text-gray-500 mb-1">${user.email}</div>
                <div class="text-[10px] text-gray-400 font-mono select-all bg-gray-100 px-1 rounded w-fit" title="Copiar UID">${user.id}</div>
            </td>
            
            <td class="p-4 align-top">
                <div class="text-xs text-gray-600 font-medium">Último Acesso:</div>
                <div class="text-xs text-blue-600 mb-2">${lastAccessText}</div>
            </td>

            <td class="p-4 align-top">
                <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between">
                        <label class="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" class="lifetime-toggle form-checkbox h-3 w-3 text-purple-600 rounded focus:ring-purple-500" 
                                   data-id="${user.id}" ${user.isLifetime ? 'checked' : ''}>
                            <span class="text-xs font-semibold ${user.isLifetime ? 'text-purple-600' : 'text-gray-500'}">Vitalício</span>
                        </label>
                        ${renewBtnHtml}
                    </div>

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
                              placeholder="Enviar aviso..." 
                              class="text-xs border rounded p-2 w-full focus:ring-1 focus:ring-purple-500 bg-gray-50 resize-none">${user.adminMessage}</textarea>
                    <button class="save-msg-btn bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 text-xs py-1 px-2 rounded transition flex items-center justify-center gap-1" data-id="${user.id}">
                        Enviar
                    </button>
                </div>
            </td>

            <td class="p-4 align-top text-right flex flex-col gap-2 items-end">
                <button class="view-details-btn text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-2 rounded-full transition" data-id="${user.id}" title="Ver Dossiê do Cliente">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
                
                <button class="delete-user-btn text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition" data-id="${user.id}" title="Excluir">
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

// --- LISTENERS DINÂMICOS ---

function attachDynamicListeners() {
    // Listeners padrão
    document.querySelectorAll('.duedate-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            await updateField(e.target.dataset.id, 'dueDate', e.target.value);
            refreshRowUI(e.target.dataset.id, e.target.value, null);
        });
    });

    document.querySelectorAll('.lifetime-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            await updateField(id, 'isLifetime', e.target.checked);
            loadUsers(); 
        });
    });

    document.querySelectorAll('.toggle-block-btn').forEach(btn => {
        btn.addEventListener('change', async (e) => {
            await updateField(e.target.dataset.id, 'isBlocked', e.target.checked);
            const label = e.target.parentElement.nextElementSibling;
            label.textContent = e.target.checked ? 'BLOQUEADO' : 'ATIVO';
            label.className = `text-[10px] mt-1 font-medium ${e.target.checked ? 'text-red-600' : 'text-green-600'}`;
        });
    });

    document.querySelectorAll('.save-msg-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            const id = btn.dataset.id;
            const msg = document.getElementById(`msg-${id}`).value;
            const originalContent = btn.innerHTML;
            btn.innerHTML = '...';
            await updateField(id, 'adminMessage', msg);
            btn.innerHTML = '<span class="text-green-600">✓</span>';
            setTimeout(() => btn.innerHTML = originalContent, 1500);
        });
    });

    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            const id = btn.dataset.id;
            if (window.confirm(`Tem certeza que deseja DELETAR (logicamente) a empresa ID:\n${id}?`)) {
                await deleteCompanyLogical(id);
                btn.closest('tr').style.opacity = '0.3';
            }
        });
    });

    // Listeners V3 (CRM)
    document.querySelectorAll('.renew-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.closest('button').dataset.id;
            await renewSubscription(id);
        });
    });

    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.closest('button').dataset.id;
            await openClientDetails(id);
        });
    });
}

// --- LÓGICA DE NEGÓCIO: RENOVAÇÃO & CRM ---

async function renewSubscription(companyId) {
    const user = usersCache.find(u => u.id === companyId);
    if (!user || !user.dueDate) {
        alert("Defina uma data de vencimento inicial antes de renovar.");
        return;
    }

    const currentValue = prompt("Confirmar pagamento e renovar por 1 mês?\n\nInforme o valor pago (para o histórico):", "0,00");
    if (currentValue === null) return;

    try {
        const [y, m, d] = user.dueDate.split('-').map(Number);
        const currentDueDate = new Date(y, m - 1, d);
        
        const newDateObj = new Date(currentDueDate);
        newDateObj.setMonth(newDateObj.getMonth() + 1);
        
        const newDueDateStr = newDateObj.toISOString().split('T')[0];

        const historyEntry = {
            date: new Date().toISOString(),
            amount: currentValue,
            admin: "Admin",
            type: "Renovação Mensal"
        };

        const ref = doc(db, "companies", companyId);
        await updateDoc(ref, {
            dueDate: newDueDateStr,
            isBlocked: false,
            paymentHistory: arrayUnion(historyEntry)
        });

        user.dueDate = newDueDateStr;
        user.isBlocked = false;
        if (!user.paymentHistory) user.paymentHistory = [];
        user.paymentHistory.push(historyEntry);

        alert(`✅ Renovado com sucesso!\n\nNova data: ${newDueDateStr.split('-').reverse().join('/')}`);
        loadUsers();

    } catch (error) {
        console.error("Erro na renovação:", error);
        alert(`Erro: ${error.message}`);
    }
}

async function openClientDetails(companyId) {
    const user = usersCache.find(u => u.id === companyId);
    if (!user) return;

    const modal = document.getElementById('adminClientModal');
    if (!modal) return;

    // Preenche Cabeçalho
    document.getElementById('detailCompanyName').textContent = user.name;
    document.getElementById('detailCompanyId').textContent = user.id;
    document.getElementById('detailCompanyEmail').textContent = user.email;

    // Renderiza Tabela Histórico
    const historyBody = document.getElementById('detailHistoryList');
    historyBody.innerHTML = '';
    
    if (user.paymentHistory && user.paymentHistory.length > 0) {
        // Ordena para exibir
        const sortedHistory = [...user.paymentHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        sortedHistory.forEach((h) => {
            const hRow = document.createElement('tr');
            hRow.className = "border-b text-xs hover:bg-gray-50 transition";
            const dateStr = new Date(h.date).toLocaleDateString('pt-BR') + ' ' + new Date(h.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            
            // Usamos h.date como identificador único
            hRow.innerHTML = `
                <td class="p-2 text-gray-600">${dateStr}</td>
                <td class="p-2 font-bold text-green-700">R$ ${h.amount}</td>
                <td class="p-2 text-gray-500">${h.type || 'Renovação'}</td>
                <td class="p-2 text-right flex items-center justify-end gap-2">
                    <button class="edit-payment-btn text-blue-400 hover:text-blue-600 p-1" title="Editar Valor" data-date="${h.date}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button class="delete-payment-btn text-red-400 hover:text-red-600 p-1" title="Excluir Lançamento" data-date="${h.date}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </td>
            `;
            historyBody.appendChild(hRow);
        });

        // Attach listeners para os botões da tabela (dentro do modal)
        historyBody.querySelectorAll('.delete-payment-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetDate = btn.dataset.date;
                await deletePaymentEntry(companyId, targetDate);
            });
        });

        historyBody.querySelectorAll('.edit-payment-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetDate = btn.dataset.date;
                await editPaymentEntry(companyId, targetDate);
            });
        });

    } else {
        historyBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400 text-xs italic">Nenhum histórico registrado.</td></tr>`;
    }

    // Notas Internas
    const notesArea = document.getElementById('detailInternalNotes');
    notesArea.value = user.internalNotes || "";
    
    let typingTimer;
    notesArea.oninput = () => {
        clearTimeout(typingTimer);
        const feedback = document.getElementById('notesSaveStatus');
        feedback.textContent = "Digitando...";
        feedback.className = "text-xs text-yellow-600 ml-2";
        
        typingTimer = setTimeout(async () => {
            feedback.textContent = "Salvando...";
            await updateField(companyId, 'internalNotes', notesArea.value);
            feedback.textContent = "Salvo ✓";
            feedback.className = "text-xs text-green-600 ml-2 font-bold";
            setTimeout(() => feedback.textContent = "", 2000);
        }, 1000);
    };

    modal.classList.remove('hidden');
}

// --- FUNÇÕES DE EDIÇÃO/EXCLUSÃO DE HISTÓRICO ---

async function deletePaymentEntry(companyId, targetDate) {
    if (!confirm("Tem certeza que deseja EXCLUIR este registro de pagamento?\n\nEssa ação é irreversível.")) return;

    try {
        const user = usersCache.find(u => u.id === companyId);
        // Filtra removendo o item com a data exata
        const newHistory = user.paymentHistory.filter(h => h.date !== targetDate);

        // Atualiza no banco (Substitui o array todo pelo novo)
        const ref = doc(db, "companies", companyId);
        await updateDoc(ref, { paymentHistory: newHistory });

        // Atualiza cache e UI
        user.paymentHistory = newHistory;
        openClientDetails(companyId); // Recarrega o modal para ver a mudança

    } catch (error) {
        console.error("Erro ao excluir pagamento:", error);
        alert("Erro ao excluir pagamento.");
    }
}

async function editPaymentEntry(companyId, targetDate) {
    const user = usersCache.find(u => u.id === companyId);
    const item = user.paymentHistory.find(h => h.date === targetDate);
    
    if (!item) return;

    const newVal = prompt("Editar valor do pagamento:", item.amount);
    if (newVal === null || newVal.trim() === "") return;

    try {
        // Cria novo array com o item modificado
        const newHistory = user.paymentHistory.map(h => {
            if (h.date === targetDate) {
                return { ...h, amount: newVal }; // Mantém data, muda valor
            }
            return h;
        });

        const ref = doc(db, "companies", companyId);
        await updateDoc(ref, { paymentHistory: newHistory });

        user.paymentHistory = newHistory;
        openClientDetails(companyId); // Recarrega UI

    } catch (error) {
        console.error("Erro ao editar pagamento:", error);
        alert("Erro ao editar valor.");
    }
}

// --- FUNÇÕES AUXILIARES ---

function calculateSubscriptionStatus(dueDateString, isLifetime) {
    if (isLifetime) return 'lifetime';
    if (!dueDateString) return 'unknown';

    const today = new Date();
    today.setHours(0,0,0,0);
    const [y, m, d] = dueDateString.split('-').map(Number);
    const due = new Date(y, m - 1, d, 12); 
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24)); 

    if (diffDays < 0) return 'expired';
    if (diffDays <= 5) return 'warning';
    return 'ok';
}

function getBadgeHtml(status) {
    switch(status) {
        case 'lifetime': return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">VITALÍCIO</span>';
        case 'expired': return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">VENCIDO</span>';
        case 'warning': return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">A VENCER</span>';
        case 'ok': return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">EM DIA</span>';
        default: return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">SEM DATA</span>';
    }
}

async function updateField(companyId, field, value) {
    try {
        const ref = doc(db, "companies", companyId);
        await updateDoc(ref, { [field]: value });
        const user = usersCache.find(u => u.id === companyId);
        if (user) user[field] = value;
    } catch (error) {
        console.error(`Erro ao atualizar ${field}:`, error);
    }
}

async function deleteCompanyLogical(companyId) {
    try {
        const ref = doc(db, "companies", companyId);
        await updateDoc(ref, { isDeleted: true, isBlocked: true, deletedAt: serverTimestamp() });
        usersCache = usersCache.filter(u => u.id !== companyId);
    } catch (error) {
        console.error("Erro na exclusão:", error);
        alert("Falha ao excluir.");
    }
}

async function handleCreateButton() {
    const uid = prompt("PASSO 1/3: UID do usuário:");
    if (!uid) return;
    const email = prompt("PASSO 2/3: Email:");
    if (!email) return;
    const name = prompt("PASSO 3/3: Nome da Empresa:");
    if (!name) return;
    await createNewCompany(uid.trim(), email.trim(), name.trim());
}

async function createNewCompany(uid, email, name) {
    try {
        const batch = writeBatch(db);
        const companyRef = doc(db, "companies", uid);
        batch.set(companyRef, {
            companyName: name,
            email: email,
            createdAt: serverTimestamp(),
            isBlocked: false,
            isDeleted: false,
            bankBalanceConfig: { initialBalance: 0 }
        });
        const mappingRef = doc(db, "user_mappings", uid);
        batch.set(mappingRef, { companyId: uid, email: email });
        await batch.commit();
        alert(`✅ Empresa criada!`);
        loadUsers();
    } catch (error) {
        console.error("Erro ao criar:", error);
        alert(`Erro: ${error.message}`);
    }
}

function renderLoading(container) {
    container.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-sm text-gray-500">Carregando CRM...</td></tr>`;
}

function refreshRowUI(id, dueDateValue, isLifetimeValue) {
    const badgeContainer = document.getElementById(`status-badge-${id}`);
    if (!badgeContainer) return;
    let finalLifetime = isLifetimeValue;
    if (finalLifetime === null) {
        const checkbox = document.querySelector(`.lifetime-toggle[data-id="${id}"]`);
        finalLifetime = checkbox ? checkbox.checked : false;
    }
    const subStatus = calculateSubscriptionStatus(dueDateValue, finalLifetime);
    badgeContainer.innerHTML = getBadgeHtml(subStatus);
    
    const row = badgeContainer.closest('tr');
    const renewBtn = row.querySelector('.renew-btn');
    if (renewBtn) {
        renewBtn.style.display = (finalLifetime || !dueDateValue) ? 'none' : 'inline-block';
    }
}

function filterUsers(term) {
    if (!term) { renderTable(usersCache); return; }
    const lowerTerm = term.toLowerCase();
    const filtered = usersCache.filter(u => u.name.toLowerCase().includes(lowerTerm) || u.email.toLowerCase().includes(lowerTerm));
    renderTable(filtered);
}

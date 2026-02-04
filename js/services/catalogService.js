// js/services/catalogService.js
// ========================================================
// SERVICE DO CATÁLOGO (v2.1 - User Mapping Fix)
// Compatível com Firebase Modular v11.6.1
// ========================================================

import { db, auth } from "../firebaseConfig.js";
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    deleteDoc, 
    updateDoc, 
    query, 
    where, 
    getCountFromServer,
    getDoc, // <--- Importante para ler o mapping
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Chave da API do ImgBB
const IMGBB_API_KEY = "f012978df48f3596b193c06e05589442";

// --- FUNÇÃO AUXILIAR: Descobre o ID Real da Empresa ---
async function getRealCompanyId() {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado.");

    // 1. Tenta ler o mapeamento na coleção user_mappings
    try {
        const mappingRef = doc(db, "user_mappings", user.uid);
        const mappingSnap = await getDoc(mappingRef);

        if (mappingSnap.exists() && mappingSnap.data().companyId) {
            // SUCESSO: Retorna o ID da empresa correta (ex: ECP...)
            return mappingSnap.data().companyId; 
        }
    } catch (error) {
        console.warn("Erro ao buscar mapeamento, tentando fallback:", error);
    }

    // 2. Fallback: Se não tiver mapeamento, usa o ID do usuário (Comportamento antigo)
    return user.uid;
}

// --- 1. UPLOAD DE IMAGEM (ImgBB) ---
export async function uploadCatalogImage(file) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData
    });

    const result = await response.json();
    if (result.success) {
        return result.data.url;
    } else {
        throw new Error("Falha no upload: " + (result.error?.message || "Erro desconhecido"));
    }
}

// --- 2. ADICIONAR PRODUTO (Create) ---
export async function addCatalogItem(itemData) {
    const companyId = await getRealCompanyId(); // <--- CORREÇÃO DE OURO
    
    // Regra dos 30: Verificar limite
    const collRef = collection(db, "companies", companyId, "catalog_items");
    const snapshot = await getCountFromServer(collRef);
    const count = snapshot.data().count;

    if (count >= 30) {
        throw new Error("Limite de Armazenamento Atingido (30 itens). Exclua um item antigo.");
    }

    // Salvar
    const docRef = await addDoc(collRef, {
        title: itemData.title,
        description: itemData.description || "",
        price: itemData.price || "",
        category: itemData.category || "Geral",
        imageUrl: itemData.imageUrl,
        isActive: false, // Nasce inativo por segurança
        createdAt: serverTimestamp()
    });
    
    return docRef.id;
}

// --- 3. LISTAR PRODUTOS (Read) ---
// Nota: removemos o argumento 'companyId' pois a função descobre sozinha
export async function getCatalogItems() {
    const companyId = await getRealCompanyId(); // <--- CORREÇÃO DE OURO
    const collRef = collection(db, "companies", companyId, "catalog_items");
    
    // Busca todos (Ativos e Inativos) para o painel Admin
    const q = query(collRef); 
    const snapshot = await getDocs(q);
    
    // Preparando retorno compatível com o formato antigo (items + counts)
    const items = [];
    let activeCount = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.isActive) activeCount++;
        items.push({ id: doc.id, ...data });
    });
    
    return {
        items: items,
        totalCount: items.length,
        activeCount: activeCount
    };
}

// --- 4. ALTERAR STATUS (Update) ---
export async function toggleItemStatus(itemId, newStatus) {
    const companyId = await getRealCompanyId(); // <--- CORREÇÃO DE OURO
    
    // Regra dos 20: Se for ativar, verificar limite da vitrine
    if (newStatus === true) {
        const collRef = collection(db, "companies", companyId, "catalog_items");
        const q = query(collRef, where("isActive", "==", true));
        const snapshot = await getCountFromServer(q);
        
        if (snapshot.data().count >= 20) {
            throw new Error("Sua vitrine já tem 20 destaques. Desative um para ativar este.");
        }
    }

    const docRef = doc(db, "companies", companyId, "catalog_items", itemId);
    await updateDoc(docRef, { isActive: newStatus });
}

// --- 5. DELETAR PRODUTO (Delete) ---
export async function deleteCatalogItem(itemId) {
    const companyId = await getRealCompanyId(); // <--- CORREÇÃO DE OURO
    const docRef = doc(db, "companies", companyId, "catalog_items", itemId);
    await deleteDoc(docRef);
}

// --- 6. ATUALIZAR PRODUTO (Edit) ---
export async function updateCatalogItem(itemId, updateData) {
    const companyId = await getRealCompanyId(); // <--- CORREÇÃO DE OURO
    const docRef = doc(db, "companies", companyId, "catalog_items", itemId);
    await updateDoc(docRef, updateData);
}

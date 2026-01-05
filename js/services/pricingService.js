// Importa as funções necessárias do Firestore-
import { collection, onSnapshot, doc, deleteDoc, writeBatch, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Importa a instância 'db' do nosso arquivo de configuração
import { db } from '../firebaseConfig.js';

// --- Estado do Módulo ---
let pricingCollection = null;     // Referência à coleção de preços no Firestore
let allPricingItems = [];         // Cache local de todos os itens de preço
let unsubscribeListener = null;   // Função para desligar o listener do Firestore

// --- Funções Privadas ---

/**
 * Configura o listener em tempo real para a coleção de preços.
 * @param {function} granularUpdateCallback - A função (do main.js) que será chamada para cada mudança granular.
 */
const setupPricingListener = (granularUpdateCallback) => {
    if (unsubscribeListener) unsubscribeListener();

    const q = query(pricingCollection, orderBy("createdAt", "asc"));
    unsubscribeListener = onSnapshot(q, (snapshot) => {
        
        snapshot.docChanges().forEach((change) => {
            // --- CORREÇÃO v4.2: A verificação 'hasPendingWrites' foi REMOVIDA daqui ---
            // Isso garante que a tabela de preços se atualize
            // imediatamente após o usuário salvar as alterações.

            const data = { id: change.doc.id, ...change.doc.data() };
            const index = allPricingItems.findIndex(p => p.id === data.id);

            // Gerencia o cache local
            if (change.type === 'added') {
                if (index === -1) {
                    // Para manter a ordem 'createdAt', a inserção é mais complexa.
                    // A solução mais simples para este caso (lista menor) é reordenar após inserir.
                    allPricingItems.push(data);
                }
            } else if (change.type === 'modified') {
                if (index > -1) {
                    allPricingItems[index] = data; // Atualiza o item no cache
                } else {
                    allPricingItems.push(data); // Adiciona se não existia
                }
            } else if (change.type === 'removed') {
                if (index > -1) {
                    allPricingItems.splice(index, 1); // Remove do cache
                }
            }
            
            // Invoca o callback granular
            if (granularUpdateCallback) {
                granularUpdateCallback(change.type, data);
            }
        });
        
        // Garante a ordenação após 'adds'
        allPricingItems.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

    }, (error) => {
        console.error("Erro ao carregar tabela de preços:", error);
    });
};


// --- API Pública do Módulo ---

/**
 * Inicializa o serviço de preços para uma empresa específica.
 * @param {string} companyId - O ID da empresa do usuário logado.
 * @param {function} granularUpdateCallback - A função de callback granular (em main.js).
 */
export const initializePricingService = (companyId, granularUpdateCallback) => {
    pricingCollection = collection(db, `companies/${companyId}/pricing`);
    setupPricingListener(granularUpdateCallback);
};

/**
 * Salva um lote de alterações (adições/atualizações) na tabela de preços.
 * @param {Array<object>} itemsToSave - Um array de objetos de item. Itens novos devem ter um ID começando com 'new-'.
 */
export const savePriceTableChanges = async (itemsToSave) => {
    if (!pricingCollection) return;
    const batch = writeBatch(db);
    
    itemsToSave.forEach(item => {
        const { id, ...data } = item;
        
        // Se o ID é temporário ('new-'), cria um novo documento.
        if (id && id.startsWith('new-')) {
            const newDocRef = doc(pricingCollection); // Deixa o Firestore gerar o ID.
            batch.set(newDocRef, { ...data, createdAt: serverTimestamp() });
        } 
        // Se o ID existe e não é temporário, atualiza o documento.
        else if (id) {
            const docRef = doc(pricingCollection, id);
            batch.update(docRef, data);
        }
    });

    await batch.commit();
};

/**
 * Exclui um único item da tabela de preços.
 * @param {string} itemId - O ID do item a ser excluído.
 */
export const deletePriceItem = async (itemId) => {
    if (!itemId || !pricingCollection) return;
    await deleteDoc(doc(pricingCollection, itemId));
};

/**
 * Retorna a lista completa de todos os itens de preço do cache local.
 * @returns {Array}
 */
export const getAllPricingItems = () => {
    return [...allPricingItems]; // Retorna cópia
};

/**
 * Limpa o estado do serviço e desliga o listener.
 */
export const cleanupPricingService = () => {
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
    allPricingItems = [];
    pricingCollection = null;
};

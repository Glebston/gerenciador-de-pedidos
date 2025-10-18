// Importa as funções necessárias do Firestore
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Importa a instância 'db' do nosso arquivo de configuração
import { db } from '../firebaseConfig.js';

// --- Estado do Módulo ---
let dbCollection = null;      // Referência à coleção de pedidos no Firestore
let allOrders = [];           // Cache local de todos os pedidos para acesso rápido
let unsubscribeListener = null; // Função para desligar o listener do Firestore no logout

// --- Funções Privadas ---

/**
 * Configura o listener em tempo real para a coleção de pedidos.
 * Qualquer alteração no Firestore será refletida aqui.
 * @param {function} renderCallback - A função (do ui.js) que será chamada para redesenhar a lista de pedidos.
 * @param {function} getViewCallback - Função que retorna a visualização atual ('pending' ou 'delivered').
 */
const setupFirestoreListener = (renderCallback, getViewCallback) => {
    if (unsubscribeListener) unsubscribeListener(); // Garante que não haja listeners duplicados

    const q = query(dbCollection);
    unsubscribeListener = onSnapshot(q, (snapshot) => {
        allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // O serviço obtém os dados e invoca o callback para que a UI seja atualizada
        if (renderCallback) {
            const currentView = getViewCallback ? getViewCallback() : 'pending';
            renderCallback(allOrders, currentView);
        }
    }, (error) => {
        console.error("Erro ao buscar pedidos em tempo real:", error);
        // Em um cenário real, poderíamos chamar um showInfoModal de erro aqui
    });
};


// --- API Pública do Módulo ---

/**
 * Inicializa o serviço de pedidos para uma empresa específica.
 * @param {string} companyId - O ID da empresa do usuário logado.
 * @param {function} renderCallback - A função de renderização da UI para os pedidos.
 * @param {function} getViewCallback - Função que retorna a visualização atual.
 */
export const initializeOrderService = (companyId, renderCallback, getViewCallback) => {
    dbCollection = collection(db, `companies/${companyId}/orders`);
    setupFirestoreListener(renderCallback, getViewCallback);
};

/**
 * Salva um pedido (cria um novo ou atualiza um existente).
 * @param {object} orderData - O objeto com todos os dados do pedido.
 * @param {string|null} orderId - O ID do pedido a ser atualizado, ou null para criar um novo.
 * @returns {Promise<string>} O ID do documento salvo.
 */
export const saveOrder = async (orderData, orderId) => {
    if (orderId) {
        // Atualiza um pedido existente
        await updateDoc(doc(dbCollection, orderId), orderData);
        return orderId;
    } else {
        // Adiciona um novo pedido
        const docRef = await addDoc(dbCollection, orderData);
        return docRef.id;
    }
};

/**
 * Exclui um pedido do Firestore.
 * @param {string} id - O ID do pedido a ser excluído.
 */
export const deleteOrder = async (id) => {
    if (!id) return;
    await deleteDoc(doc(dbCollection, id));
};

/**
 * Busca um único pedido no cache local pelo seu ID.
 * @param {string} id - O ID do pedido.
 * @returns {object|undefined} O objeto do pedido ou undefined se não for encontrado.
 */
export const getOrderById = (id) => {
    return allOrders.find(o => o.id === id);
};

/**
 * Retorna a lista completa de todos os pedidos do cache local.
 * @returns {Array}
 */
export const getAllOrders = () => {
    return allOrders;
};

/**
 * Limpa o estado do serviço e desliga o listener. Essencial para o logout.
 */
export const cleanupOrderService = () => {
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
    allOrders = [];
    dbCollection = null;
};

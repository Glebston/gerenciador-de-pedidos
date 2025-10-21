// Importa as funções necessárias do Firestore
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Importa a instância 'db' do nosso arquivo de configuração
import { db } from '../firebaseConfig.js';

// --- Estado do Módulo ---
let transactionsCollection = null; // Referência à coleção de transações no Firestore
let companyRef = null;             // Referência ao documento da empresa para salvar o saldo
let allTransactions = [];          // Cache local de todas as transações
let unsubscribeListener = null;    // Função para desligar o listener do Firestore

// --- Funções Privadas ---

/**
 * Configura o listener em tempo real para a coleção de transações.
 * @param {function} granularUpdateCallback - A função (do main.js) que será chamada para cada mudança granular.
 * @param {function} getBankBalanceConfig - Uma função que retorna o objeto de configuração de saldo atual.
 */
const setupTransactionsListener = (granularUpdateCallback, getBankBalanceConfig) => {
    if (unsubscribeListener) unsubscribeListener();

    const q = query(transactionsCollection);
    unsubscribeListener = onSnapshot(q, (snapshot) => {
        
        snapshot.docChanges().forEach((change) => {
            // --- CORREÇÃO v4.2: A verificação 'hasPendingWrites' foi REMOVIDA daqui ---
            // Isso garante que a lista de transações se atualize
            // imediatamente após o usuário salvar um novo lançamento.

            const data = { id: change.doc.id, ...change.doc.data() };
            const index = allTransactions.findIndex(t => t.id === data.id);

            // Gerencia o cache local
            if (change.type === 'added') {
                if (index === -1) {
                    allTransactions.push(data);
                }
            } else if (change.type === 'modified') {
                if (index > -1) {
                    allTransactions[index] = data; // Atualiza o item no cache
                } else {
                    allTransactions.push(data); // Adiciona se não existia
                }
            } else if (change.type === 'removed') {
                if (index > -1) {
                    allTransactions.splice(index, 1); // Remove do cache
                }
            }
            
            // Invoca o callback granular
            // Também recalcula o dashboard, pois os KPIs (indicadores principais) precisam ser atualizados
            if (granularUpdateCallback) {
                granularUpdateCallback(change.type, data, getBankBalanceConfig());
            }
        });
        
        // Ordena o cache local após as mudanças
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    }, (error) => {
        console.error("Erro ao carregar transações:", error);
    });
};


// --- API Pública do Módulo ---

/**
 * Inicializa o serviço financeiro para uma empresa específica.
 * @param {string} companyId - O ID da empresa do usuário logado.
 * @param {function} granularUpdateCallback - A função de callback granular (em main.js).
 * @param {function} getBankBalanceConfig - Função que retorna o objeto de configuração de saldo.
 */
export const initializeFinanceService = (companyId, granularUpdateCallback, getBankBalanceConfig) => {
    transactionsCollection = collection(db, `companies/${companyId}/transactions`);
    companyRef = doc(db, "companies", companyId);
    setupTransactionsListener(granularUpdateCallback, getBankBalanceConfig);
};

/**
 * Salva uma transação (cria ou atualiza).
 * @param {object} transactionData - O objeto com os dados da transação.
 * @param {string|null} transactionId - O ID da transação para atualizar, ou null para criar.
 */
export const saveTransaction = async (transactionData, transactionId) => {
    if (!transactionsCollection) return;
    if (transactionId) {
        await updateDoc(doc(transactionsCollection, transactionId), transactionData);
    } else {
        await addDoc(transactionsCollection, transactionData);
    }
};

/**
 * Exclui uma transação do Firestore.
 * @param {string} id - O ID da transação a ser excluída.
 */
export const deleteTransaction = async (id) => {
    if (!id || !transactionsCollection) return;
    await deleteDoc(doc(transactionsCollection, id));
};

/**
 * Marca uma transação "A Receber" como "paga" e atualiza sua data para hoje.
 * @param {string} id - O ID da transação a ser atualizada.
 */
export const markTransactionAsPaid = async (id) => {
    if (!id || !transactionsCollection) return;
    const transactionRef = doc(transactionsCollection, id);
    await updateDoc(transactionRef, {
        status: 'pago',
        date: new Date().toISOString().split('T')[0]
    });
};

/**
 * Salva o valor do saldo inicial no documento da empresa.
 * @param {number} newBalance - O novo valor de saldo inicial.
 */
export const saveInitialBalance = async (newBalance) => {
    if (!companyRef) return;
    await updateDoc(companyRef, {
        bankBalanceConfig: {
            initialBalance: newBalance
        }
    });
};

/**
 * Retorna uma cópia da lista completa de todas as transações do cache local.
 * @returns {Array}
 */
export const getAllTransactions = () => {
    return [...allTransactions]; // Retorna cópia para segurança (imutabilidade)
};

/**
 * Limpa o estado do serviço e desliga o listener.
 */
export const cleanupFinanceService = () => {
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
    allTransactions = [];
    transactionsCollection = null;
    companyRef = null;
};

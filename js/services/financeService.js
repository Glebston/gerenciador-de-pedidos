// js/services/financeService.js
// ==========================================================
// MÓDULO FINANCE SERVICE (v5.13.0 - BATCHED & SANITIZED)
// ==========================================================

import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebaseConfig.js';

// --- Estado do Módulo ---
let dbCollection = null;
let allTransactions = [];
let unsubscribeListener = null;

// --- Funções Privadas do Firestore ---

const setupFirestoreListener = (granularUpdateCallback, getConfigCallback) => {
    if (unsubscribeListener) unsubscribeListener();

    const q = query(dbCollection);
    
    unsubscribeListener = onSnapshot(q, (snapshot) => {
        let hasChanges = false;
        let lastChangeType = 'modified';
        let lastChangedData = null;

        // 1. Processamento em Lote (Batching)
        // Evita disparar eventos para cada transação durante o carregamento inicial
        snapshot.docChanges().forEach((change) => {
            hasChanges = true;
            const data = { id: change.doc.id, ...change.doc.data() };
            const index = allTransactions.findIndex(t => t.id === data.id);

            if (change.type === 'added') {
                if (index === -1) allTransactions.push(data);
            } else if (change.type === 'modified') {
                if (index > -1) allTransactions[index] = data;
                else allTransactions.push(data);
            } else if (change.type === 'removed') {
                if (index > -1) allTransactions.splice(index, 1);
            }
            
            lastChangeType = change.type;
            lastChangedData = data;
        });

        // 2. Notificação Consolidada
        // Só avisa o main.js depois de processar todas as mudanças do snapshot atual
        if (hasChanges) {
            if (granularUpdateCallback) {
                // Passamos null no segundo argumento se for um batch grande, 
                // ou o lastChangedData se for uma edição pontual (o main.js lida com isso)
                granularUpdateCallback(lastChangeType, lastChangedData, getConfigCallback());
            }
        }
    }, (error) => {
        console.error("Erro ao buscar transações em tempo real:", error);
    });
};

// --- API Pública do Módulo ---

export const initializeFinanceService = (companyId, granularUpdateCallback, getConfigCallback) => {
    dbCollection = collection(db, `companies/${companyId}/transactions`);
    setupFirestoreListener(granularUpdateCallback, getConfigCallback);
};

export const saveTransaction = async (transactionData, transactionId) => {
    // Garante que números sejam salvos como números
    if (transactionData.amount) transactionData.amount = parseFloat(transactionData.amount);

    if (transactionId) {
        await updateDoc(doc(dbCollection, transactionId), transactionData);
        return transactionId;
    } else {
        const docRef = await addDoc(dbCollection, transactionData);
        return docRef.id;
    }
};

export const deleteTransaction = async (id) => {
    if (!id) return;
    await deleteDoc(doc(dbCollection, id));
};

export const markTransactionAsPaid = async (id) => {
    if (!id) return;
    await updateDoc(doc(dbCollection, id), {
        status: 'pago'
    });
};

export const saveInitialBalance = async (companyId, newBalance) => {
    const companyRef = doc(db, "companies", companyId);
    await updateDoc(companyRef, {
        "bankBalanceConfig.initialBalance": parseFloat(newBalance)
    });
};

export const getAllTransactions = () => {
    return [...allTransactions];
};

export const getTransactionById = (id) => {
    return allTransactions.find(t => t.id === id);
};

export const getTransactionByOrderId = (orderId) => {
    return allTransactions.find(t => t.orderId === orderId);
};

export const deleteAllTransactionsByOrderId = async (orderId) => {
    if (!orderId || !dbCollection) return;
    
    // Busca localmente primeiro para evitar leituras desnecessárias se vazio
    const hasLinked = allTransactions.some(t => t.orderId === orderId);
    if (!hasLinked) return;

    const q = query(dbCollection, where("orderId", "==", orderId));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    }
};

export const cleanupFinanceService = () => {
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
    allTransactions = [];
    dbCollection = null;
};

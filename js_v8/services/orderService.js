// js/services/orderService.js
// ==========================================================
// MÓDULO ORDER SERVICE (v5.28.0 - CENTRALIZED CALCULATION)
// ==========================================================

import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebaseConfig.js';
// Importação da Nova Calculadora Central
import { calculateOrderTotals } from '../financialCalculator.js';

// --- Estado do Módulo ---
let dbCollection = null;      
let allOrders = [];           
let unsubscribeListener = null; 

// --- Funções Privadas do Firestore ---

const setupFirestoreListener = (granularUpdateCallback, getViewCallback) => {
    if (unsubscribeListener) unsubscribeListener(); 

    const q = query(dbCollection);
    unsubscribeListener = onSnapshot(q, (snapshot) => {
        
        snapshot.docChanges().forEach((change) => {
            const data = { id: change.doc.id, ...change.doc.data() };
            const index = allOrders.findIndex(o => o.id === data.id);

            // 1. Atualiza a Memória
            if (change.type === 'added') {
                if (index === -1) allOrders.push(data);
            } else if (change.type === 'modified') {
                if (index > -1) allOrders[index] = data;
                else allOrders.push(data);
            } else if (change.type === 'removed') {
                if (index > -1) allOrders.splice(index, 1);
            }
            
            // 2. Notifica a UI
            if (granularUpdateCallback) {
                granularUpdateCallback(change.type, data, getViewCallback());
            }
        });

    }, (error) => {
        console.error("Erro ao buscar pedidos em tempo real:", error);
    });
};

// --- API Pública do Módulo ---

export const initializeOrderService = (companyId, granularUpdateCallback, getViewCallback) => {
    dbCollection = collection(db, `companies/${companyId}/orders`);
    setupFirestoreListener(granularUpdateCallback, getViewCallback);
};

export const saveOrder = async (orderData, orderId) => {
    if (orderId) {
        await updateDoc(doc(dbCollection, orderId), orderData);
        return orderId;
    } else {
        const docRef = await addDoc(dbCollection, orderData);
        return docRef.id;
    }
};

export const deleteOrder = async (id) => {
    if (!id) return;
    await deleteDoc(doc(dbCollection, id));
};

export const getOrderById = (id) => {
    return allOrders.find(o => o.id === id);
};

export const getAllOrders = () => {
    return [...allOrders]; 
};

export const calculateTotalPendingRevenue = (startDate = null, endDate = null) => {
    if (allOrders.length === 0) return 0;

    // v5.22.0: Estado Absoluto (Ignora Datas)
    const total = allOrders.reduce((acc, order) => {
        const rawStatus = order.orderStatus ? order.orderStatus.trim() : '';
        const status = rawStatus.toLowerCase();
        
        if (status === 'cancelado' || status === 'entregue') return acc;

        // --- MUDANÇA AQUI ---
        // Agora usamos o calculador central. 
        // Como ele retorna um objeto { total, paid, remaining... }, pegamos apenas o .total
        const finance = calculateOrderTotals(order);
        const totalOrder = finance.total; 
        
        const paid = parseFloat(order.downPayment) || 0; 
        const remaining = totalOrder - paid;

        if (remaining > 0.01) {
            return acc + remaining;
        }
        return acc;
    }, 0);

    return total;
};

export const updateOrderDiscountFromFinance = async (orderId, diffValue) => {
    if (!orderId || !dbCollection) return;
    const orderRef = doc(dbCollection, orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return;

    const orderData = orderSnap.data();
    const currentDiscount = parseFloat(orderData.discount) || 0;
    const currentPaid = parseFloat(orderData.downPayment) || 0;

    let updates = {
        downPayment: currentPaid + diffValue
    };

    if (diffValue < 0) {
        const adjustment = Math.abs(diffValue);
        updates.discount = currentDiscount + adjustment;
    } else if (diffValue > 0) {
        let newDiscount = currentDiscount - diffValue;
        if (newDiscount < 0) newDiscount = 0;
        updates.discount = newDiscount;
    }

    await updateDoc(orderRef, updates);
};

export const cleanupOrderService = () => {
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
    allOrders = [];
    dbCollection = null;
};

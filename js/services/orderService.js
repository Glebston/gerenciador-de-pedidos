// js/services/orderService.js
// ==========================================================
// MÓDULO ORDER SERVICE (v5.13.0 - BATCHED STABILITY)
// ==========================================================

import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebaseConfig.js';

// --- Estado do Módulo ---
let dbCollection = null;      
let allOrders = [];           
let unsubscribeListener = null; 
const DEBUG_MODE = true; 

// --- Funções Auxiliares de Cálculo ---

const countPartItems = (part) => {
    let totalQty = 0;
    if (part.sizes && typeof part.sizes === 'object') {
        Object.values(part.sizes).forEach(sizesObj => {
            if (sizesObj && typeof sizesObj === 'object') {
                Object.values(sizesObj).forEach(qty => {
                    totalQty += (parseInt(qty) || 0);
                });
            }
        });
    }
    if (part.details && Array.isArray(part.details)) {
        totalQty += part.details.length;
    }
    return totalQty;
};

const calculateOrderTotalValue = (order) => {
    let grossTotal = 0;
    if (order.parts && Array.isArray(order.parts)) {
        order.parts.forEach(part => {
            const price = parseFloat(part.unitPriceSpecific) || parseFloat(part.unitPriceStandard) || parseFloat(part.unitPrice) || 0;
            const qty = countPartItems(part);
            grossTotal += (price * qty);
        });
    }
    const discount = parseFloat(order.discount) || 0;
    return grossTotal - discount;
};

// --- Funções Privadas do Firestore ---

const setupFirestoreListener = (granularUpdateCallback, getViewCallback) => {
    if (unsubscribeListener) unsubscribeListener(); 

    const q = query(dbCollection);
    unsubscribeListener = onSnapshot(q, (snapshot) => {
        let hasChanges = false;
        let lastChangeType = 'modified';
        let lastChangedData = null;

        // 1. Processamento em Lote (Batch)
        // Evita expor o array allOrders em estado parcial
        snapshot.docChanges().forEach((change) => {
            hasChanges = true;
            const data = { id: change.doc.id, ...change.doc.data() };
            const index = allOrders.findIndex(o => o.id === data.id);

            if (change.type === 'added') {
                if (index === -1) allOrders.push(data);
            } else if (change.type === 'modified') {
                if (index > -1) allOrders[index] = data;
                else allOrders.push(data);
            } else if (change.type === 'removed') {
                if (index > -1) allOrders.splice(index, 1);
            }
            
            lastChangeType = change.type;
            lastChangedData = data;
        });

        // 2. Notificação Consolidada
        if (hasChanges) {
            // Ordenação opcional se necessário, mas mantemos o foco na integridade
            if (granularUpdateCallback) {
                granularUpdateCallback(lastChangeType, lastChangedData, getViewCallback());
            }
        }

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
    // Cálculo Blindado: Se não houver pedidos carregados, retorna 0 (mas o Proxy vai tratar isso)
    if (allOrders.length === 0) return 0;

    const total = allOrders.reduce((acc, order) => {
        const rawStatus = order.orderStatus ? order.orderStatus.trim() : '';
        const status = rawStatus.toLowerCase();
        
        if (status === 'cancelado' || status === 'entregue') return acc;

        if (startDate || endDate) {
            const orderDateStr = order.orderDate || order.date || (order.createdAt ? order.createdAt.split('T')[0] : null);
            if (!orderDateStr) return acc; 
            const orderDate = new Date(orderDateStr + 'T00:00:00');
            if (isNaN(orderDate.getTime())) return acc; 
            if (startDate && orderDate < startDate) return acc;
            if (endDate && orderDate > endDate) return acc;
        }

        const totalOrder = calculateOrderTotalValue(order);
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
        const adjustment = diffValue * -1; 
        updates.discount = currentDiscount + adjustment;
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

// js/services/orderService.js
// ==========================================================
// MÓDULO ORDER SERVICE (v5.23.0 - GRANULAR CALCULATION FIX)
// ==========================================================

import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from '../firebaseConfig.js';

// --- Estado do Módulo ---
let dbCollection = null;      
let allOrders = [];           
let unsubscribeListener = null; 

// --- Funções Auxiliares de Cálculo (REFATORADA v5.23) ---

/**
 * Calcula o valor total do pedido separando rigorosamente os tipos de peças.
 * Corrige o bug onde o preço de uma peça personalizada "contaminava" o preço
 * das peças padrão no mesmo bloco.
 */
const calculateOrderTotalValue = (order) => {
    let grossTotal = 0;
    
    if (order.parts && Array.isArray(order.parts)) {
        order.parts.forEach(part => {
            // 1. CÁLCULO DE PEÇAS PADRÃO (Grades P/M/G etc)
            let standardQty = 0;
            if (part.sizes && typeof part.sizes === 'object') {
                Object.values(part.sizes).forEach(sizesObj => {
                    if (sizesObj && typeof sizesObj === 'object') {
                        Object.values(sizesObj).forEach(qty => {
                            standardQty += (parseInt(qty) || 0);
                        });
                    }
                });
            }
            // Usa unitPriceStandard. Se não existir, tenta fallback seguro, mas prioriza o específico do grupo.
            const priceStandard = parseFloat(part.unitPriceStandard) || parseFloat(part.unitPrice) || 0;
            grossTotal += (standardQty * priceStandard);

            // 2. CÁLCULO DE PEÇAS ESPECÍFICAS (Tamanhos Personalizados)
            let specificQty = 0;
            if (part.specifics && Array.isArray(part.specifics)) {
                specificQty = part.specifics.length;
            }
            // Usa unitPriceSpecific.
            const priceSpecific = parseFloat(part.unitPriceSpecific) || parseFloat(part.unitPrice) || 0;
            grossTotal += (specificQty * priceSpecific);

            // 3. CÁLCULO DE PEÇAS DETALHADAS (Nome/Número)
            let detailedQty = 0;
            if (part.details && Array.isArray(part.details)) {
                detailedQty = part.details.length;
            }
            // Peças detalhadas geralmente usam o campo genérico 'unitPrice' ou têm lógica própria
            const priceDetailed = parseFloat(part.unitPrice) || 0;
            grossTotal += (detailedQty * priceDetailed);
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

        // O cálculo agora usa a lógica GRANULAR (Padrão + Específico + Detalhado)
        const totalOrder = calculateOrderTotalValue(order);
        
        // Pagamento agora é baseado no que foi salvo, mas idealmente deveria ser a soma das transações.
        // Como o orderService é rápido, usamos o campo cacheado 'downPayment' do pedido para performance,
        // confiando que o orderListeners.js mantém ele atualizado.
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

// js/financialCalculator.js
// ==========================================================
// MÓDULO FINANCEIRO CENTRAL (v1.0.0)
// Responsabilidade: Centralizar TODA a lógica de cálculo de preços.
// Única fonte de verdade para: Admin, Página Pública e PDFs.
// ==========================================================

/**
 * Calcula os totais financeiros de um pedido.
 * @param {Object} order - O objeto do pedido (contendo parts, discount, downPayment, etc).
 * @returns {Object} { grossTotal, discount, total, paid, remaining }
 */
export const calculateOrderTotals = (order) => {
    let grossTotal = 0;

    // 1. Somatória das Peças
    if (order.parts && Array.isArray(order.parts)) {
        order.parts.forEach(part => {
            
            // A. Peças Padrão (Grades P/M/G...)
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
            // Preço: Prioriza o Padrão, senão usa o Genérico
            const priceStandard = parseFloat(part.unitPriceStandard) !== undefined 
                ? parseFloat(part.unitPriceStandard) 
                : (parseFloat(part.unitPrice) || 0);
            
            grossTotal += (standardQty * priceStandard);

            // B. Peças Específicas (Sob Medida)
            let specificQty = 0;
            if (part.specifics && Array.isArray(part.specifics)) {
                specificQty = part.specifics.length;
            }
            // Preço: Prioriza o Específico, senão usa o Genérico
            const priceSpecific = parseFloat(part.unitPriceSpecific) !== undefined 
                ? parseFloat(part.unitPriceSpecific) 
                : (parseFloat(part.unitPrice) || 0);
            
            grossTotal += (specificQty * priceSpecific);

            // C. Peças Detalhadas (Lista de Nomes)
            let detailedQty = 0;
            if (part.details && Array.isArray(part.details)) {
                detailedQty = part.details.length;
            }
            // Peças detalhadas geralmente usam o unitPrice genérico
            const priceDetailed = parseFloat(part.unitPrice) || 0;
            grossTotal += (detailedQty * priceDetailed);
        });
    }

    // 2. Aplicação de Descontos e Pagamentos
    const discount = parseFloat(order.discount) || 0;
    const total = grossTotal - discount; // Valor Final do Pedido
    
    // Tratamento seguro para pagamento (aceita número ou string numérica)
    const paid = parseFloat(order.downPayment) || 0;
    
    // 3. Resultado Final
    const remaining = total - paid;

    return {
        grossTotal: grossTotal, // Subtotal (Soma das peças sem desconto)
        discount: discount,     // Desconto aplicado
        total: total,           // Total a pagar (Bruto - Desconto)
        paid: paid,             // Quanto já foi pago
        remaining: remaining    // Quanto falta pagar
    };
};

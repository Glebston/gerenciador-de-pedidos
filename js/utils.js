// =========================================================================
// v4.2.2k - CORREÇÃO DA IMPORTAÇÃO (Patch Manual para ESM Nativo)
// =========================================================================
// 1. Importa a classe jsPDF
import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";
// 2. Importa o objeto 'autoTable' (que é o export default) do plugin
import autoTable from "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/+esm";

// 3. APLICA O PATCH MANUALMENTE
//    Isso resolve o "mismatch de módulos" (duplicação de jsPDF)
//    garantindo que o plugin se anexe à NOSSA instância da classe jsPDF.
autoTable.applyPlugin(jsPDF);
// =========================================================================

// --- Constantes Utilitárias ---
const IMGBB_API_KEY = "f012978df48f3596b193c06e05589442";
const SIZES_ORDER = [
    'PP', 'P', 'M', 'G', 'GG', 'XG',
    '2 anos', '4 anos', '6 anos', '8 anos', '10 anos', '12 anos'
];


// --- Funções Utilitárias de API e Dados ---

export const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

export const uploadToImgBB = async (base64Image) => {
    const formData = new FormData();
    formData.append('image', base64Image);
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) return data.data.url;
        throw new Error(data.error.message);
    } catch (error) {
        console.error('Erro no upload para ImgBB:', error);
        return null;
    }
};

export const sortSizes = (sizesObject) => {
    return Object.entries(sizesObject).sort((a, b) => {
        const indexA = SIZES_ORDER.indexOf(a[0]);
        const indexB = SIZES_ORDER.indexOf(b[0]);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB; 
    });
};


// --- Lógica do Timer de Inatividade ---

let idleTimeout, countdownInterval;
let domElements, logoutHandlerCallback; // Dependências injetadas

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; 
const COUNTDOWN_SECONDS = 60;

const startCountdown = () => {
    domElements.idleModal.classList.remove('hidden');
    let secondsLeft = COUNTDOWN_SECONDS;
    domElements.countdownTimer.textContent = secondsLeft;
    countdownInterval = setInterval(() => {
        secondsLeft--;
        domElements.countdownTimer.textContent = secondsLeft;
        if (secondsLeft <= 0) {
            clearInterval(countdownInterval);
            if (logoutHandlerCallback) logoutHandlerCallback();
        }
    }, 1000);
};

export const resetIdleTimer = () => {
    if (!domElements || !logoutHandlerCallback) return; // Não executa se não for inicializado
    clearTimeout(idleTimeout);
    clearInterval(countdownInterval);
    domElements.idleModal.classList.add('hidden');
    idleTimeout = setTimeout(startCountdown, IDLE_TIMEOUT_MS);
};

/**
 * Inicializa o timer de inatividade, recebendo as dependências necessárias.
 * @param {object} dom - A referência para o objeto DOM do ui.js.
 * @param {function} logoutHandler - A função de logout a ser chamada quando o tempo esgotar.
 */
export const initializeIdleTimer = (dom, logoutHandler) => {
    domElements = dom;
    logoutHandlerCallback = logoutHandler;
    
    domElements.stayLoggedInBtn.addEventListener('click', resetIdleTimer);

    // Inicia o timer pela primeira vez
    resetIdleTimer();
};


// --- Funções de Geração de PDF ---

/**
 * =========================================================================
 * v4.2.2k - FUNÇÃO DE POLLING REMOVIDA
 * =========================================================================
 * A função 'awaitPdfLibraries' foi removida.
 * Os imports ESM no topo do arquivo garantem que jsPDF e autoTable
 * estejam carregados e o patch aplicado antes que este código seja executado.
 */

/**
 * Gera um PDF detalhado e completo de um pedido específico.
 * @param {string} orderId - O ID do pedido a ser impresso.
 * @param {Array} allOrders - O array completo de todos os pedidos.
 * @param {string} userCompanyName - O nome da empresa do usuário para o cabeçalho.
 * @param {function} showInfoModal - A função para exibir modais de informação.
 */
export const generateComprehensivePdf = async (orderId, allOrders, userCompanyName, showInfoModal) => {
    
    // --- LÓGICA v4.2.2k: Bloco try/catch do awaitPdfLibraries removido ---
    // (Não é mais necessário)

    showInfoModal("Iniciando geração do PDF...");
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showInfoModal("Erro: Pedido não encontrado.");
        return;
    }

    try {
        // --- MUDANÇA v4.2.2k: Instancia a partir do IMPORT 'jsPDF' ---
        const doc = new jsPDF('p', 'mm', 'a4'); 
        
        const A4_WIDTH = 210;
        const MARGIN = 15;
        const contentWidth = A4_WIDTH - MARGIN * 2;
        let yPosition = MARGIN;

        // --- CABEÇALHO ---
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(userCompanyName || 'Relatório de Pedido', A4_WIDTH / 2, yPosition, { align: 'center' });
        yPosition += 10;

        // --- DADOS DO CLIENTE ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Pedido - ${order.clientName}`, MARGIN, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const clientInfo = [
            [`Telefone:`, `${order.clientPhone || 'N/A'}`],
            [`Data do Pedido:`, `${order.orderDate ? new Date(order.orderDate + 'T00:00:00').toLocaleDateString('pt-br') : 'N/A'}`],
            [`Status:`, `${order.orderStatus}`],
            [`Data de Entrega:`, `${order.deliveryDate ? new Date(order.deliveryDate + 'T00:00:00').toLocaleDateString('pt-br') : 'N/A'}`]
        ];
        
        // --- MUDANÇA v4.2.2k: Usa a sintaxe de plugin 'doc.autoTable(...)' ---
        // (Esta chamada estava correta, o problema era a inicialização)
        doc.autoTable({
            body: clientInfo,
            startY: yPosition,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1 },
            columnStyles: { 0: { fontStyle: 'bold' } },
            didDrawPage: (data) => { yPosition = data.cursor.y; }
        });
        // --- MUDANÇA v4.2.2k: Usa 'doc.lastAutoTable' ---
        // (Esta chamada estava correta)
        yPosition = doc.lastAutoTable.finalY + 5;

        // --- TABELA DE PEÇAS ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Peças do Pedido', MARGIN, yPosition);
        yPosition += 6;

        const tableHead = [['Peça / Detalhes', 'Material', 'Cor', 'Qtd', 'V. Un.', 'Subtotal']];
        const tableBody = [];
        let subTotal = 0;

        (order.parts || []).forEach(p => {
            const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
            const specificQty = (p.specifics || []).length;
            const detailedQty = (p.details || []).length;
            const totalQty = standardQty + specificQty + detailedQty;

            const standardSub = standardQty * (p.unitPriceStandard !== undefined ? p.unitPriceStandard : p.unitPrice || 0);
            const specificSub = specificQty * (p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : p.unitPrice || 0);
            const detailedSub = detailedQty * (p.unitPrice || 0);
            const partSubtotal = standardSub + specificSub + detailedSub;
            subTotal += partSubtotal;

            let detailsText = '';
            if (p.partInputType === 'comum') {
                if (p.sizes && Object.keys(p.sizes).length > 0) {
                    detailsText += Object.entries(p.sizes).map(([cat, sizes]) =>
                        `${cat}: ${sortSizes(sizes).map(([size, qty]) => `${size}(${qty})`).join(', ')}`
                    ).join('\n');
                }
                if (p.specifics && p.specifics.length > 0) {
                    detailsText += (detailsText ? '\n' : '') + 'Específicos:\n' + p.specifics.map(s => 
                        `- L:${s.width||'N/A'}, A:${s.height||'N/A'} (${s.observation||'Sem obs.'})`
                    ).join('\n');
                }
            } else if (p.partInputType === 'detalhado' && p.details && p.details.length > 0) {
                detailsText = p.details.map(d => `${d.name||''} - ${d.size||''} - ${d.number||''}`).join('\n');
            }
            
            let unitPriceText = '';
            if(p.partInputType === 'comum') {
                if(standardQty > 0) unitPriceText += `R$ ${(p.unitPriceStandard !== undefined ? p.unitPriceStandard : p.unitPrice || 0).toFixed(2)} (Padrão)\n`;
                if(specificQty > 0) unitPriceText += `R$ ${(p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : p.unitPrice || 0).toFixed(2)} (Específico)`;
            } else {
                unitPriceText = `R$ ${(p.unitPrice || 0).toFixed(2)}`;
            }

            tableBody.push([
                { content: `${p.type}\n${detailsText}`, styles: { fontSize: 8 } },
                p.material,
                p.colorMain,
                totalQty,
                { content: unitPriceText.trim(), styles: { halign: 'right' } },
                { content: `R$ ${partSubtotal.toFixed(2)}`, styles: { halign: 'right' } }
            ]);
        });

        // --- MUDANÇA v4.2.2k: Usa a sintaxe de plugin 'doc.autoTable(...)' ---
        doc.autoTable({
            head: tableHead,
            body: tableBody,
            startY: yPosition,
            theme: 'grid',
            headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 60 },
                3: { halign: 'center' },
                4: { halign: 'right' },
                5: { halign: 'right' }
            },
            didDrawPage: (data) => { yPosition = data.cursor.y; }
        });
        // --- MUDANÇA v4.2.2k: Usa 'doc.lastAutoTable' ---
        yPosition = doc.lastAutoTable.finalY + 8;

        // --- OBSERVAÇÃO E FINANCEIRO ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Observação Geral', MARGIN, yPosition);
        yPosition += 5;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const obsLines = doc.splitTextToSize(order.generalObservation || 'Nenhuma.', contentWidth);
        doc.text(obsLines, MARGIN, yPosition);
        yPosition += (obsLines.length * 4) + 8;

        const discount = order.discount || 0;
        const grandTotal = subTotal - discount;
        const remaining = grandTotal - (order.downPayment || 0);

        const financialDetails = [
            ['Valor Bruto:', `R$ ${subTotal.toFixed(2)}`],
            ['Desconto:', `R$ ${discount.toFixed(2)}`],
            ['Adiantamento:', `R$ ${(order.downPayment || 0).toFixed(2)}`],
            ['Forma de Pgto:', `${order.paymentMethod || 'N/A'}`],
            ['VALOR TOTAL:', `R$ ${grandTotal.toFixed(2)}`],
            ['RESTA PAGAR:', `R$ ${remaining.toFixed(2)}`]
        ];

        // --- MUDANÇA v4.2.2k: Usa a sintaxe de plugin 'doc.autoTable(...)' ---
        doc.autoTable({
            body: financialDetails,
            startY: yPosition,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1.5 },
            columnStyles: { 0: { fontStyle: 'bold' } },
            didParseCell: (data) => {
                if (data.row.index >= 4) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fontSize = 12;
                }
            },
            didDrawPage: (data) => { yPosition = data.cursor.y; }
        });
        // --- MUDANÇA v4.2.2k: Usa 'doc.lastAutoTable' ---
        yPosition = doc.lastAutoTable.finalY;

        // --- IMAGENS ---
        if (order.mockupUrls && order.mockupUrls.length > 0) {
            yPosition += 10;
            if (yPosition > 250) { 
                doc.addPage();
                yPosition = MARGIN;
            }
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Arquivos (Mockups)', MARGIN, yPosition);
            yPosition += 8;
            
            for (const url of order.mockupUrls) {
                try {
                    const imgData = await new Promise((resolve, reject) => {
                        const img = new Image();
                        img.crossOrigin = 'Anonymous';
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/jpeg', 0.9));
                        };
                        img.onerror = (err) => reject(new Error(`Falha ao carregar imagem: ${url}`));
                        // v4.2.2k: Mantém o cache buster
                        img.src = url.includes('?') ? `${url}&v=${Date.now()}` : `${url}?v=${Date.now()}`;
                    });

                    const imgProps = doc.getImageProperties(imgData);
                    const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
                    
                    if (yPosition + imgHeight > 280) { // 297 (A4) - MARGIN
                        doc.addPage();
                        yPosition = MARGIN;
                    }
                    
                    doc.addImage(imgData, 'JPEG', MARGIN, yPosition, contentWidth, imgHeight);
                    yPosition += imgHeight + 5;

                } catch (imgError) {
                    console.error(imgError);
                    if (yPosition > 280) { doc.addPage(); yPosition = MARGIN; }
                    doc.setFontSize(9);
                    doc.setTextColor(150);
                    doc.text(`- Não foi possível carregar a imagem.`, MARGIN, yPosition);
                    yPosition += 5;
                    doc.setTextColor(0);
                }
            }
        }
        
        doc.save(`Pedido_${order.clientName.replace(/\s/g, '_')}.pdf`);
        showInfoModal("PDF gerado com sucesso!");

    } catch (error) {
        console.error("Erro ao gerar PDF programático (v4.2.2k):", error);
        showInfoModal("Ocorreu um erro inesperado ao gerar o PDF.");
    }
};

/**
 * =========================================================================
 * v4.2.2k - GERAÇÃO DE RECIBO DE QUITAÇÃO E ENTREGA (ESM CORRIGIDO)
 * =========================================================================
 * Gera um PDF de recibo de quitação E entrega.
 * Corrigido para usar o patch manual (v4.2.2k).
 * @param {object} orderData - O objeto de dados do pedido.
 * @param {string} userCompanyName - O nome da empresa do usuário.
 * @param {function} showInfoModal - A função para exibir modais de informação.
 */
export const generateReceiptPdf = async (orderData, userCompanyName, showInfoModal) => {
    
    // --- LÓGICA v4.2.2k: Bloco try/catch do awaitPdfLibraries removido ---
    // (Não é mais necessário)
    
    showInfoModal("Gerando recibo...");

    try {
        // 2. Cálculo de Total (LÓGICA CORRIGIDA E COMPLETA)
        let subTotal = 0;
        const tableBody = [];

        (orderData.parts || []).forEach(p => {
            const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
            const specificQty = (p.specifics || []).length;
            const detailedQty = (p.details || []).length;
            const totalQty = standardQty + specificQty + detailedQty;

            const standardSub = standardQty * (p.unitPriceStandard !== undefined ? p.unitPriceStandard : p.unitPrice || 0);
            const specificSub = specificQty * (p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : p.unitPrice || 0);
            const detailedSub = detailedQty * (p.unitPrice || 0);
            
            subTotal += (standardSub + specificSub + detailedSub);
            
            // Adiciona à tabela de itens para o recibo
            if (totalQty > 0) {
                tableBody.push([p.type, totalQty]);
            }
        });

        const discount = orderData.discount || 0;
        const grandTotal = subTotal - discount;
        const amountPaid = orderData.downPayment || 0; // O fluxo de 'quitar' garante que downPayment == grandTotal

        // 3. Inicializa o Documento PDF
        // --- MUDANÇA v4.2.2k: Instancia a partir do IMPORT 'jsPDF' ---
        const doc = new jsPDF('p', 'mm', 'a4');
        
        const A4_WIDTH = 210;
        const MARGIN = 15;
        const contentWidth = A4_WIDTH - MARGIN * 2;
        let yPosition = MARGIN;

        // --- TÍTULO ---
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('RECIBO DE QUITAÇÃO E ENTREGA', A4_WIDTH / 2, yPosition, { align: 'center' });
        yPosition += 15;

        // --- INFORMAÇÕES DO CLIENTE ---
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Cliente:`, MARGIN, yPosition);
        doc.setFont('helvetica', 'bold');
        doc.text(`${orderData.clientName || 'N/A'}`, MARGIN + 18, yPosition);
        yPosition += 6;

        doc.setFont('helvetica', 'normal');
        doc.text(`Telefone:`, MARGIN, yPosition);
        doc.setFont('helvetica', 'bold');
        doc.text(`${orderData.clientPhone || 'N/A'}`, MARGIN + 18, yPosition);
        yPosition += 10;
        
        // --- RESUMO FINANCEIRO ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumo Financeiro', MARGIN, yPosition);
        yPosition += 6;

        const financialDetails = [
            ['Valor Bruto (Itens):', `R$ ${subTotal.toFixed(2)}`],
            ['Desconto:', `R$ ${discount.toFixed(2)}`],
            ['VALOR TOTAL DO PEDIDO:', `R$ ${grandTotal.toFixed(2)}`],
            ['VALOR PAGO (QUITADO):', `R$ ${amountPaid.toFixed(2)}`]
        ];
        
        // --- MUDANÇA v4.2.2k: Usa a sintaxe de plugin 'doc.autoTable(...)' ---
        doc.autoTable({
            body: financialDetails,
            startY: yPosition,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1.5 },
            columnStyles: { 0: { fontStyle: 'bold' } },
            didParseCell: (data) => {
                if (data.row.index >= 2) { // Deixa VALOR TOTAL e PAGO em negrito
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            didDrawPage: (data) => { yPosition = data.cursor.y; }
        });
        // --- MUDANÇA v4.2.2k: Usa 'doc.lastAutoTable' ---
        yPosition = doc.lastAutoTable.finalY + 10;
        
        // --- ITENS ENTREGUES (Nova Tabela) ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Itens Entregues (Conferência)', MARGIN, yPosition);
        yPosition += 6;
        
        // --- MUDANÇA v4.2.2k: Usa a sintaxe de plugin 'doc.autoTable(...)' ---
        doc.autoTable({
            head: [['Tipo da Peça', 'Quantidade Total']],
            body: tableBody,
            startY: yPosition,
            theme: 'grid',
            headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold' },
            didDrawPage: (data) => { yPosition = data.cursor.y; }
        });
        // --- MUDANÇA v4.2.2k: Usa 'doc.lastAutoTable' ---
        yPosition = doc.lastAutoTable.finalY + 15;

        // --- TEXTO DE DECLARAÇÃO (Novo) ---
        doc.setFontSize(11);
        doc.setFont('helvetica', 'italic');
        const declarationText = `Declaro para os devidos fins que recebi os itens listados na tabela acima, conferi as quantidades e que o pedido foi entregue em sua totalidade. Declaro também que o valor total do pedido encontra-se quitado.`;
        const splitText = doc.splitTextToSize(declarationText, contentWidth);
        doc.text(splitText, MARGIN, yPosition);
        yPosition += (splitText.length * 5) + 20;
        
        // --- DATA ---
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const today = new Date().toLocaleDateString('pt-BR');
        doc.text(`Data: ${today}`, MARGIN, yPosition);
        yPosition += 25;

        // --- CAMPOS DE ASSINATURA (Novos) ---
        const signatureY = yPosition;
        const signatureWidth = 80; // Largura da linha de assinatura
        
        // Assinatura Empresa
        doc.line(MARGIN, signatureY, MARGIN + signatureWidth, signatureY); // Linha
        doc.text(userCompanyName || 'Empresa', MARGIN, signatureY + 6);
        doc.text('(Entregador / Recebedor)', MARGIN, signatureY + 11);
        
        // Assinatura Cliente
        const clientX = A4_WIDTH - MARGIN - signatureWidth;
        doc.line(clientX, signatureY, clientX + signatureWidth, signatureY); // Linha
        doc.text(orderData.clientName || 'Cliente', clientX, signatureY + 6);
        doc.text('(Recebedor do Pedido)', clientX, signatureY + 11);
        
        // 4. Salva o PDF
        doc.save(`Recibo_Entrega_${orderData.clientName.replace(/\s/g, '_')}.pdf`);
        showInfoModal("Recibo gerado com sucesso!");

    } catch (error) {
        console.error("Erro ao gerar PDF do Recibo (v4.2.2k):", error);
        // Mensagem de erro genérica, pois o carregamento da lib não é mais o problema
        showInfoModal("Não foi possível gerar o PDF do recibo. Ocorreu um erro interno.");
    }
};


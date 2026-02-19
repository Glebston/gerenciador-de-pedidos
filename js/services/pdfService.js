// js/services/pdfService.js
// ==========================================================
// SERVIÇO DE GERAÇÃO DE PDF (v1.0 - Refatorado)
// Responsável por: Orçamentos, OS de Produção e Recibos
// ==========================================================

import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";
import autoTable from "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/+esm";

// Importações de Serviços e Utilitários
import { calculateOrderTotals } from '../financialCalculator.js';
import { sortSizes } from '../utils.js'; // Mantemos a ordenação centralizada
import { urlToBase64, fetchCompanyBrandingData } from './imageService.js'; // Busca do novo serviço

// Inicializa o plugin de tabelas
autoTable.applyPlugin(jsPDF);

// --- Helpers Locais (Formatação Específica para PDF) ---

const _formatPhoneDisplay = (phone) => {
    if (!phone) return "";
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('55') && clean.length > 11) clean = clean.substring(2);
    if (clean.length === 11) return `(${clean.substring(0,2)}) ${clean.substring(2,7)}-${clean.substring(7)}`;
    if (clean.length === 10) return `(${clean.substring(0,2)}) ${clean.substring(2,6)}-${clean.substring(6)}`;
    return phone;
};

// --- Funções Privadas de Construção do Documento (Core) ---

const _createPdfDocument = async (order, userCompanyName, brandingData = null) => {
    const doc = new jsPDF('p', 'mm', 'a4'); 
        
    const A4_WIDTH = 210;
    const MARGIN = 15;
    const contentWidth = A4_WIDTH - MARGIN * 2;
    let yPosition = MARGIN;

    // --- 0. CÁLCULO FINANCEIRO ---
    const finance = calculateOrderTotals(order);

    // --- CABEÇALHO COM BRANDING ---
    let logoHeight = 0;

    // Se houver logo, processa
    if (brandingData && brandingData.logoBase64) {
        try {
            const logoSize = 25; // mm
            // Adiciona Logo (Esquerda)
            doc.addImage(brandingData.logoBase64, 'PNG', MARGIN, yPosition, logoSize, logoSize);
            logoHeight = logoSize;
        } catch (e) {
            console.warn("Erro renderizando logo no PDF:", e);
        }
    }

    // Texto do Cabeçalho
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    
    // Ajusta Y do texto para alinhar com o logo ou ficar no topo
    const textStartY = yPosition + 8;
    
    doc.text(userCompanyName || 'Relatório de Pedido', A4_WIDTH / 2, textStartY, { align: 'center' });
    
    // Se houver telefone, adiciona abaixo do nome
    if (brandingData && brandingData.phone) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Contato: ${_formatPhoneDisplay(brandingData.phone)}`, A4_WIDTH / 2, textStartY + 6, { align: 'center' });
    }

    // Atualiza yPosition garantindo que não fique em cima do logo
    yPosition += Math.max(logoHeight, 20) + 5; 

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
    
    doc.autoTable({
        body: clientInfo,
        startY: yPosition,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 1 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        didDrawPage: (data) => { yPosition = data.cursor.y; }
    });
    yPosition = doc.lastAutoTable.finalY + 5;

    // --- TABELA DE PEÇAS ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Peças do Pedido', MARGIN, yPosition);
    yPosition += 6;

    const tableHead = [['Peça / Detalhes', 'Material', 'Cor', 'Qtd', 'V. Un.', 'Subtotal']];
    const tableBody = [];
    
    (order.parts || []).forEach(p => {
        const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
        const specificQty = (p.specifics || []).length;
        const detailedQty = (p.details || []).length;
        const totalQty = standardQty + specificQty + detailedQty;

        const standardSub = standardQty * (p.unitPriceStandard !== undefined ? p.unitPriceStandard : p.unitPrice || 0);
        const specificSub = specificQty * (p.unitPriceSpecific !== undefined ? p.unitPriceSpecific : p.unitPrice || 0);
        const detailedSub = detailedQty * (p.unitPrice || 0);
        const partSubtotal = standardSub + specificSub + detailedSub;
        
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

    // --- BLOCO FINANCEIRO BLINDADO ---
    const financialDetails = [
        ['Valor Bruto:', `R$ ${finance.grossTotal.toFixed(2)}`], 
        ['Desconto:', `R$ ${finance.discount.toFixed(2)}`],
        ['Adiantamento:', `R$ ${finance.paid.toFixed(2)}`],
        ['Forma de Pgto:', `${order.paymentMethod || 'N/A'}`],
        ['VALOR TOTAL:', `R$ ${finance.total.toFixed(2)}`],
        ['RESTA PAGAR:', `R$ ${finance.remaining.toFixed(2)}`]
    ];

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
    yPosition = doc.lastAutoTable.finalY;

    // --- IMAGENS (MOCKUPS) ---
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
                // Reutilizando lógica do imageService
                const imgData = await urlToBase64(url);
                
                if (imgData) {
                    const imgProps = doc.getImageProperties(imgData);
                    const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
                    
                    if (yPosition + imgHeight > 280) { 
                        doc.addPage();
                        yPosition = MARGIN;
                    }
                    
                    doc.addImage(imgData, 'JPEG', MARGIN, yPosition, contentWidth, imgHeight);
                    yPosition += imgHeight + 5;
                }

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
    
    return { 
        doc, 
        filename: `Pedido_${order.clientName.replace(/\s/g, '_')}.pdf`
    };
};

const _createProductionPdfDocument = async (order, userCompanyName) => {
    // Layout: "Cego" (Sem valores), Foco em quantidades e detalhes técnicos
    const doc = new jsPDF('p', 'mm', 'a4'); 
        
    const A4_WIDTH = 210;
    const MARGIN = 15;
    const contentWidth = A4_WIDTH - MARGIN * 2;
    let yPosition = MARGIN;

    // --- CABEÇALHO ---
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDEM DE PRODUÇÃO', A4_WIDTH / 2, yPosition, { align: 'center' });
    yPosition += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(userCompanyName || 'Fábrica', A4_WIDTH / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // --- DADOS PRINCIPAIS ---
    doc.setDrawColor(0);
    doc.setFillColor(245, 245, 245);
    doc.rect(MARGIN, yPosition, contentWidth, 25, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`CLIENTE: ${order.clientName}`, MARGIN + 2, yPosition + 7);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tel: ${order.clientPhone || 'N/A'}`, MARGIN + 2, yPosition + 14);
    doc.text(`Data do Pedido: ${order.orderDate ? new Date(order.orderDate + 'T00:00:00').toLocaleDateString('pt-br') : 'N/A'}`, MARGIN + 2, yPosition + 21);

    // Destaque da Entrega (Lado Direito)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('DATA DE ENTREGA:', A4_WIDTH - MARGIN - 2, yPosition + 7, { align: 'right' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 0, 0); // Vermelho escuro
    const deliveryText = order.deliveryDate ? new Date(order.deliveryDate + 'T00:00:00').toLocaleDateString('pt-br') : 'A DEFINIR';
    doc.text(deliveryText, A4_WIDTH - MARGIN - 2, yPosition + 15, { align: 'right' });
    doc.setTextColor(0); 

    yPosition += 30;

    // --- TABELA DE PRODUÇÃO (SEM VALORES) ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Itens para Produção', MARGIN, yPosition);
    yPosition += 6;

    const tableHead = [['Peça / Detalhes (Grade)', 'Material', 'Cor', 'QTD TOTAL']];
    const tableBody = [];

    (order.parts || []).forEach(p => {
        const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
        const specificQty = (p.specifics || []).length;
        const detailedQty = (p.details || []).length;
        const totalQty = standardQty + specificQty + detailedQty;

        let detailsText = '';
        if (p.partInputType === 'comum') {
            if (p.sizes && Object.keys(p.sizes).length > 0) {
                detailsText += Object.entries(p.sizes).map(([cat, sizes]) =>
                    `${cat}: ${sortSizes(sizes).map(([size, qty]) => `${size}(${qty})`).join(', ')}`
                ).join('\n');
            }
            if (p.specifics && p.specifics.length > 0) {
                detailsText += (detailsText ? '\n' : '') + 'ESPECÍFICOS:\n' + p.specifics.map(s => 
                    `- ${s.width}x${s.height} (${s.observation||'Sem obs.'})`
                ).join('\n');
            }
        } else if (p.partInputType === 'detalhado' && p.details && p.details.length > 0) {
            detailsText = p.details.map(d => `• ${d.name||'--'} (${d.size||'--'}) Nº ${d.number||'--'}`).join('\n');
        }

        tableBody.push([
            { content: `${p.type}\n${detailsText}`, styles: { fontSize: 10 } },
            p.material,
            p.colorMain,
            { content: totalQty.toString(), styles: { halign: 'center', fontStyle: 'bold', fontSize: 12 } }
        ]);
    });

    doc.autoTable({
        head: tableHead,
        body: tableBody,
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: 'bold', fontSize: 11 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 30 },
            2: { cellWidth: 30 },
            3: { cellWidth: 20, halign: 'center' }
        },
        styles: { cellPadding: 2, fontSize: 10, valign: 'middle' },
        didDrawPage: (data) => { yPosition = data.cursor.y; }
    });
    yPosition = doc.lastAutoTable.finalY + 8;

    // --- OBSERVAÇÕES TÉCNICAS (MODO DINÂMICO) ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações / Instruções', MARGIN, yPosition);
    yPosition += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const obsLines = doc.splitTextToSize(order.generalObservation || 'Sem observações adicionais.', contentWidth - 4);
    const lineHeight = 5;
    const padding = 6;
    const boxHeight = Math.max(20, (obsLines.length * lineHeight) + padding);

    if (yPosition + boxHeight > 270) {
        doc.addPage();
        yPosition = MARGIN;
    }
    
    doc.setDrawColor(150);
    doc.rect(MARGIN, yPosition, contentWidth, boxHeight); 
    doc.text(obsLines, MARGIN + 2, yPosition + 5);
    yPosition += boxHeight + 10;

    // --- CHECKLIST DE PROCESSO ---
    if (yPosition > 280) {
        doc.addPage();
        yPosition = MARGIN;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Controle de Etapas:', MARGIN, yPosition);
    yPosition += 6;

    const stages = ['Corte', 'Estampa/Bordado', 'Costura', 'Revisão', 'Embalagem'];
    let xStage = MARGIN;
    const boxSize = 5;
    
    stages.forEach(stage => {
        doc.rect(xStage, yPosition - 4, boxSize, boxSize); // Checkbox
        doc.text(stage, xStage + 7, yPosition);
        xStage += 40; 
    });
    yPosition += 10;

    // --- MOCKUPS ---
    if (order.mockupUrls && order.mockupUrls.length > 0) {
        yPosition += 10;
        if (yPosition > 200) { 
            doc.addPage();
            yPosition = MARGIN;
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ANEXOS VISUAIS (MOCKUPS)', MARGIN, yPosition);
        yPosition += 10;
        
        for (const url of order.mockupUrls) {
            try {
                // Reutilizando lógica do imageService
                const imgData = await urlToBase64(url);
                if (imgData) {
                    const imgProps = doc.getImageProperties(imgData);
                    let imgWidth = contentWidth;
                    let imgHeight = (imgProps.height * contentWidth) / imgProps.width;
                    
                    if (imgHeight > 200) {
                        imgHeight = 200;
                        imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                    }

                    if (yPosition + imgHeight > 280) { 
                        doc.addPage();
                        yPosition = MARGIN;
                    }
                    
                    doc.addImage(imgData, 'JPEG', MARGIN, yPosition, imgWidth, imgHeight);
                    yPosition += imgHeight + 10;
                }
            } catch (imgError) {
                console.error("Erro imagem PDF Prod:", imgError);
            }
        }
    }

    return { 
        doc, 
        filename: `OS_Producao_${order.clientName.replace(/\s/g, '_')}.pdf`
    };
};

// --- Funções Públicas (Exportadas) ---

// 1. GERAÇÃO E DOWNLOAD (Apenas salva)
export const generateComprehensivePdf = async (orderId, allOrders, userCompanyName, showInfoModal) => {
    showInfoModal("Iniciando geração do PDF...");
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showInfoModal("Erro: Pedido não encontrado.");
        return;
    }

    try {
        // [NOVO] Busca branding via imageService antes de gerar
        const branding = await fetchCompanyBrandingData();
        if (branding && branding.logoUrl) {
            showInfoModal("Baixando logo da empresa...");
            // Converte a URL do branding para Base64 usando o imageService
            branding.logoBase64 = await urlToBase64(branding.logoUrl);
        }

        const { doc, filename } = await _createPdfDocument(order, userCompanyName, branding);
        doc.save(filename);
        showInfoModal("PDF gerado com sucesso!");

    } catch (error) {
        console.error("Erro ao gerar PDF programático:", error);
        showInfoModal("Ocorreu um erro inesperado ao gerar o PDF.");
    }
};

// 2. Geração da OS de Produção
export const generateProductionOrderPdf = async (orderId, allOrders, userCompanyName, showInfoModal) => {
    showInfoModal("Gerando OS de Produção...");
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showInfoModal("Erro: Pedido não encontrado.");
        return;
    }

    try {
        const { doc, filename } = await _createProductionPdfDocument(order, userCompanyName);
        doc.save(filename);
        showInfoModal("Ordem de Serviço gerada!");

    } catch (error) {
        console.error("Erro ao gerar OS:", error);
        showInfoModal("Erro ao gerar a Ordem de Serviço.");
    }
};

// 3. COMPARTILHAMENTO TURBO
export const shareOrderPdf = async (orderId, allOrders, userCompanyName, showInfoModal) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    showInfoModal(isMobile ? "Abrindo opções de compartilhar..." : "Preparando PDF para WhatsApp...");
    
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showInfoModal("Erro: Pedido não encontrado.");
        return;
    }

    try {
         // [NOVO] Busca branding via imageService
         const branding = await fetchCompanyBrandingData();
         if (branding && branding.logoUrl) {
             branding.logoBase64 = await urlToBase64(branding.logoUrl);
         }

        const { doc, filename } = await _createPdfDocument(order, userCompanyName, branding);
        
        if (isMobile && navigator.share) {
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    files: [pdfFile],
                    title: filename,
                    text: `Segue em anexo o pedido de ${order.clientName}`
                });
            } else {
                 doc.save(filename);
                 showInfoModal("Arquivo baixado. Seu navegador móvel não suporta envio direto.");
            }
        } else {
            doc.save(filename);
            
            let phone = order.clientPhone ? order.clientPhone.replace(/\D/g, '') : '';
            if (phone.length > 0 && phone.length <= 11) phone = '55' + phone; 
            
            const message = `Olá, aqui está o PDF do pedido (${filename}).`;
            const whatsappUrl = phone 
                ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
                : `https://wa.me/?text=${encodeURIComponent(message)}`;

            setTimeout(() => {
                window.open(whatsappUrl, '_blank');
                showInfoModal("PDF Baixado! Agora basta ARRASTAR o arquivo para a conversa do WhatsApp.");
            }, 800);
        }

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Erro ao compartilhar:", error);
            showInfoModal("Erro ao processar o compartilhamento.");
        }
    }
};

// 4. GERAÇÃO DE RECIBO
export const generateReceiptPdf = async (orderData, userCompanyName, showInfoModal) => {
    
    showInfoModal("Gerando recibo...");

    try {
        const finance = calculateOrderTotals(orderData); 
        
        const tableBody = [];

        (orderData.parts || []).forEach(p => {
            const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
            const specificQty = (p.specifics || []).length;
            const detailedQty = (p.details || []).length;
            const totalQty = standardQty + specificQty + detailedQty;
            
            if (totalQty > 0) {
                tableBody.push([p.type, totalQty]);
            }
        });

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
            ['Valor Bruto (Itens):', `R$ ${finance.grossTotal.toFixed(2)}`],
            ['Desconto:', `R$ ${finance.discount.toFixed(2)}`],
            ['VALOR TOTAL DO PEDIDO:', `R$ ${finance.total.toFixed(2)}`],
            ['VALOR PAGO (QUITADO):', `R$ ${finance.paid.toFixed(2)}`]
        ];
        
        doc.autoTable({
            body: financialDetails,
            startY: yPosition,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1.5 },
            columnStyles: { 0: { fontStyle: 'bold' } },
            didParseCell: (data) => {
                if (data.row.index >= 2) { 
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            didDrawPage: (data) => { yPosition = data.cursor.y; }
        });
        yPosition = doc.lastAutoTable.finalY + 10;
        
        // --- ITENS ENTREGUES ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Itens Entregues (Conferência)', MARGIN, yPosition);
        yPosition += 6;
        
        doc.autoTable({
            head: [['Tipo da Peça', 'Quantidade Total']],
            body: tableBody,
            startY: yPosition,
            theme: 'grid',
            headStyles: { fillColor: [230, 230, 230], textColor: 20, fontStyle: 'bold' },
            didDrawPage: (data) => { yPosition = data.cursor.y; }
        });
        yPosition = doc.lastAutoTable.finalY + 15;

        // --- TEXTO DE DECLARAÇÃO ---
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

        // --- CAMPOS DE ASSINATURA ---
        const signatureY = yPosition;
        const signatureWidth = 80; 
        
        doc.line(MARGIN, signatureY, MARGIN + signatureWidth, signatureY); 
        doc.text(userCompanyName || 'Empresa', MARGIN, signatureY + 6);
        doc.text('(Entregador / Recebedor)', MARGIN, signatureY + 11);
        
        const clientX = A4_WIDTH - MARGIN - signatureWidth;
        doc.line(clientX, signatureY, clientX + signatureWidth, signatureY); 
        doc.text(orderData.clientName || 'Cliente', clientX, signatureY + 6);
        doc.text('(Recebedor do Pedido)', clientX, signatureY + 11);
        
        doc.save(`Recibo_Entrega_${orderData.clientName.replace(/\s/g, '_')}.pdf`);
        showInfoModal("Recibo gerado com sucesso!");

    } catch (error) {
        console.error("Erro ao gerar PDF do Recibo:", error);
        showInfoModal("Não foi possível gerar o PDF do recibo. Ocorreu um erro interno.");
    }
};

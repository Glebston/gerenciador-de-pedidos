// js/utils.js
// =========================================================================
// v5.27.0 - PRODUCTION OS SUPPORT (BLIND PDF)
// =========================================================================
import { 
    getFirestore, 
    collectionGroup, 
    getDocs, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { db } from './firebaseConfig.js';
import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";
import autoTable from "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/+esm";

autoTable.applyPlugin(jsPDF);

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
let domElements, logoutHandlerCallback; 
let lastActivityTime = Date.now();

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; 
const COUNTDOWN_SECONDS = 60;

const startCountdown = () => {
    if (domElements && domElements.idleModal) {
        domElements.idleModal.classList.remove('hidden');
        let secondsLeft = COUNTDOWN_SECONDS;
        
        if (domElements.countdownTimer) {
            domElements.countdownTimer.textContent = secondsLeft;
        }

        countdownInterval = setInterval(() => {
            secondsLeft--;
            if (domElements.countdownTimer) {
                domElements.countdownTimer.textContent = secondsLeft;
            }
            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
                if (logoutHandlerCallback) logoutHandlerCallback();
            }
        }, 1000);
    }
};

export const resetIdleTimer = () => {
    if (!domElements || !logoutHandlerCallback) return; 
    
    clearTimeout(idleTimeout);
    clearInterval(countdownInterval);
    
    if (domElements.idleModal) {
        domElements.idleModal.classList.add('hidden');
    }
    
    idleTimeout = setTimeout(startCountdown, IDLE_TIMEOUT_MS);
};

const handleUserActivity = () => {
    const now = Date.now();
    if (now - lastActivityTime > 1000) {
        lastActivityTime = now;
        resetIdleTimer();
    }
};

export const initializeIdleTimer = (dom, logoutHandler) => {
    domElements = dom;
    logoutHandlerCallback = logoutHandler;
    
    if (domElements.stayLoggedInBtn) {
        domElements.stayLoggedInBtn.addEventListener('click', resetIdleTimer);
    }

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
        document.addEventListener(event, handleUserActivity, { passive: true });
    });

    resetIdleTimer();
};


// --- Funções de Geração de PDF (COMERCIAL) ---

const _createPdfDocument = async (order, userCompanyName) => {
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
                    img.src = url.includes('?') ? `${url}&v=${Date.now()}` : `${url}?v=${Date.now()}`;
                });

                const imgProps = doc.getImageProperties(imgData);
                const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
                
                if (yPosition + imgHeight > 280) { 
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
    
    return { 
        doc, 
        filename: `Pedido_${order.clientName.replace(/\s/g, '_')}.pdf`
    };
};

// --- Funções de Geração de PDF (OS DE PRODUÇÃO / CEGA) ---

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
    // Cliente + DATA DE ENTREGA (Em destaque)
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
    doc.setTextColor(200, 0, 0); // Vermelho escuro para atenção
    const deliveryText = order.deliveryDate ? new Date(order.deliveryDate + 'T00:00:00').toLocaleDateString('pt-br') : 'A DEFINIR';
    doc.text(deliveryText, A4_WIDTH - MARGIN - 2, yPosition + 15, { align: 'right' });
    doc.setTextColor(0); // Reset cor

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
                // Formatação para facilitar leitura (Grade em linhas separadas)
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
            // Lista de Nomes e Números
            detailsText = p.details.map(d => `• ${d.name||'--'} (${d.size||'--'}) Nº ${d.number||'--'}`).join('\n');
        }

        tableBody.push([
            { content: `${p.type}\n${detailsText}`, styles: { fontSize: 10 } }, // Fonte maior
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

    // --- OBSERVAÇÕES TÉCNICAS ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações / Instruções', MARGIN, yPosition);
    yPosition += 5;
    
    doc.setDrawColor(150);
    doc.rect(MARGIN, yPosition, contentWidth, 20); // Caixa para Obs
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const obsLines = doc.splitTextToSize(order.generalObservation || 'Sem observações adicionais.', contentWidth - 4);
    doc.text(obsLines, MARGIN + 2, yPosition + 5);
    yPosition += 25;

    // --- CHECKLIST DE PROCESSO (Rodapé de Controle) ---
    // [ ] Corte  [ ] Estampa  [ ] Costura  [ ] Revisão
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
        xStage += 40; // Espaçamento
    });
    yPosition += 10;

    // --- MOCKUPS (Foco Visual) ---
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
                    img.onerror = (err) => reject(new Error(`Falha img: ${url}`));
                    img.src = url.includes('?') ? `${url}&v=${Date.now()}` : `${url}?v=${Date.now()}`;
                });

                const imgProps = doc.getImageProperties(imgData);
                // Tenta usar largura total, mas limita altura para caber na página se possível
                let imgWidth = contentWidth;
                let imgHeight = (imgProps.height * contentWidth) / imgProps.width;
                
                // Se for muito alta, ajusta
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

// 1. GERAÇÃO E DOWNLOAD (Apenas salva)
export const generateComprehensivePdf = async (orderId, allOrders, userCompanyName, showInfoModal) => {
    showInfoModal("Iniciando geração do PDF...");
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showInfoModal("Erro: Pedido não encontrado.");
        return;
    }

    try {
        const { doc, filename } = await _createPdfDocument(order, userCompanyName);
        doc.save(filename);
        showInfoModal("PDF gerado com sucesso!");

    } catch (error) {
        console.error("Erro ao gerar PDF programático:", error);
        showInfoModal("Ocorreu um erro inesperado ao gerar o PDF.");
    }
};

// NOVO: Geração da OS de Produção
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

// =========================================================================
// 2. COMPARTILHAMENTO TURBO (Celular = Share / PC = Download + WhatsApp)
// =========================================================================
export const shareOrderPdf = async (orderId, allOrders, userCompanyName, showInfoModal) => {
    // Detecta se é dispositivo móvel (Android/iOS)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    showInfoModal(isMobile ? "Abrindo opções de compartilhar..." : "Preparando PDF para WhatsApp...");
    
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showInfoModal("Erro: Pedido não encontrado.");
        return;
    }

    try {
        const { doc, filename } = await _createPdfDocument(order, userCompanyName);
        
        if (isMobile && navigator.share) {
            // --- MODO CELULAR (Nativo) ---
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
            // --- MODO COMPUTADOR (Turbo WhatsApp) ---
            
            // 1. Baixar o Arquivo automaticamente
            doc.save(filename);
            
            // 2. Preparar Link do WhatsApp
            let phone = order.clientPhone ? order.clientPhone.replace(/\D/g, '') : '';
            if (phone.length > 0 && phone.length <= 11) phone = '55' + phone; 
            
            const message = `Olá, aqui está o PDF do pedido (${filename}).`;
            const whatsappUrl = phone 
                ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
                : `https://wa.me/?text=${encodeURIComponent(message)}`;

            // 3. Abrir WhatsApp em nova aba (com leve delay para garantir que o download iniciou)
            setTimeout(() => {
                window.open(whatsappUrl, '_blank');
                // Alerta explicativo
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

export const generateReceiptPdf = async (orderData, userCompanyName, showInfoModal) => {
    
    showInfoModal("Gerando recibo...");

    try {
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
            
            if (totalQty > 0) {
                tableBody.push([p.type, totalQty]);
            }
        });

        const discount = orderData.discount || 0;
        const grandTotal = subTotal - discount;
        const amountPaid = orderData.downPayment || 0; 

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
// --- FERRAMENTA DE MIGRAÇÃO (USO ÚNICO) ---
export const runDatabaseMigration = async (showInfoModal) => {
    const confirm = window.confirm("ATENÇÃO: Isso vai verificar todos os pedidos do sistema e adicionar o campo ID interno neles. Deseja continuar?");
    if (!confirm) return;

    showInfoModal("Iniciando reparo do banco de dados... Por favor aguarde.");
    console.log("--- INICIANDO MIGRAÇÃO ---");

    try {
        // Busca TODOS os pedidos de todas as empresas
        const q = collectionGroup(db, 'orders');
        const snapshot = await getDocs(q);
        
        let updatedCount = 0;
        let batchPromises = [];

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // Verifica se falta o campo 'id' ou se ele está vazio
            if (!data.id) {
                console.log(`Corrigindo pedido: ${docSnap.id}`);
                // Atualiza apenas o campo ID com o código do documento
                const updatePromise = updateDoc(docSnap.ref, { id: docSnap.id })
                    .then(() => console.log(`-> Sucesso: ${docSnap.id}`))
                    .catch(e => console.error(`-> Erro: ${docSnap.id}`, e));
                
                batchPromises.push(updatePromise);
                updatedCount++;
            }
        });

        await Promise.all(batchPromises);
        
        const msg = `Migração concluída! ${updatedCount} pedidos foram corrigidos.`;
        console.log(msg);
        showInfoModal(msg);

    } catch (error) {
        console.error("Erro fatal na migração:", error);
        showInfoModal("Erro ao rodar migração. Veja o console (F12).");
    }
};

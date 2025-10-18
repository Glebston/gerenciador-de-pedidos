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
 * Gera um PDF detalhado e completo de um pedido específico.
 * @param {string} orderId - O ID do pedido a ser impresso.
 * @param {Array} allOrders - O array completo de todos os pedidos.
 * @param {string} userCompanyName - O nome da empresa do usuário para o cabeçalho.
 * @param {function} showInfoModal - A função para exibir modais de informação.
 */
export const generateComprehensivePdf = async (orderId, allOrders, userCompanyName, showInfoModal) => {
    // **AJUSTE DE ROBUSTEZ:** Verifica se a biblioteca jsPDF foi carregada
    if (typeof window.jspdf === 'undefined') {
        showInfoModal("Erro: A biblioteca de PDF não pôde ser carregada. Verifique sua conexão com a internet.");
        return;
    }

    showInfoModal("Iniciando geração do PDF...");
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        showInfoModal("Erro: Pedido não encontrado.");
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
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
        yPosition = doc.autoTable.previous.finalY + 5;

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
        yPosition = doc.autoTable.previous.finalY + 8;

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
        yPosition = doc.autoTable.previous.finalY;

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
                        img.src = url;
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
        console.error("Erro ao gerar PDF programático:", error);
        showInfoModal("Ocorreu um erro inesperado ao gerar o PDF.");
    }
};

/**
 * Gera um PDF de recibo de quitação simples para um pedido.
 * @param {object} orderData - O objeto de dados do pedido.
 * @param {string} userCompanyName - O nome da empresa do usuário.
 * @param {function} showInfoModal - A função para exibir modais de informação.
 */
export const generateReceiptPdf = async (orderData, userCompanyName, showInfoModal) => {
    // **AJUSTE DE ROBUSTEZ:** Verifica se a biblioteca jsPDF foi carregada
    if (typeof window.jspdf === 'undefined') {
        showInfoModal("Erro: A biblioteca de PDF não pôde ser carregada. Verifique sua conexão com a internet.");
        return;
    }
    
    let totalValue = 0;
    (orderData.parts || []).forEach(p => {
        const standardQty = Object.values(p.sizes || {}).flatMap(cat => Object.values(cat)).reduce((s, c) => s + c, 0);
        const specificQty = (p.specifics || []).length;
        const standardSub = standardQty * (p.unitPriceStandard || p.unitPrice || 0);
        const specificSub = specificQty * (p.unitPriceSpecific || p.unitPrice || 0);
        totalValue += standardSub + specificSub;
    });
    totalValue -= (orderData.discount || 0);

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    
    const companyUser = userCompanyName || 'Sua Empresa';

    const receiptHtml = `
        <div style="font-family: Arial, sans-serif; padding: 40px; border: 1px solid #eee; width: 700px; margin: auto; background-color: white;">
            <h1 style="text-align: center; font-size: 24px; margin-bottom: 40px; color: #333;">RECIBO DE QUITAÇÃO</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #555;">
                Recebemos de <strong>${orderData.clientName || ''}</strong>, a importância de 
                <strong>R$ ${totalValue.toFixed(2)}</strong>, referente à quitação total do pedido de 
                ${(orderData.parts[0]?.type || 'fardamento personalizado').toLowerCase()}.
            </p>
            <p style="font-size: 14px; color: #777; margin-top: 30px;">
                Declaramos que o valor acima foi integralmente recebido, não restando nenhum débito pendente referente a este pedido.
            </p>
            <p style="text-align: right; margin-top: 50px; font-size: 16px;">${today}</p>
            <div style="margin-top: 80px; text-align: center;">
                <div style="display: inline-block; border-top: 1px solid #333; width: 300px; padding-top: 8px; font-size: 14px;">
                    Assinatura ( ${companyUser} )
                </div>
            </div>
        </div>
    `;
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        await doc.html(receiptHtml, {
            callback: function (doc) {
                doc.save(`Recibo_${orderData.clientName.replace(/\s/g, '_')}.pdf`);
            },
            x: 5,
            y: 5,
            width: 200, 
            windowWidth: 700 
        });

    } catch (error) {
        console.error("Erro ao gerar PDF do Recibo:", error);
        showInfoModal("Não foi possível gerar o PDF do recibo.");
    }
};

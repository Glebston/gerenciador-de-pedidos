/**
 * PagLucro Gestor - Scroll Guardian v2.0 (Force Mode)
 * Se o navegador não rolar por bem, rolará por mal.
 */
(function() {
    console.log("🛡️ Scroll Guardian v2: Iniciando protocolos de força...");

    window.addEventListener('keydown', function(e) {
        const key = e.key;
        
        // 1. Se o usuário está digitando num input/textarea, NÃO interferimos
        const targetTag = document.activeElement ? document.activeElement.tagName : '';
        if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || document.activeElement.isContentEditable) {
            return; 
        }

        // 2. Detecta as teclas de navegação
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space'].includes(key)) {
            
            // Tenta matar o evento do script antigo primeiro
            e.stopImmediatePropagation();
            
            // --- AQUI ESTÁ O TRUQUE ---
            // Em vez de confiar no navegador, nós rolamos manualmente
            const scrollAmount = 100; // Pixels para rolar por toque
            
            switch(key) {
                case 'ArrowDown':
                    window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                    break;
                case 'ArrowUp':
                    window.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
                    break;
                case 'PageDown':
                    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
                    break;
                case 'PageUp':
                    window.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
                    break;
                case 'Home':
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    break;
                case 'End':
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    break;
            }
        }
    }, { capture: true, passive: false }); // Capture true pega o evento ANTES de todo mundo

    // 3. Garantia de CSS (Caso o corpo esteja travado com overflow:hidden)
    const style = document.createElement('style');
    style.innerHTML = `
        html, body {
            overflow-y: auto !important;
            height: auto !important;
        }
    `;
    document.head.appendChild(style);

    console.log("🛡️ Scroll Guardian v2: Ativo e pronto para rolar manualmente.");
})();

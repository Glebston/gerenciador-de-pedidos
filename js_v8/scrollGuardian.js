/**
 * PagLucro Gestor - Scroll Guardian
 * Objetivo: Garantir que setas funcionem, impedindo preventDefault de terceiros
 * sem matar a propagação necessária para o navegador.
 */
(function() {
    // Lista de teclas que devem rolar a tela
    const keysToScroll = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];

    // Listener na fase de CAPTURA (desce do window para o elemento)
    window.addEventListener('keydown', function(e) {
        if (keysToScroll.includes(e.key)) {
            // Truque: Sobrescrevemos o preventDefault para ele não fazer nada
            // caso algum script ruim tente chamá-lo depois.
            const originalPrevent = e.preventDefault;
            
            e.preventDefault = function() {
                console.log('🚫 ScrollGuardian: Bloqueou uma tentativa de travar a rolagem.');
            };

            // NÃO usamos stopPropagation aqui para permitir que o navegador
            // receba o evento e role a página nativamente.
        }
    }, { capture: true, passive: false });
    
    console.log("🛡️ Scroll Guardian Ativado");
})();

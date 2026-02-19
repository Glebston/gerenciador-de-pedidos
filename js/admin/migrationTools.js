// js/admin/migrationTools.js
// Ferramentas administrativas de uso esporádico

import { db } from '../firebaseConfig.js';
import { collectionGroup, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export const runDatabaseMigration = async (showInfoModal) => {
    const confirm = window.confirm("ATENÇÃO: Isso vai verificar todos os pedidos do sistema e adicionar o campo ID interno neles. Deseja continuar?");
    if (!confirm) return;

    if(showInfoModal) showInfoModal("Iniciando reparo do banco de dados... Por favor aguarde.");
    console.log("--- INICIANDO MIGRAÇÃO ---");

    try {
        const q = collectionGroup(db, 'orders');
        const snapshot = await getDocs(q);
        
        let updatedCount = 0;
        let batchPromises = [];

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (!data.id) {
                console.log(`Corrigindo pedido: ${docSnap.id}`);
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
        if(showInfoModal) showInfoModal(msg);

    } catch (error) {
        console.error("Erro fatal na migração:", error);
        if(showInfoModal) showInfoModal("Erro ao rodar migração. Veja o console (F12).");
    }
};

// ============================================================
// SERVIÇO DE LISTENER (LISTEN/NOTIFY)
// ============================================================

import { dbOrigem } from "../config/database.js";
import { CONFIG } from "../config/index.js";
import { HANDLERS } from "../handlers/index.js";
import { buscarRegistroOrigem } from "./reconciliation.js";

/**
 * Processa uma notificação recebida do PostgreSQL
 * 
 * @param {string} payload - Payload JSON da notificação
 */
async function processarNotificacao(payload) {
    try {
        const { id, table, event_type } = JSON.parse(payload);

        console.log(`📨 Recebido: ${event_type} na tabela ${table} (ID: ${id})`);

        // Verifica se temos um handler para esta tabela
        const handler = HANDLERS[table];
        if (!handler) {
            console.warn(`⚠️ Nenhum handler configurado para tabela: ${table}`);
            return;
        }

        // Para DELETE, não precisamos buscar o registro (já foi deletado)
        if (event_type === "DELETE") {
            await handler(event_type, { id });
            return;
        }

        // Busca o registro completo no banco de origem
        const registroCompleto = await buscarRegistroOrigem(table, id);

        if (!registroCompleto) {
            console.error(`❌ Registro não encontrado: ${table} ID ${id}`);
            return;
        }

        console.log(JSON.stringify(registroCompleto, null, 2));

        // Processa a sincronização com dados completos
        await handler(event_type, registroCompleto);
    } catch (error) {
        console.error("❌ Erro ao processar notificação:", error.message);
        console.error("Payload recebido:", payload);
    }
}

/**
 * Inicia o listener para sincronização de demandas
 */
export async function iniciarListener() {
    console.log("📡 Iniciando listener para sincronização de demandas...");
    console.log(`🔌 Canal: ${CONFIG.canal}`);

    try {
        // Usa LISTEN/NOTIFY do postgres.js
        await dbOrigem.listen(CONFIG.canal, async (payload) => {
            await processarNotificacao(payload);
        });

        console.log("✅ Listener ativo e aguardando notificações...");
    } catch (error) {
        console.error("❌ Erro no listener:", error.message);
        console.log(`🔄 Reconectando em ${CONFIG.reconnectDelay / 1000} segundos...`);

        setTimeout(() => {
            iniciarListener();
        }, CONFIG.reconnectDelay);
    }
}

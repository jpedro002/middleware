// ============================================================
// CONEXÕES DE BANCO DE DADOS
// ============================================================

import postgres from "postgres";
import { SQL } from "bun";
import { CONFIG } from "./index.js";

// Conexão com banco de origem usando postgres.js (suporta LISTEN/NOTIFY)
export const dbOrigem = postgres(CONFIG.origem.url);

// Conexão com banco de destino usando Bun SQL (para escrita)
export const dbDestino = new SQL(CONFIG.destino.url);

/**
 * Fecha todas as conexões de banco de dados
 */
export async function fecharConexoes() {
    try {
        await dbOrigem.end();
        await dbDestino.close();
        console.log("✅ Conexões fechadas com sucesso");
    } catch (error) {
        console.error("❌ Erro ao fechar conexões:", error.message);
        throw error;
    }
}

// ============================================================
// MIDDLEWARE DE SINCRONIZAÇÃO DE DEMANDAS
// ============================================================
// Ponto de entrada principal da aplicação
// ============================================================

import { fecharConexoes } from "./config/database.js";
import { iniciarListener } from "./services/listener.js";
import { iniciarCronReconciliacao, pararCronReconciliacao } from "./services/cronManager.js";
import { verificarGaps } from "./services/reconciliation.js";

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown() {
    console.log("\n🛑 Encerrando middleware...");

    pararCronReconciliacao();

    try {
        await fecharConexoes();
    } catch (error) {
        console.error("❌ Erro durante shutdown:", error.message);
    }

    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ============================================================
// INICIALIZAÇÃO
// ============================================================

console.log("🚀 Middleware de Sincronização de Demandas");
console.log("=========================================");

// Inicia o listener de notificações
iniciarListener();

// Inicia o cron job de reconciliação
iniciarCronReconciliacao();

// Trigger imediato da reconciliação (comentado por padrão)
// console.log("⚡ Executando reconciliação imediata na inicialização...");
// verificarGaps();

export { verificarGaps };

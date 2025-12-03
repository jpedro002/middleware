// ============================================================
// REGISTRO CENTRAL DE HANDLERS
// ============================================================

import { sincronizarDemanda } from "./demandaHandler.js";
import { sincronizarFiscalDemanda } from "./fiscalDemandaHandler.js";

/**
 * Mapeamento de tabelas de origem para seus handlers
 */
export const HANDLERS = {
    "public.demanda": sincronizarDemanda,
    "public.fiscaldemanda": sincronizarFiscalDemanda,
    // Adicionar mais handlers conforme necessário:
    // "public.pessoa": sincronizarPessoa,
};

export { sincronizarDemanda, sincronizarFiscalDemanda };

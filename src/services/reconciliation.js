// ============================================================
// SERVIÇO DE RECONCILIAÇÃO
// ============================================================

import { dbOrigem, dbDestino } from "../config/database.js";
import { sincronizarDemanda } from "../handlers/demandaHandler.js";
import { sincronizarFiscalDemanda } from "../handlers/fiscalDemandaHandler.js";

/**
 * Busca o registro completo no banco de origem pelo ID
 * 
 * @param {string} table - Nome da tabela no formato "schema.tabela"
 * @param {number} id - ID do registro
 * @returns {Promise<object|null>} Registro completo ou null se não encontrado
 */
export async function buscarRegistroOrigem(table, id) {
    try {
        let resultado;

        // Para segurança e compatibilidade, switch case por tabela
        switch (table) {
            case "public.demanda":
                resultado = await dbOrigem`SELECT * FROM public.demanda WHERE id = ${id}`;
                break;
            case "public.fiscaldemanda":
                resultado = await dbOrigem`SELECT * FROM public.fiscaldemanda WHERE id = ${id}`;
                break;
            default:
                console.error(`❌ Tabela não suportada: ${table}`);
                return null;
        }

        return resultado[0] || null;
    } catch (error) {
        console.error(`❌ Erro ao buscar registro ${table} ID ${id}:`, error.message);
        return null;
    }
}

/**
 * Verifica gaps entre origem e destino e sincroniza registros faltantes
 */
export async function verificarGaps() {
    console.log("\n🔍 Verificando inconsistências (Reconciliação)...");

    await verificarGapsDemandas();
    await verificarGapsFiscalDemanda();
}

/**
 * Verifica gaps de demandas
 */
async function verificarGapsDemandas() {
    console.log("\n📋 Reconciliando DEMANDAS...");

    try {
        // Pega os últimos 5000 IDs da origem
        const origemIds = await dbOrigem`
            SELECT id FROM public.demanda 
            ORDER BY id DESC LIMIT 5000
        `;

        if (origemIds.length === 0) {
            console.log("📭 Nenhum registro na origem para verificar");
            return;
        }

        const minId = origemIds[origemIds.length - 1].id;
        const maxId = origemIds[0].id;

        // Pega o que temos no destino nesse range
        const destinoIds = await dbDestino`
            SELECT id FROM fiscalizacao.demandas 
            WHERE id BETWEEN ${minId} AND ${maxId}
        `;

        // Cria Sets para comparação rápida
        const setDestino = new Set(destinoIds.map((d) => d.id));

        // Filtra quem está na origem mas NÃO no destino
        const faltantes = origemIds.filter((d) => !setDestino.has(d.id));

        if (faltantes.length > 0) {
            console.warn(`⚠️ Encontrados ${faltantes.length} demandas faltando! Sincronizando...`);

            let sincronizados = 0;
            let erros = 0;

            for (const item of faltantes) {
                try {
                    console.log(`🔄 Recuperando demanda ID: ${item.id}`);
                    const registro = await buscarRegistroOrigem("public.demanda", item.id);
                    if (registro) {
                        await sincronizarDemanda("INSERT", registro);
                        sincronizados++;
                    }
                } catch (error) {
                    console.error(`❌ Erro ao sincronizar demanda ID ${item.id}:`, error.message);
                    erros++;
                }
            }

            console.log(`✅ Demandas: ${sincronizados} sincronizadas, ${erros} erros`);
        } else {
            console.log("✅ Demandas: nenhuma inconsistência encontrada.");
        }
    } catch (error) {
        console.error("❌ Erro ao verificar gaps de demandas:", error.message);
    }
}

/**
 * Verifica gaps de fiscal-demanda
 * Sincroniza apenas registros onde a demanda E fiscal existem no destino
 */
async function verificarGapsFiscalDemanda() {
    console.log("\n👤 Reconciliando FISCAL-DEMANDA...");

    try {
        // Busca demandas e fiscais existentes no destino para validação
        const [demandasDestino, fiscaisDestino] = await Promise.all([
            dbDestino`SELECT id FROM fiscalizacao.demandas`,
            dbDestino`SELECT id FROM fiscalizacao.fiscais`,
        ]);

        const setDemandasDestino = new Set(demandasDestino.map((d) => d.id));
        const setFiscaisDestino = new Set(fiscaisDestino.map((f) => f.id));

        // Pega os últimos 5000 registros da origem
        const origemRegistros = await dbOrigem`
            SELECT id, demanda_id, usuario_id 
            FROM public.fiscaldemanda 
            WHERE ativo = true
            ORDER BY id DESC LIMIT 5000
        `;

        if (origemRegistros.length === 0) {
            console.log("📭 Nenhum registro de fiscal-demanda na origem");
            return;
        }

        // Filtra apenas os que têm demanda E fiscal existentes no destino
        const registrosValidos = origemRegistros.filter((r) => {
            const demandaExiste = setDemandasDestino.has(Number(r.demanda_id));
            const fiscalExiste = setFiscaisDestino.has(Number(r.usuario_id));
            return demandaExiste && fiscalExiste;
        });

        console.log(`   📊 ${origemRegistros.length} na origem, ${registrosValidos.length} válidos (demanda+fiscal existem)`);

        if (registrosValidos.length === 0) {
            console.log("✅ Fiscal-Demanda: nenhum registro válido para reconciliar.");
            return;
        }

        // Pega todas as relações do destino
        const destinoRegistros = await dbDestino`
            SELECT demanda_id, fiscal_id 
            FROM fiscalizacao.demandas_fiscais
        `;

        // Cria Set com chave composta "demanda_id-fiscal_id"
        const setDestino = new Set(
            destinoRegistros.map((d) => `${d.demanda_id}-${d.fiscal_id}`)
        );

        // Filtra quem está na origem mas NÃO no destino
        const faltantes = registrosValidos.filter(
            (r) => !setDestino.has(`${r.demanda_id}-${r.usuario_id}`)
        );

        if (faltantes.length > 0) {
            console.warn(`⚠️ Encontrados ${faltantes.length} fiscal-demanda faltando! Sincronizando...`);

            let sincronizados = 0;
            let erros = 0;

            for (const item of faltantes) {
                try {
                    const registro = await buscarRegistroOrigem("public.fiscaldemanda", item.id);
                    if (registro) {
                        await sincronizarFiscalDemanda("INSERT", registro);
                        sincronizados++;
                    }
                } catch (error) {
                    console.error(`❌ Erro ao sincronizar fiscal-demanda ID ${item.id}:`, error.message);
                    erros++;
                }
            }

            console.log(`✅ Fiscal-Demanda: ${sincronizados} sincronizadas, ${erros} erros`);
        } else {
            console.log("✅ Fiscal-Demanda: nenhuma inconsistência encontrada.");
        }
    } catch (error) {
        console.error("❌ Erro ao verificar gaps de fiscal-demanda:", error.message);
    }
}

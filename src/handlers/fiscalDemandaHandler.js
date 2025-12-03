// ============================================================
// HANDLER: Sincronização de Fiscal-Demanda (relação N:N)
// ============================================================

import { dbDestino } from "../config/database.js";
import { mapearFiscalDemanda, validarFiscalDemanda } from "../mappers/fiscalDemandaMapper.js";
import { salvarErro } from "../utils/errorLogger.js";

/**
 * Verifica se a demanda e fiscal existem no destino
 */
async function verificarDependencias(demandaId, fiscalId) {
    const [demanda, fiscal] = await Promise.all([
        dbDestino`SELECT id FROM fiscalizacao.demandas WHERE id = ${demandaId}`,
        dbDestino`SELECT id FROM fiscalizacao.fiscais WHERE id = ${fiscalId}`,
    ]);

    return {
        demandaExiste: demanda.length > 0,
        fiscalExiste: fiscal.length > 0,
    };
}

/**
 * Sincroniza uma relação fiscal-demanda do banco origem para o destino
 * 
 * @param {string} event_type - Tipo de evento: INSERT, UPDATE, DELETE
 * @param {object} data - Dados da fiscaldemanda da origem
 */
export async function sincronizarFiscalDemanda(event_type, data) {
    const dadosMapeados = mapearFiscalDemanda(data);

    // Validar dados antes de processar
    const validacao = validarFiscalDemanda(dadosMapeados);
    if (!validacao.valido) {
        console.error(`❌ Dados inválidos para fiscal-demanda:`, validacao.erros);
        salvarErro(
            data.id,
            "demandas_fiscais",
            "validation_error",
            validacao.erros.join("; "),
            dadosMapeados
        );
        return;
    }

    try {
        console.log(`\n👤 FISCAL-DEMANDA ${event_type}:`);
        console.log(`   📋 Dados mapeados:`, JSON.stringify(dadosMapeados, null, 2));

        // Para INSERT e UPDATE, verificar se dependências existem
        if (event_type === "INSERT" || event_type === "UPDATE") {
            const deps = await verificarDependencias(dadosMapeados.demanda_id, dadosMapeados.fiscal_id);

            if (!deps.demandaExiste) {
                console.warn(`   ⚠️ Demanda ${dadosMapeados.demanda_id} não existe no destino - ignorando`);
                return;
            }

            if (!deps.fiscalExiste) {
                console.warn(`   ⚠️ Fiscal ${dadosMapeados.fiscal_id} não existe no destino - ignorando`);
                return;
            }
        }

        if (event_type === "INSERT") {
            await inserirFiscalDemanda(dadosMapeados);
            console.log(`   ✅ INSERT fiscal-demanda (demanda: ${dadosMapeados.demanda_id}, fiscal: ${dadosMapeados.fiscal_id})`);
        }

        if (event_type === "UPDATE") {
            await atualizarFiscalDemanda(dadosMapeados);
            console.log(`   🔄 UPDATE fiscal-demanda (demanda: ${dadosMapeados.demanda_id}, fiscal: ${dadosMapeados.fiscal_id})`);
        }

        if (event_type === "DELETE") {
            await deletarFiscalDemanda(dadosMapeados.demanda_id, dadosMapeados.fiscal_id);
            console.log(`   🗑️ DELETE fiscal-demanda (demanda: ${dadosMapeados.demanda_id}, fiscal: ${dadosMapeados.fiscal_id})`);
        }
    } catch (error) {
        console.error(`❌ Erro ao sincronizar fiscal-demanda:`, error.message);

        // Verificar se é erro de constraint (FK)
        if (error.message.includes("violates foreign key constraint") || error.message.includes("violates")) {
            salvarErro(
                data.id,
                "demandas_fiscais",
                "foreign_key_constraint",
                error.message,
                dadosMapeados
            );
        }

        throw error;
    }
}

/**
 * Insere uma nova relação fiscal-demanda (com UPSERT)
 * Nota: Colunas extras (ativo, data_criacao, usuario_alteracao) serão adicionadas após migration
 */
async function inserirFiscalDemanda(dados) {
    await dbDestino`
        INSERT INTO fiscalizacao.demandas_fiscais (
            demanda_id,
            fiscal_id
        )
        VALUES (
            ${dados.demanda_id},
            ${dados.fiscal_id}
        )
        ON CONFLICT (demanda_id, fiscal_id) DO NOTHING
    `;
}

/**
 * Atualiza uma relação fiscal-demanda existente (ou insere se não existir)
 * Como a tabela só tem a PK composta, UPDATE = garantir que existe
 */
async function atualizarFiscalDemanda(dados) {
    // UPSERT: insere se não existir, ignora se já existir
    await inserirFiscalDemanda(dados);
}

/**
 * Deleta uma relação fiscal-demanda (hard delete)
 */
async function deletarFiscalDemanda(demandaId, fiscalId) {
    await dbDestino`
        DELETE FROM fiscalizacao.demandas_fiscais 
        WHERE demanda_id = ${demandaId} AND fiscal_id = ${fiscalId}
    `;
}

// ============================================================
// SCRIPT: Sincronizar FiscalDemanda baseado nas demandas existentes
// ============================================================
// Sincroniza apenas os registros de fiscaldemanda (origem) para
// demandas_fiscais (destino) onde a demanda já existe no destino.
// ============================================================

import { dbOrigem, dbDestino, fecharConexoes } from "../config/database.js";

const BATCH_SIZE = 500; // Processa em lotes para não sobrecarregar

async function syncFiscalDemanda() {
    console.log("🚀 Iniciando sincronização de Fiscal-Demanda...");
    console.log("=".repeat(60));

    try {
        // 1. Busca todas as demandas que existem no destino
        console.log("\n📋 Buscando demandas existentes no destino...");
        const demandasDestino = await dbDestino`
            SELECT id FROM fiscalizacao.demandas
        `;

        if (demandasDestino.length === 0) {
            console.log("❌ Nenhuma demanda encontrada no destino. Abortando.");
            return;
        }

        console.log(`✅ Encontradas ${demandasDestino.length} demandas no destino`);

        // Cria Set para lookup rápido
        const setDemandasDestino = new Set(demandasDestino.map((d) => d.id));

        // 2. Busca todos os fiscais que existem no destino
        console.log("\n👤 Buscando fiscais existentes no destino...");
        const fiscaisDestino = await dbDestino`
            SELECT id FROM fiscalizacao.fiscais
        `;

        console.log(`✅ Encontrados ${fiscaisDestino.length} fiscais no destino`);
        const setFiscaisDestino = new Set(fiscaisDestino.map((f) => f.id));

        // 3. Busca relações fiscal-demanda já existentes no destino
        console.log("\n🔗 Buscando relações existentes no destino...");
        const relacoesDestino = await dbDestino`
            SELECT demanda_id, fiscal_id FROM fiscalizacao.demandas_fiscais
        `;

        console.log(`✅ Encontradas ${relacoesDestino.length} relações existentes`);
        const setRelacoesDestino = new Set(
            relacoesDestino.map((r) => `${r.demanda_id}-${r.fiscal_id}`)
        );

        // 4. Busca fiscal-demanda da origem (apenas ativos)
        console.log("\n📥 Buscando fiscal-demanda da origem...");
        const fiscalDemandaOrigem = await dbOrigem`
            SELECT id, demanda_id, usuario_id, ativo, data_criacao 
            FROM public.fiscaldemanda 
            WHERE ativo = true
            ORDER BY id
        `;

        console.log(`✅ Encontrados ${fiscalDemandaOrigem.length} registros na origem`);

        // 5. Filtra apenas os que têm demanda E fiscal existentes no destino
        console.log("\n🔍 Filtrando registros válidos...");
        const registrosValidos = fiscalDemandaOrigem.filter((r) => {
            const demandaExiste = setDemandasDestino.has(Number(r.demanda_id));
            const fiscalExiste = setFiscaisDestino.has(Number(r.usuario_id));
            const relacaoNaoExiste = !setRelacoesDestino.has(`${r.demanda_id}-${r.usuario_id}`);

            return demandaExiste && fiscalExiste && relacaoNaoExiste;
        });

        console.log(`✅ ${registrosValidos.length} registros válidos para sincronizar`);

        // Estatísticas de filtro
        const semDemanda = fiscalDemandaOrigem.filter(
            (r) => !setDemandasDestino.has(Number(r.demanda_id))
        ).length;
        const semFiscal = fiscalDemandaOrigem.filter(
            (r) => !setFiscaisDestino.has(Number(r.usuario_id))
        ).length;
        const jaExistem = fiscalDemandaOrigem.filter(
            (r) => setRelacoesDestino.has(`${r.demanda_id}-${r.usuario_id}`)
        ).length;

        console.log(`   📊 Ignorados (demanda não existe): ${semDemanda}`);
        console.log(`   📊 Ignorados (fiscal não existe): ${semFiscal}`);
        console.log(`   📊 Já existem no destino: ${jaExistem}`);

        if (registrosValidos.length === 0) {
            console.log("\n✅ Nada para sincronizar!");
            return;
        }

        // 6. Insere em lotes
        console.log(`\n⚡ Inserindo em lotes de ${BATCH_SIZE}...`);

        let totalInseridos = 0;
        let totalErros = 0;

        for (let i = 0; i < registrosValidos.length; i += BATCH_SIZE) {
            const batch = registrosValidos.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(registrosValidos.length / BATCH_SIZE);

            console.log(`\n📦 Processando lote ${batchNum}/${totalBatches} (${batch.length} registros)...`);

            try {
                // Prepara valores para INSERT em massa
                const valores = batch.map((r) => ({
                    demanda_id: Number(r.demanda_id),
                    fiscal_id: Number(r.usuario_id),
                }));

                // INSERT com ON CONFLICT DO NOTHING
                await dbDestino`
                    INSERT INTO fiscalizacao.demandas_fiscais ${dbDestino(valores)}
                    ON CONFLICT (demanda_id, fiscal_id) DO NOTHING
                `;

                totalInseridos += batch.length;
                console.log(`   ✅ Lote ${batchNum} inserido com sucesso`);
            } catch (error) {
                console.error(`   ❌ Erro no lote ${batchNum}:`, error.message);

                // Tenta inserir um por um para identificar problemas
                for (const registro of batch) {
                    try {
                        await dbDestino`
                            INSERT INTO fiscalizacao.demandas_fiscais (demanda_id, fiscal_id)
                            VALUES (${Number(registro.demanda_id)}, ${Number(registro.usuario_id)})
                            ON CONFLICT (demanda_id, fiscal_id) DO NOTHING
                        `;
                        totalInseridos++;
                    } catch (err) {
                        console.error(`      ❌ Erro ao inserir (demanda: ${registro.demanda_id}, fiscal: ${registro.usuario_id}):`, err.message);
                        totalErros++;
                    }
                }
            }
        }

        // 7. Resumo final
        console.log("\n" + "=".repeat(60));
        console.log("📊 RESUMO DA SINCRONIZAÇÃO");
        console.log("=".repeat(60));
        console.log(`   Demandas no destino:    ${demandasDestino.length}`);
        console.log(`   Fiscais no destino:     ${fiscaisDestino.length}`);
        console.log(`   Relações existentes:    ${relacoesDestino.length}`);
        console.log("─".repeat(60));
        console.log(`   Total na origem:        ${fiscalDemandaOrigem.length}`);
        console.log(`   Sem demanda no destino: ${semDemanda}`);
        console.log(`   Sem fiscal no destino:  ${semFiscal}`);
        console.log(`   Já existem:             ${jaExistem}`);
        console.log("─".repeat(60));
        console.log(`   Válidos para sync:      ${registrosValidos.length}`);
        console.log(`   Inseridos com sucesso:  ${totalInseridos}`);
        console.log(`   Erros:                  ${totalErros}`);
        console.log("=".repeat(60));

    } catch (error) {
        console.error("❌ Erro fatal:", error.message);
        console.error(error.stack);
    } finally {
        await fecharConexoes();
    }
}

// Executa o script
syncFiscalDemanda();

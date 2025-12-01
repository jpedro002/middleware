import postgres from "postgres";
import { SQL } from "bun";

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const CONFIG = {
    origem: {
        url: process.env.DATABASE_ORIGEM_URL || "postgres://postgres:postgres@localhost:5432/fiscalize",
    },
    destino: {
        url: process.env.DATABASE_DESTINO_URL || "postgres://postgres:postgres@localhost:5432/agefisAA",
    },
    canal: "sync_channel",
    reconnectDelay: 5000, // 5 segundos para reconexão
};

// Conexão com banco de origem usando postgres.js (suporta LISTEN/NOTIFY)
const dbOrigem = postgres(CONFIG.origem.url);

// Conexão com banco de destino usando Bun SQL (para escrita)
const dbDestino = new SQL(CONFIG.destino.url);

// ============================================================
// MAPEAMENTO DE CAMPOS: demanda (origem) -> demandas (destino)
// ============================================================

/**
 * Mapeia os campos da tabela `demanda` (origem) para `demandas` (destino Prisma)
 * Apenas campos que existem no schema do destino são mapeados
 */
function mapearDemanda(dataOrigem) {
    return {
        // Campo ID
        id: dataOrigem.id,

        // Situação e motivo
        situacao_id: dataOrigem.situacao || 1,
        motivo_id: null, // Não existe na origem (pode ser preenchido depois)
        fiscal_id: null, // Será preenchido depois se necessário

        // Identificação da demanda
        fiscalizado_demanda: dataOrigem.protocolo || `DEMANDA-${dataOrigem.id}`,

        // Dados do fiscalizado (podem vir de join com pessoa depois)
        fiscalizado_cpf_cnpj: "", // TODO: buscar da tabela pessoa por fiscalizado_id
        fiscalizado_nome: "", // TODO: buscar da tabela pessoa por fiscalizado_id

        // Endereço do fiscalizado
        fiscalizado_logradouro: dataOrigem.logradouro || "",
        fiscalizado_numero: dataOrigem.numero || "",
        fiscalizado_complemento: dataOrigem.complemento || "",
        fiscalizado_bairro: dataOrigem.bairro || "",
        fiscalizado_municipio: dataOrigem.municipio || null,
        fiscalizado_uf: dataOrigem.uf || null,

        // Localização geográfica
        fiscalizado_lat: dataOrigem.latitude || "",
        fiscalizado_lng: dataOrigem.longitude || "",

        // Classificação da demanda
        classificacao: dataOrigem.os_direta ? "direta" : "ordinaria",

        // Datas importantes
        data_criacao: dataOrigem.data_criacao,
        data_realizacao: dataOrigem.datafiscalizacao || dataOrigem.dataexecucao || dataOrigem.data_criacao,

        // Status
        ativo: dataOrigem.ativo,

        // Tipo de rota
        tipo_rota: dataOrigem.tipo_rota || null,

        // Relacionamentos
        grupo_ocorrencia_id: dataOrigem.grupodemanda_id || 1,
    };
}

// ============================================================
// SINCRONIZAÇÃO
// ============================================================

async function sincronizarDemanda(event_type, data) {
    const demandaMapeada = mapearDemanda(data);

    try {
        if (event_type === "INSERT") {
            await dbDestino`
        INSERT INTO fiscalizacao.demandas (
          id, situacao_id, motivo_id, fiscal_id,
          fiscalizado_demanda, fiscalizado_cpf_cnpj, fiscalizado_nome,
          fiscalizado_logradouro, fiscalizado_numero, fiscalizado_complemento,
          fiscalizado_bairro, fiscalizado_municipio, fiscalizado_uf,
          fiscalizado_lat, fiscalizado_lng, classificacao,
          data_criacao, data_realizacao, ativo, tipo_rota, grupo_ocorrencia_id
        )
        VALUES (
          ${demandaMapeada.id},
          ${demandaMapeada.situacao_id},
          ${demandaMapeada.motivo_id},
          ${demandaMapeada.fiscal_id},
          ${demandaMapeada.fiscalizado_demanda},
          ${demandaMapeada.fiscalizado_cpf_cnpj},
          ${demandaMapeada.fiscalizado_nome},
          ${demandaMapeada.fiscalizado_logradouro},
          ${demandaMapeada.fiscalizado_numero},
          ${demandaMapeada.fiscalizado_complemento},
          ${demandaMapeada.fiscalizado_bairro},
          ${demandaMapeada.fiscalizado_municipio},
          ${demandaMapeada.fiscalizado_uf},
          ${demandaMapeada.fiscalizado_lat},
          ${demandaMapeada.fiscalizado_lng},
          ${demandaMapeada.classificacao}::fiscalizacao.classificacao_os,
          ${demandaMapeada.data_criacao},
          ${demandaMapeada.data_realizacao},
          ${demandaMapeada.ativo},
          ${demandaMapeada.tipo_rota},
          ${demandaMapeada.grupo_ocorrencia_id}
        )
        ON CONFLICT (id) DO UPDATE SET
          situacao_id = EXCLUDED.situacao_id,
          fiscalizado_demanda = EXCLUDED.fiscalizado_demanda,
          fiscalizado_logradouro = EXCLUDED.fiscalizado_logradouro,
          fiscalizado_numero = EXCLUDED.fiscalizado_numero,
          fiscalizado_complemento = EXCLUDED.fiscalizado_complemento,
          fiscalizado_bairro = EXCLUDED.fiscalizado_bairro,
          fiscalizado_lat = EXCLUDED.fiscalizado_lat,
          fiscalizado_lng = EXCLUDED.fiscalizado_lng,
          data_realizacao = EXCLUDED.data_realizacao,
          ativo = EXCLUDED.ativo
      `;
            console.log(`✅ INSERT/UPSERT demanda ID ${data.id}`);
        }

        if (event_type === "UPDATE") {
            await dbDestino`
        UPDATE fiscalizacao.demandas SET
          situacao_id = ${demandaMapeada.situacao_id},
          fiscalizado_demanda = ${demandaMapeada.fiscalizado_demanda},
          fiscalizado_logradouro = ${demandaMapeada.fiscalizado_logradouro},
          fiscalizado_numero = ${demandaMapeada.fiscalizado_numero},
          fiscalizado_complemento = ${demandaMapeada.fiscalizado_complemento},
          fiscalizado_bairro = ${demandaMapeada.fiscalizado_bairro},
          fiscalizado_lat = ${demandaMapeada.fiscalizado_lat},
          fiscalizado_lng = ${demandaMapeada.fiscalizado_lng},
          data_realizacao = ${demandaMapeada.data_realizacao},
          ativo = ${demandaMapeada.ativo}
        WHERE id = ${data.id}
      `;
            console.log(`✅ UPDATE demanda ID ${data.id}`);
        }

        if (event_type === "DELETE") {
            await dbDestino`
        UPDATE fiscalizacao.demandas SET ativo = false WHERE id = ${data.id}
      `;
            console.log(`🗑️ SOFT DELETE demanda ID ${data.id}`);
        }
    } catch (error) {
        console.error(`❌ Erro ao sincronizar demanda ID ${data.id}:`, error.message);
        // TODO: Implementar Dead Letter Queue ou retry
        throw error;
    }
}

// ============================================================
// BUSCAR REGISTRO COMPLETO NO BANCO DE ORIGEM
// ============================================================

/**
 * Busca o registro completo no banco de origem pelo ID
 * @param {string} table - Nome da tabela no formato "schema.tabela"
 * @param {number} id - ID do registro
 * @returns {Promise<object|null>} Registro completo ou null se não encontrado
 */
async function buscarRegistroOrigem(table, id) {
    try {
        // postgres.js requer usar tagged template literals
        // Usamos sql() para nomes de tabela dinâmicos
        const sql = postgres(CONFIG.origem.url);

        // Executa query usando postgres.js com template literal
        // Nota: não podemos usar ${table} diretamente, precisamos de uma solução
        // Vamos usar a conexão existente com a query correta
        let resultado;

        // Para segurança e compatibilidade, vamos fazer assim:
        if (table === "public.demanda") {
            resultado = await dbOrigem`SELECT * FROM public.demanda WHERE id = ${id}`;
        } else {
            console.error(`❌ Tabela não suportada: ${table}`);
            return null;
        }

        return resultado[0] || null;
    } catch (error) {
        console.error(`❌ Erro ao buscar registro ${table} ID ${id}:`, error.message);
        return null;
    }
}

// ============================================================
// HANDLERS POR TABELA
// ============================================================

const HANDLERS = {
    "public.demanda": sincronizarDemanda,
    // Adicionar mais handlers conforme necessário:
    // "public.pessoa": sincronizarPessoa,
};

// ============================================================
// LISTENER - USANDO LISTEN/NOTIFY DO POSTGRES
// ============================================================

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

        console.log(JSON.stringify(registroCompleto, null, 2))

        // Processa a sincronização com dados completos
        await handler(event_type, registroCompleto);

    } catch (error) {
        console.error("❌ Erro ao processar notificação:", error.message);
        console.error("Payload recebido:", payload);
    }
}

async function iniciarListener() {
    console.log("📡 Iniciando listener para sincronização de demandas...");
    console.log(`🔌 Canal: ${CONFIG.canal}`);

    try {
        // Usa LISTEN/NOTIFY do postgres.js
        await dbOrigem.listen(CONFIG.canal, async (payload) => {
            await processarNotificacao(payload);
        });

        console.log("✅ Listener ativo e aguardando notificações...");

        // Mantém o processo rodando
        await new Promise(() => { }); // Promise que nunca resolve

    } catch (error) {
        console.error("❌ Erro no listener:", error.message);
        console.log(`🔄 Reconectando em ${CONFIG.reconnectDelay / 1000} segundos...`);

        setTimeout(() => {
            iniciarListener();
        }, CONFIG.reconnectDelay);
    }
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown() {
    console.log("\n🛑 Encerrando middleware...");

    try {
        await dbOrigem.end(); // postgres.js usa .end()
        await dbDestino.close(); // Bun SQL usa .close()
        console.log("✅ Conexões fechadas com sucesso");
    } catch (error) {
        console.error("❌ Erro ao fechar conexões:", error.message);
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

iniciarListener();
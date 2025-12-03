// ============================================================
// MAPEAMENTO: fiscaldemanda (origem) -> demandas_fiscais (destino)
// ============================================================

/**
 * Mapeia os campos da tabela `fiscaldemanda` (origem) para `demandas_fiscais` (destino Prisma)
 * 
 * Estrutura origem (fiscaldemanda):
 * - id: BIGINT PRIMARY KEY
 * - ativo: BOOLEAN NOT NULL
 * - data_criacao: TIMESTAMP WITHOUT TIME ZONE NOT NULL
 * - usuarioalteracao: VARCHAR(255)
 * - usuario_id: BIGINT NOT NULL (referencia usuario/fiscal)
 * - demanda_id: BIGINT NOT NULL
 * 
 * Estrutura destino (demandas_fiscais):
 * - demanda_id: Int (PK composta)
 * - fiscal_id: Int (PK composta)
 * - ativo: Boolean
 * - data_criacao: DateTime
 * - usuario_alteracao: String?
 * 
 * @param {object} dataOrigem - Dados da tabela fiscaldemanda (origem)
 * @returns {object} Dados mapeados para tabela demandas_fiscais (destino)
 */
export function mapearFiscalDemanda(dataOrigem) {
    // Converte IDs para número (a origem pode retornar como string)
    const demanda_id = typeof dataOrigem.demanda_id === "string"
        ? parseInt(dataOrigem.demanda_id, 10)
        : dataOrigem.demanda_id;

    // Na origem, usuario_id referencia o fiscal
    const fiscal_id = typeof dataOrigem.usuario_id === "string"
        ? parseInt(dataOrigem.usuario_id, 10)
        : dataOrigem.usuario_id;

    return {
        // Chave primária composta
        demanda_id: demanda_id,
        fiscal_id: fiscal_id,

        // Campos adicionais
        ativo: dataOrigem.ativo ?? true,
        data_criacao: dataOrigem.data_criacao || new Date(),
        usuario_alteracao: dataOrigem.usuarioalteracao || null,

        // Campos extras para debug/logging (não persistidos)
        _origem_id: dataOrigem.id, // ID original da tabela fiscaldemanda
    };
}

/**
 * Valida se os dados mapeados são válidos para inserção
 * 
 * @param {object} dadosMapeados - Dados já mapeados
 * @returns {{ valido: boolean, erros: string[] }}
 */
export function validarFiscalDemanda(dadosMapeados) {
    const erros = [];

    if (!dadosMapeados.demanda_id || dadosMapeados.demanda_id <= 0) {
        erros.push("demanda_id é obrigatório e deve ser maior que 0");
    }

    if (!dadosMapeados.fiscal_id || dadosMapeados.fiscal_id <= 0) {
        erros.push("fiscal_id é obrigatório e deve ser maior que 0");
    }

    return {
        valido: erros.length === 0,
        erros,
    };
}

// ============================================================
// MAPEAMENTO: demanda (origem) -> demandas (destino)
// ============================================================

/**
 * Mapeia os campos da tabela `demanda` (origem) para `demandas` (destino Prisma)
 * Apenas campos que existem no schema do destino são mapeados
 * 
 * @param {object} dataOrigem - Dados da tabela demanda (origem)
 * @returns {object} Dados mapeados para tabela demandas (destino)
 */
export function mapearDemanda(dataOrigem) {
    // Converte ID para número (a origem pode retornar como string)
    const id = typeof dataOrigem.id === "string" ? parseInt(dataOrigem.id, 10) : dataOrigem.id;
    const grupo_ocorrencia_id =
        typeof dataOrigem.grupodemanda_id === "string"
            ? parseInt(dataOrigem.grupodemanda_id, 10)
            : dataOrigem.grupodemanda_id;

    return {
        // Campo ID
        id: id,

        // Situação e motivo
        situacao_id: dataOrigem.situacao,
        motivo_id: null, // Não existe na origem
        fiscal_id: null, // Será preenchido depois se necessário

        // Identificação da demanda
        fiscalizado_demanda: dataOrigem.descricao || dataOrigem.protocolo || `DEMANDA-${dataOrigem.id}`,

        // Dados do fiscalizado (deixar vazio por enquanto)
        fiscalizado_cpf_cnpj: "",
        fiscalizado_nome: "",

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
        grupo_ocorrencia_id: grupo_ocorrencia_id || 1,
    };
}

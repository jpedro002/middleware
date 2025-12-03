// ============================================================
// LOGGING DE ERROS DE CONSTRAINT
// ============================================================

import { writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ERROS_FILE = join(__dirname, "../../erros_sincronizacao.json");

/**
 * Carrega erros do arquivo JSON
 */
export function carregarErros() {
    if (existsSync(ERROS_FILE)) {
        try {
            const conteudo = readFileSync(ERROS_FILE, "utf-8");
            return JSON.parse(conteudo);
        } catch (error) {
            console.error("❌ Erro ao ler arquivo de erros:", error.message);
            return criarEstruturaErrosVazia();
        }
    }
    return criarEstruturaErrosVazia();
}

/**
 * Cria estrutura vazia de erros
 */
function criarEstruturaErrosVazia() {
    return {
        constraint_errors: [],
        valores_faltando: {},
        total: 0,
        ultima_atualizacao: new Date().toISOString(),
    };
}

/**
 * Extrai informações da constraint do erro
 */
export function extrairConstraintInfo(mensagemErro) {
    // Extrai o nome da constraint do erro
    const constraintMatch = mensagemErro.match(/constraint "([^"]+)"/);
    const constraintName = constraintMatch ? constraintMatch[1] : null;

    // Determina qual campo causou o erro baseado no nome da constraint
    let campo = null;
    if (constraintName) {
        // Pattern: tabela_campo_fkey
        const campoMatch = constraintName.match(/demandas_(.+)_fkey/);
        campo = campoMatch ? campoMatch[1] : constraintName;
    }

    return { constraintName, campo };
}

/**
 * Salva um erro no arquivo de log
 */
export function salvarErro(id, table, tipo_erro, mensagem_erro, dadosCompletos = null) {
    const erros = carregarErros();

    // Verificar se já existe este erro exato
    const jaExiste = erros.constraint_errors.some(
        (e) => e.id === id && e.table === table && e.mensagem_erro === mensagem_erro
    );

    if (!jaExiste) {
        const { constraintName, campo } = extrairConstraintInfo(mensagem_erro);

        // Extrair valor do campo que causou o erro
        let valorProblematico = null;
        if (campo && dadosCompletos) {
            valorProblematico = dadosCompletos[campo];
        }

        const erroDetalhado = {
            id,
            table,
            tipo_erro,
            constraint_name: constraintName,
            campo_erro: campo,
            valor_problematico: valorProblematico,
            dados_completos: dadosCompletos,
            mensagem_erro,
            timestamp: new Date().toISOString(),
        };

        erros.constraint_errors.push(erroDetalhado);

        // Agregar valores únicos faltando por tipo de constraint
        if (campo && valorProblematico !== null && valorProblematico !== undefined) {
            if (!erros.valores_faltando[campo]) {
                erros.valores_faltando[campo] = [];
            }
            if (!erros.valores_faltando[campo].includes(valorProblematico)) {
                erros.valores_faltando[campo].push(valorProblematico);
            }
        }

        erros.total = erros.constraint_errors.length;
        erros.ultima_atualizacao = new Date().toISOString();

        writeFileSync(ERROS_FILE, JSON.stringify(erros, null, 2));
        console.log(`📝 Erro registrado: ${constraintName} - Campo: ${campo}, Valor: ${valorProblematico}`);
    }
}

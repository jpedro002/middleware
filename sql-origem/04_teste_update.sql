-- ============================================================
-- TESTE DE UPDATE PARA ID 2475
-- ============================================================

-- Atualize alguns campos da demanda com ID 2475
UPDATE public.demanda
SET
    situacao = 13,
    logradouro = 'AVENIDA PAULISTA ATUALIZADA',
    numero = '500',
    complemento = 'APTO 1000 ATUALIZADO',
    bairro = 'BELA VISTA',
    descricao = 'Descrição atualizada no teste de sincronização',
    latitude = '-3.72000',
    longitude = '-38.54500',
    ativo = true,
    usuarioalteracao = 'ADMIN-UPDATE',
    datafiscalizacao = NOW()
WHERE id = 2475;

-- Verifique se foi atualizado
SELECT 
    id,
    protocolo,
    situacao,
    logradouro,
    numero,
    complemento,
    bairro,
    descricao,
    usuarioalteracao
FROM public.demanda
WHERE id = 2475;

-- O middleware deve ter recebido uma notificação de UPDATE e sincronizado automaticamente

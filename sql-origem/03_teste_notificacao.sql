-- ============================================================
-- SCRIPT DE TESTE PARA VERIFICAR A NOTIFICAÇÃO
-- Execute este script para testar se o sistema está funcionando
-- ============================================================

-- 1. Abra uma sessão e execute o LISTEN
-- LISTEN sync_channel;

-- 2. Em outra sessão, execute um INSERT de teste:
INSERT INTO public.demanda (
    id,
    ativo,
    data_criacao,
    datahoraaberturademanda,
    datahoraocorrencia,
    enderecoproximidade,
    logradouro,
    grupodemanda_id,
    situacao,
    protocolo
) VALUES (
    nextval('hibernate_sequence'),
    true,
    NOW(),
    NOW(),
    NOW(),
    false,
    'RUA TESTE SINCRONIZAÇÃO',
    1, -- Ajuste para um grupodemanda_id válido
    1,
    'TEST-' || extract(epoch from now())::text
);

-- 3. Você deverá ver a notificação na sessão com LISTEN
-- Formato do payload: { "id": 123, "table": "public.demanda", "event_type": "INSERT" }

-- ============================================================
-- TESTE DE UPDATE
-- ============================================================
-- UPDATE public.demanda 
-- SET logradouro = 'RUA TESTE ATUALIZADA', situacao = 2
-- WHERE protocolo LIKE 'TEST-%';
-- Payload esperado: { "id": 123, "table": "public.demanda", "event_type": "UPDATE" }

-- ============================================================
-- LIMPEZA (opcional)
-- ============================================================
-- DELETE FROM public.demanda WHERE protocolo LIKE 'TEST-%';
-- Payload esperado: { "id": 123, "table": "public.demanda", "event_type": "DELETE" }

-- ============================================================
-- TRIGGERS PARA SINCRONIZAÇÃO
-- Usa a função genérica notificar_sync()
-- ============================================================

-- ============================================================
-- DEMANDA
-- ============================================================
DROP TRIGGER IF EXISTS trigger_sync_demanda ON public.demanda;

CREATE TRIGGER trigger_sync_demanda
AFTER INSERT OR UPDATE OR DELETE ON public.demanda
FOR EACH ROW 
EXECUTE FUNCTION public.notificar_sync();

COMMENT ON TRIGGER trigger_sync_demanda ON public.demanda IS 
'Sincroniza tabela demanda com Fiscalize. Payload: { id, table, event_type }';

-- ============================================================
-- PESSOA (exemplo para adicionar mais tabelas)
-- ============================================================
-- DROP TRIGGER IF EXISTS trigger_sync_pessoa ON public.pessoa;
-- 
-- CREATE TRIGGER trigger_sync_pessoa
-- AFTER INSERT OR UPDATE OR DELETE ON public.pessoa
-- FOR EACH ROW 
-- EXECUTE FUNCTION public.notificar_sync();

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- Listar todos os triggers de sincronização:
-- SELECT trigger_name, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_name LIKE 'trigger_sync_%';

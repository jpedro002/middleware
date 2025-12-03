DROP TRIGGER IF EXISTS trigger_sync_demanda ON public.demanda;

CREATE TRIGGER trigger_sync_demanda
AFTER INSERT OR UPDATE OR DELETE ON public.demanda
FOR EACH ROW 
EXECUTE FUNCTION public.notificar_sync();

COMMENT ON TRIGGER trigger_sync_demanda ON public.demanda IS 
'Sincroniza tabela demanda com Fiscalize. Payload: { id, table, event_type }';

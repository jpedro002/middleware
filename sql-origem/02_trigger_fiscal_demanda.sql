DROP TRIGGER IF EXISTS trigger_sync_fiscaldemanda ON public.fiscaldemanda;

CREATE TRIGGER trigger_sync_fiscaldemanda
AFTER INSERT OR UPDATE OR DELETE ON public.fiscaldemanda
FOR EACH ROW 
EXECUTE FUNCTION public.notificar_sync();

COMMENT ON TRIGGER trigger_sync_fiscaldemanda ON public.fiscaldemanda IS 
'Sincroniza tabela fiscaldemanda com Fiscalize. Payload: { id, table, event_type }';
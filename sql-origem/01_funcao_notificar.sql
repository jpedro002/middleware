CREATE OR REPLACE FUNCTION public.notificar_sync() 
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
    entity_id BIGINT;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        entity_id = OLD.id;
    ELSE
        entity_id = NEW.id;
    END IF;

    payload = json_build_object(
        'id', entity_id,
        'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
        'event_type', TG_OP
    );
    
    PERFORM pg_notify('sync_channel', payload::text);
    
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.notificar_sync() IS 
'Função trigger genérica para sincronização.
Envia payload minimalista: { id, table: "schema.tabela", event_type: "INSERT|UPDATE|DELETE" }
O middleware busca o registro completo no banco de origem.
Canal: sync_channel';

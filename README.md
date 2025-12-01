# Middleware de Sincronização - Fiscalize

Middleware para sincronização em tempo real entre o banco de dados legado e o novo sistema Fiscalize.

## 🚀 Tecnologias

- **Bun** - Runtime JavaScript com driver PostgreSQL nativo
- **PostgreSQL LISTEN/NOTIFY** - Para sincronização em tempo real

## 📋 Pré-requisitos

- [Bun](https://bun.sh) >= 1.0
- PostgreSQL >= 12 (origem e destino)

## ⚙️ Configuração

### 1. Variáveis de Ambiente

```bash
cp .env.example .env
```

Edite o `.env` com as URLs dos bancos:

```env
DATABASE_ORIGEM_URL=postgres://user:pass@host:5432/db_legado
DATABASE_DESTINO_URL=postgres://user:pass@host:5432/db_fiscalize
```

### 2. Configurar Trigger no Banco de Origem

Execute os scripts SQL na pasta `sql-origem/` no banco de dados legado:

```bash
# 1. Criar função de notificação
psql -h host -U user -d db_legado -f sql-origem/01_funcao_notificar.sql

# 2. Criar trigger na tabela demanda
psql -h host -U user -d db_legado -f sql-origem/02_trigger_demanda.sql
```

### 3. Testar a Notificação

```bash
psql -h host -U user -d db_legado -f sql-origem/03_teste_notificacao.sql
```

## 🏃 Executando

```bash
# Instalar dependências
bun install

# Executar em desenvolvimento
bun run index.js

# Ou com watch mode
bun --watch run index.js
```

## 📊 Mapeamento de Campos

| Campo Origem (demanda) | Campo Destino (demandas) |
|------------------------|--------------------------|
| id | id |
| situacao | situacao_id |
| protocolo | fiscalizado_demanda |
| logradouro | fiscalizado_logradouro |
| numero | fiscalizado_numero |
| complemento | fiscalizado_complemento |
| bairro | fiscalizado_bairro |
| latitude | fiscalizado_lat |
| longitude | fiscalizado_lng |
| data_criacao | data_criacao |
| datafiscalizacao/dataexecucao | data_realizacao |
| ativo | ativo |
| grupodemanda_id | grupo_ocorrencia_id |
| os_direta | classificacao (direta/ordinaria) |

## 🔄 Fluxo de Sincronização

```
┌─────────────────┐     NOTIFY      ┌─────────────────┐     INSERT/UPDATE     ┌─────────────────┐
│  Banco Origem   │ ──────────────► │   Middleware    │ ────────────────────► │  Banco Destino  │
│   (Legado)      │  sync_demandas  │     (Bun)       │       (Prisma)        │   (Fiscalize)   │
└─────────────────┘                 └─────────────────┘                       └─────────────────┘
       │                                    │
       │ INSERT/UPDATE/DELETE               │ Log de operações
       │ na tabela demanda                  │
       ▼                                    ▼
   Trigger dispara              Console mostra status
```

## 🛠️ Estrutura de Arquivos

```
middleware/
├── index.js              # Código principal do middleware
├── .env                  # Variáveis de ambiente (não commitado)
├── .env.example          # Exemplo de configuração
├── package.json
└── sql-origem/
    ├── 01_funcao_notificar.sql   # Função de notificação
    ├── 02_trigger_demanda.sql    # Trigger na tabela demanda
    ├── 03_teste_notificacao.sql  # Script de teste
    └── DDL demanda.txt           # DDL da tabela origem (referência)
```

## 📝 TODO

- [ ] Implementar Dead Letter Queue para mensagens com falha
- [ ] Adicionar sincronização de outras tabelas (pessoa, fiscalizado, etc.)
- [ ] Implementar retry com backoff exponencial
- [ ] Adicionar métricas e monitoramento
- [ ] Testes automatizados
# middleware

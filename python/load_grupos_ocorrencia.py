import re
import polars as pl
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_batch

# Leitura do arquivo SQL
with open('grupodemanda_202512021151.sql', 'r', encoding='utf-8') as f:
    sql_content = f.read()

# Regex para extrair os valores do INSERT
# Extrai valores dentro dos parênteses: (valor1, valor2, valor3, ...)
pattern = r'\(([^)]+)\)'
matches = re.findall(pattern, sql_content)

# Filtrar apenas as linhas de dados (ignorar a primeira linha que é o cabeçalho)
data_lines = []
for i, match in enumerate(matches):
    # A primeira ocorrência em cada INSERT é o cabeçalho, pular
    if i > 0:  # Ignora o primeiro match de cada INSERT (que é o cabeçalho)
        parts = [p.strip() for p in match.split(',')]
        if len(parts) == 9:  # Verificar se tem 9 colunas
            data_lines.append(parts)

# Processar cada linha de dados
processed_data = []
for line in data_lines:
    id_val = int(line[0])
    ativo = line[1].lower() == 'true'
    data_criacao = line[2].strip("'")
    descricao = line[3].strip("'")
    nome = line[4].strip("'")
    fundo_municipal_id = 0 if line[7] == 'NULL' else int(line[7])
    
    processed_data.append({
        'id': id_val,
        'nome': nome,
        'descricao': descricao,
        'fundo_municipal_id': fundo_municipal_id,
        'afinidades': None,
        'ativo': ativo,
        'data_criacao': data_criacao,
    })

# Criar DataFrame com Polars
df = pl.DataFrame(processed_data)

# Converter data_criacao para datetime
df = df.with_columns(
    pl.col('data_criacao').str.to_datetime('%Y-%m-%d %H:%M:%S.%f').alias('data_criacao')
)

print(f"Total de registros a importar: {len(df)}")
print("\nPrimeiros 5 registros:")
print(df.head(5))

# Conectar ao PostgreSQL e fazer o insert
connection_string = "postgresql://postgres:postgres@localhost:5432/agefis"

try:
    conn = psycopg2.connect(
        host='localhost',
        database='agefis',
        user='postgres',
        password='postgres',
        port=5432
    )
    
    cursor = conn.cursor()
    
    # Preparar dados para insert
    insert_query = """
        INSERT INTO "fiscalizacao"."grupos_ocorrencia" 
        (id, nome, descricao, fundo_municipal_id, afinidades, ativo, data_criacao)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
    """
    
    # Converter DataFrame para lista de tuplas
    data_to_insert = [
        (
            row['id'],
            row['nome'],
            row['descricao'],
            row['fundo_municipal_id'],
            row['afinidades'],
            row['ativo'],
            row['data_criacao']
        )
        for row in df.to_dicts()
    ]
    
    # Executar insert em batch
    execute_batch(cursor, insert_query, data_to_insert, page_size=100)
    
    conn.commit()
    print(f"\n✅ {len(data_to_insert)} registros inseridos com sucesso!")
    
except Exception as e:
    print(f"❌ Erro ao inserir dados: {e}")
    conn.rollback()
    
finally:
    cursor.close()
    conn.close()

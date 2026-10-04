"""Roda as consultas SQL no banco coletado e gera o JSON que o painel lê."""

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from coletar import BANCO

SAIDA = BANCO.parent / "dados.json"

RESUMO = """
SELECT
  (SELECT COUNT(*) FROM vagas WHERE fechada IS NULL) AS abertas,
  (SELECT COUNT(*) FROM vagas WHERE criada >= :d30) AS novas30,
  (SELECT COUNT(*) FROM vagas WHERE criada >= :d60 AND criada < :d30) AS anteriores30,
  (SELECT ROUND(100.0 * SUM(modelo = 'Remoto') / COUNT(modelo)) FROM vagas WHERE criada >= :d90) AS remoto
"""

# Mediana de dias até a vaga ser encerrada: SQLite não tem MEDIAN, então numera as linhas.
MEDIANA_DIAS = """
WITH duracao AS (
  SELECT julianday(fechada) - julianday(criada) AS dias
  FROM vagas WHERE fechada IS NOT NULL AND criada >= :d90
), ordenada AS (
  SELECT dias, ROW_NUMBER() OVER (ORDER BY dias) AS n, COUNT(*) OVER () AS total FROM duracao
)
SELECT ROUND(AVG(dias)) FROM ordenada WHERE n IN ((total + 1) / 2, (total + 2) / 2)
"""

POR_MES = """
SELECT strftime('%Y-%m', criada) AS mes, comunidade, COUNT(*) AS total
FROM vagas GROUP BY mes, comunidade ORDER BY mes
"""

TECNOLOGIAS = """
SELECT t.nome, COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM vagas WHERE criada >= :d90)) AS pct
FROM tecnologias t JOIN vagas v ON v.id = t.vaga_id
WHERE v.criada >= :d90
GROUP BY t.nome ORDER BY total DESC LIMIT 12
"""

# Distribuição de uma coluna nos últimos 90 dias, com as vagas sem a informação à parte.
DISTRIBUICAO = """
SELECT COALESCE({coluna}, 'Não informado') AS valor, COUNT(*) AS total
FROM vagas WHERE criada >= :d90 GROUP BY valor ORDER BY valor = 'Não informado', total DESC
"""

# Fatia de vagas de entrada (estágio e júnior) entre as que informam o nível, mês a mês.
ENTRADA_POR_MES = """
SELECT strftime('%Y-%m', criada) AS mes,
       ROUND(100.0 * SUM(nivel IN ('Estágio', 'Júnior')) / COUNT(nivel), 1) AS pct
FROM vagas WHERE nivel IS NOT NULL GROUP BY mes ORDER BY mes
"""

VAGAS_ABERTAS = """
SELECT v.titulo, v.url, v.comunidade, v.criada, v.nivel, v.modelo, v.regime,
       (SELECT GROUP_CONCAT(nome, ', ') FROM tecnologias WHERE vaga_id = v.id) AS tecnologias
FROM vagas v
WHERE v.fechada IS NULL AND v.criada >= :d60
ORDER BY v.criada DESC
"""


def exportar(banco: Path = BANCO, agora: datetime | None = None) -> dict:
    agora = agora or datetime.now(timezone.utc)
    datas = {f"d{n}": (agora - timedelta(days=n)).strftime("%Y-%m-%dT%H:%M:%SZ") for n in (30, 60, 90)}
    con = sqlite3.connect(banco)
    con.row_factory = sqlite3.Row
    linhas = lambda sql: [dict(r) for r in con.execute(sql, datas)]  # noqa: E731
    dados = {
        "atualizado": agora.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "resumo": {**linhas(RESUMO)[0], "mediana_dias": con.execute(MEDIANA_DIAS, datas).fetchone()[0]},
        "por_mes": linhas(POR_MES),
        "tecnologias": linhas(TECNOLOGIAS),
        "niveis": linhas(DISTRIBUICAO.format(coluna="nivel")),
        "modelos": linhas(DISTRIBUICAO.format(coluna="modelo")),
        "regimes": linhas(DISTRIBUICAO.format(coluna="regime")),
        "entrada_por_mes": linhas(ENTRADA_POR_MES),
        "vagas": linhas(VAGAS_ABERTAS),
    }
    con.close()
    return dados


if __name__ == "__main__":
    dados = exportar()
    SAIDA.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(dados['vagas'])} vagas abertas recentes, {sum(m['total'] for m in dados['por_mes'])} no total.")

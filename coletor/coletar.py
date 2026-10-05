"""Coleta as vagas do mês atual e dos 12 anteriores nos repositórios das comunidades e grava em SQLite.

As vagas são issues do GitHub, lidas pela API oficial. Como a API guarda todo o
histórico, o banco é recriado do zero a cada execução e não precisa ser versionado.
Defina GITHUB_TOKEN para um limite maior de requisições (no Actions ele já existe).
"""

import json
import os
import sqlite3
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from classificar import classificar, eh_vaga, salario  # noqa: E402

COMUNIDADES = {
    "backend-br/vagas": "Back-end",
    "frontendbr/vagas": "Front-end",
    "react-brasil/vagas": "React",
    "dotnetdevbr/vagas": ".NET",
    "soujava/vagas-java": "Java",
    "phpdevbr/vagas": "PHP",
    "qa-brasil/vagas": "QA",
    "datascience-br/vagas": "Dados",
    "androiddevbr/vagas": "Android",
    "cocoaheadsbrasil/vagas": "iOS",
}
MESES = 12
BANCO = Path(__file__).parent.parent / "public" / "vagas.db"
ESQUEMA = """
CREATE TABLE vagas (
  id INTEGER PRIMARY KEY,
  comunidade TEXT NOT NULL,
  titulo TEXT NOT NULL,
  url TEXT NOT NULL,
  criada TEXT NOT NULL,      -- ISO 8601, UTC
  fechada TEXT,              -- quando a vaga foi encerrada (issue fechada)
  nivel TEXT,
  modelo TEXT,
  regime TEXT,
  moeda TEXT,                -- BRL ou USD, quando a vaga informa o salário
  salario_min REAL,          -- mensal
  salario_max REAL
);
CREATE TABLE tecnologias (
  vaga_id INTEGER NOT NULL REFERENCES vagas(id),
  nome TEXT NOT NULL,
  PRIMARY KEY (vaga_id, nome)
);
CREATE INDEX vagas_criada ON vagas(criada);
"""


def buscar(url: str):
    cabecalhos = {"Accept": "application/vnd.github+json", "User-Agent": "rastreador-vagas"}
    if token := os.environ.get("GITHUB_TOKEN"):
        cabecalhos["Authorization"] = f"Bearer {token}"
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=cabecalhos), timeout=30) as r:
                return json.load(r)
        except OSError:
            if tentativa == 2:
                raise
            time.sleep(5)


def issues(repo: str, desde: str):
    """Issues da mais nova para a mais antiga, até passar da data de corte."""
    pagina = 1
    while True:
        lote = buscar(f"https://api.github.com/repos/{repo}/issues"
                      f"?state=all&sort=created&direction=desc&per_page=100&page={pagina}")
        for issue in lote:
            if issue["created_at"] < desde:
                return
            if "pull_request" not in issue:
                yield issue
        if len(lote) < 100:
            return
        pagina += 1


def coletar(banco: Path = BANCO, agora: datetime | None = None):
    agora = agora or datetime.now(timezone.utc)
    ano, mes = divmod(agora.year * 12 + agora.month - 1 - MESES, 12)
    desde = f"{ano:04d}-{mes + 1:02d}-01T00:00:00Z"  # meses inteiros, para o gráfico não começar pela metade
    banco.parent.mkdir(exist_ok=True)
    banco.unlink(missing_ok=True)
    con = sqlite3.connect(banco)
    con.executescript(ESQUEMA)
    for repo, comunidade in COMUNIDADES.items():
        total = 0
        for issue in issues(repo, desde):
            etiquetas = [e["name"] for e in issue["labels"]]
            if not eh_vaga(issue["title"], etiquetas):
                continue
            c = classificar(issue["title"], etiquetas)
            s = salario([*etiquetas, issue["title"], issue["body"] or ""]) or {}
            con.execute("INSERT INTO vagas VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (
                issue["id"], comunidade, issue["title"].strip(), issue["html_url"],
                issue["created_at"], issue["closed_at"], c["nivel"], c["modelo"], c["regime"],
                s.get("moeda"), s.get("min"), s.get("max")))
            con.executemany("INSERT INTO tecnologias VALUES (?, ?)", [(issue["id"], t) for t in c["tecnologias"]])
            total += 1
        print(f"{repo}: {total} vagas")
    con.commit()
    con.execute("VACUUM")
    con.close()


if __name__ == "__main__":
    coletar()

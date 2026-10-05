"""Exporta as vagas do banco para o JSON que o painel lê.

O painel cruza os filtros no navegador (como no Power BI), então recebe as vagas
uma a uma, já com as tecnologias de cada uma juntadas numa lista.
"""

import json
import sqlite3
from pathlib import Path

from coletar import BANCO

SAIDA = BANCO.parent / "dados.json"

VAGAS = """
SELECT v.titulo, v.url, v.comunidade, v.criada, v.fechada, v.nivel, v.modelo, v.regime,
       GROUP_CONCAT(t.nome, '|') AS tecnologias
FROM vagas v LEFT JOIN tecnologias t ON t.vaga_id = v.id
GROUP BY v.id
ORDER BY v.criada DESC
"""


def exportar(banco: Path = BANCO) -> list[dict]:
    con = sqlite3.connect(banco)
    con.row_factory = sqlite3.Row
    vagas = [{**dict(r), "tecnologias": sorted(r["tecnologias"].split("|")) if r["tecnologias"] else []}
             for r in con.execute(VAGAS)]
    con.close()
    return vagas


if __name__ == "__main__":
    from datetime import datetime, timezone

    vagas = exportar()
    atualizado = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    SAIDA.write_text(json.dumps({"atualizado": atualizado, "vagas": vagas}, ensure_ascii=False, separators=(",", ":")),
                     encoding="utf-8")
    print(f"{len(vagas)} vagas exportadas.")

import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from classificar import classificar, eh_vaga
from coletar import ESQUEMA
from exportar import exportar


class Classificar(unittest.TestCase):
    def test_usa_as_etiquetas_primeiro(self):
        c = classificar("Dev Back-end Pleno", ["Sênior", "Remoto", "PJ", "Python", "AWS"])
        self.assertEqual((c["nivel"], c["modelo"], c["regime"]), ("Sênior", "Remoto", "PJ"))
        self.assertEqual(c["tecnologias"], ["AWS", "Python"])

    def test_cai_para_o_titulo_sem_etiquetas(self):
        c = classificar("[Híbrido/Curitiba] Desenvolvedor(a) .NET Júnior - CLT", [])
        self.assertEqual((c["nivel"], c["modelo"], c["regime"]), ("Júnior", "Híbrido", "CLT"))
        self.assertEqual(c["tecnologias"], [".NET"])

    def test_nao_confunde_palavras_parecidas(self):
        c = classificar("Analista JavaScript em Goiás", [])
        self.assertEqual(c["tecnologias"], ["JavaScript"])  # nem Java nem Go
        self.assertIsNone(c["nivel"])

    def test_descarta_o_que_nao_e_vaga(self):
        self.assertFalse(eh_vaga("docs: add openings.dev community page", []))
        self.assertFalse(eh_vaga("Bump actions/checkout", ["dependencies"]))
        self.assertTrue(eh_vaga("[Remoto] QA Pleno", ["Remoto"]))


class Exportar(unittest.TestCase):
    def test_consultas(self):
        with tempfile.TemporaryDirectory() as pasta:
            banco = Path(pasta) / "v.db"
            con = sqlite3.connect(banco)
            con.executescript(ESQUEMA)
            con.executemany("INSERT INTO vagas VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
                (1, "Back-end", "A", "u1", "2026-10-01T10:00:00Z", None, "Júnior", "Remoto", "CLT"),
                (2, "Back-end", "B", "u2", "2026-09-20T10:00:00Z", "2026-09-30T10:00:00Z", "Sênior", "Remoto", "PJ"),
                (3, "Front-end", "C", "u3", "2026-08-20T10:00:00Z", "2026-08-24T10:00:00Z", None, "Presencial", None),
                (4, "Front-end", "D", "u4", "2025-12-01T10:00:00Z", None, "Pleno", None, "CLT"),
            ])
            con.executemany("INSERT INTO tecnologias VALUES (?, ?)", [(1, "Python"), (2, "Python"), (2, "SQL")])
            con.commit()
            con.close()
            d = exportar(banco, datetime(2026, 10, 4, 12, tzinfo=timezone.utc))

        self.assertEqual(d["resumo"], {"abertas": 2, "novas30": 2, "anteriores30": 1, "remoto": 67, "mediana_dias": 7})
        self.assertEqual(d["tecnologias"][0], {"nome": "Python", "total": 2, "pct": 67})
        self.assertEqual(d["niveis"][-1], {"valor": "Não informado", "total": 1})
        self.assertEqual([v["titulo"] for v in d["vagas"]], ["A"])
        self.assertEqual(d["vagas"][0]["tecnologias"], "Python")
        self.assertEqual(d["entrada_por_mes"], [
            {"mes": "2025-12", "pct": 0.0}, {"mes": "2026-09", "pct": 0.0}, {"mes": "2026-10", "pct": 100.0}])


if __name__ == "__main__":
    unittest.main()

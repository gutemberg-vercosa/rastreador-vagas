import sqlite3
import tempfile
import unittest
from pathlib import Path

from classificar import classificar, eh_vaga, salario
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


class Salario(unittest.TestCase):
    def test_le_a_faixa_onde_a_vaga_fala_de_salario(self):
        self.assertEqual(salario(["Requisitos:\n- 5 anos", "Faixa salarial: R$ 12.000 a 22.000"]),
                         {"moeda": "BRL", "min": 12000, "max": 22000})
        self.assertEqual(salario(["💰 10k-15k"]), {"moeda": "BRL", "min": 10000, "max": 15000})
        self.assertEqual(salario(["Remuneração:\nR$ 6.000,00 + VR"]), {"moeda": "BRL", "min": 6000, "max": 6000})
        self.assertEqual(salario(["REMUNERAÇÃO: Até USD 5k"]), {"moeda": "USD", "min": 5000, "max": 5000})

    def test_ignora_numeros_que_nao_sao_salario(self):
        self.assertIsNone(salario(["Salário compatível com o mercado, 40 horas semanais"]))
        self.assertIsNone(salario(["Experiência de 3 anos com R$ em sistemas financeiros"]))
        self.assertIsNone(salario(["Salário: R$ 120.000 por ano"]))


class Exportar(unittest.TestCase):
    def test_junta_as_tecnologias_de_cada_vaga(self):
        with tempfile.TemporaryDirectory() as pasta:
            banco = Path(pasta) / "v.db"
            con = sqlite3.connect(banco)
            con.executescript(ESQUEMA)
            con.executemany("INSERT INTO vagas VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
                (1, "Back-end", "A", "u1", "2026-10-01T10:00:00Z", None, "Júnior", "Remoto", "CLT", "BRL", 3000, 4000),
                (2, "Front-end", "B", "u2", "2026-09-20T10:00:00Z", "2026-09-30T10:00:00Z", None, None, None, None, None, None),
            ])
            con.executemany("INSERT INTO tecnologias VALUES (?, ?)", [(1, "SQL"), (1, "Python")])
            con.commit()
            con.close()
            vagas = exportar(banco)

        self.assertEqual([v["titulo"] for v in vagas], ["A", "B"])  # mais nova primeiro
        self.assertEqual(vagas[0]["tecnologias"], ["Python", "SQL"])
        self.assertEqual(vagas[1], {"titulo": "B", "url": "u2", "comunidade": "Front-end", "criada": "2026-09-20T10:00:00Z",
                                    "fechada": "2026-09-30T10:00:00Z", "nivel": None, "modelo": None, "regime": None,
                                    "moeda": None, "salario_min": None, "salario_max": None, "tecnologias": []})
        self.assertEqual((vagas[0]["moeda"], vagas[0]["salario_min"], vagas[0]["salario_max"]), ("BRL", 3000, 4000))


if __name__ == "__main__":
    unittest.main()

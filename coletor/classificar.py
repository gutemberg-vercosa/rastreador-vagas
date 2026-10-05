"""Extrai nível, regime, modelo de trabalho e tecnologias de uma vaga.

As comunidades marcam as vagas com etiquetas (labels), mas nem toda vaga vem
etiquetada. Quando falta a etiqueta, o título é usado como segunda fonte.
"""

import re
import unicodedata


def normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFD", texto).encode("ascii", "ignore").decode()
    return sem_acento.lower()


# Cada categoria: valor final -> padrões (já sem acento e em minúsculas).
NIVEIS = {
    "Estágio": r"estagi\w*|intern(ship)?",
    "Júnior": r"junior|jr",
    "Pleno": r"pleno|mid(-level)?",
    "Sênior": r"senior|sr",
    "Especialista": r"especialista|staff|principal|tech lead",
}
MODELOS = {
    "Remoto": r"remot[oa]|remote|home office|anywhere",
    "Híbrido": r"hibrid[oa]|hybrid",
    "Presencial": r"presencial|escritorio|on-?site|alocado",
}
REGIMES = {
    "CLT": r"clt",
    "PJ": r"pj|contrato",
    "Freela": r"freela\w*",
    "Estágio": r"estagi\w*",
    "Cooperado": r"cooperado",
}
TECNOLOGIAS = {
    "Python": r"python|django|flask|fastapi",
    "Java": r"java(?!script)|spring",
    "JavaScript": r"javascript|js",
    "TypeScript": r"typescript|ts",
    "Node.js": r"node(\.?js)?|nestjs",
    "React": r"react(\.?js)?|next\.?js",
    "Angular": r"angular",
    "Vue": r"vue(\.?js)?|nuxt",
    ".NET": r"\.net|c#|asp(\.net)?|dotnet",
    "PHP": r"php|laravel|symfony",
    "Go": r"go|golang",
    "Ruby": r"ruby|rails",
    "Kotlin": r"kotlin",
    "Swift": r"swift|ios",
    "Flutter": r"flutter|dart",
    "SQL": r"sql|postgres(ql)?|mysql|sql server|oracle",
    "NoSQL": r"mongo(db)?|redis|dynamodb|nosql",
    "AWS": r"aws",
    "Azure": r"azure",
    "GCP": r"gcp|google cloud",
    "Docker": r"docker|kubernetes|k8s",
    "Dados e IA": r"dados|data|machine learning|ml|ia|ai|llm|spark|power bi",
}


def _casa(padrao: str, texto: str) -> bool:
    # Fronteiras próprias porque "\b" não funciona bem com ".NET" ou "C#".
    return re.search(rf"(?<![\w.#])(?:{padrao})(?![\w#])", texto) is not None


def _primeira(categorias: dict[str, str], etiquetas: list[str], titulo: str) -> str | None:
    for fonte in (etiquetas, [titulo]):
        for valor, padrao in categorias.items():
            if any(_casa(padrao, t) for t in fonte):
                return valor
    return None


def classificar(titulo: str, etiquetas: list[str]) -> dict:
    titulo_n = normalizar(titulo)
    etiquetas_n = [normalizar(e) for e in etiquetas]
    textos = [*etiquetas_n, titulo_n]
    return {
        "nivel": _primeira(NIVEIS, etiquetas_n, titulo_n),
        "modelo": _primeira(MODELOS, etiquetas_n, titulo_n),
        "regime": _primeira(REGIMES, etiquetas_n, titulo_n),
        "tecnologias": sorted(t for t, p in TECNOLOGIAS.items() if any(_casa(p, x) for x in textos)),
    }


def eh_vaga(titulo: str, etiquetas: list[str]) -> bool:
    """Descarta avisos e issues de manutenção que as comunidades abrem no mesmo repositório."""
    t = normalizar(titulo)
    if re.match(r"(docs|chore|fix|feat|ci|build)(\(.*\))?:|question|duvida|pergunta", t):
        return False
    return not any(normalizar(e) in {"dependencies", "github_actions", "github-actions"} or "bot" in normalizar(e) for e in etiquetas)


# Salário: só onde a vaga fala de salário ("Faixa salarial", "Remuneração", etiqueta 💰),
# para não confundir com outros números (carga horária, anos de experiência).
CONTEXTO_SALARIO = re.compile(r"sal[aá]ri|remunera|💰|budget|compensation|pretens", re.I)
NUMERO = r"(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,(\d{1,2}))?\s*(k|mil)?\b"
MOEDA = r"(?:r\$|us\$|usd|\$)\s*"
VALOR = re.compile(rf"{MOEDA}{NUMERO}|{NUMERO.replace('(k|mil)?', '(k|mil)')}", re.I)
SEGUNDO = re.compile(rf"\s*(?:a|-|–|até|to)\s*(?:{MOEDA})?{NUMERO}", re.I)


def _numero(inteiro: str, decimal: str | None, mil: str | None) -> float:
    valor = float(re.sub(r"[.\s]", "", inteiro) + (f".{decimal}" if decimal else ""))
    return valor * 1000 if mil else valor


def salario(textos: list[str]) -> dict | None:
    """Faixa mensal informada na vaga: {"moeda", "min", "max"}, ou None se não houver."""
    for texto in textos:
        linhas = (texto or "").splitlines()
        for i, linha in enumerate(linhas):
            if not CONTEXTO_SALARIO.search(linha):
                continue
            trecho = " ".join(linhas[i:i + 2])[:200]  # o valor às vezes vem na linha de baixo
            m = VALOR.search(trecho)
            if not m:
                continue
            g = m.groups()
            valores = [_numero(*g[:3]) if g[0] else _numero(*g[3:])]
            if segundo := SEGUNDO.match(trecho, m.end()):
                valores.append(_numero(*segundo.groups()))
            valores = [v for v in valores if 500 <= v <= 100_000]  # descarta hora e valor anual
            if valores:
                moeda = "USD" if re.search(r"us\$|usd|d[oó]lar", trecho, re.I) else "BRL"
                return {"moeda": moeda, "min": min(valores), "max": max(valores)}
    return None

// Filtros cruzados e indicadores, calculados no navegador a partir da lista de vagas.

export interface Vaga {
  titulo: string; url: string; comunidade: string;
  criada: string; fechada: string | null;
  nivel: string | null; modelo: string | null; regime: string | null;
  tecnologias: string[];
}

export type Dimensao = 'comunidade' | 'mes' | 'tecnologia' | 'nivel' | 'modelo' | 'regime';
export type Filtros = Partial<Record<Dimensao, string>> & { busca?: string };

export const NAO_INFORMADO = 'Não informado';
const DIA = 864e5;

export const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Valores de uma vaga numa dimensão (uma vaga cita várias tecnologias). */
export function valores(v: Vaga, d: Dimensao): string[] {
  if (d === 'mes') return [v.criada.slice(0, 7)];
  if (d === 'tecnologia') return v.tecnologias;
  return [v[d] ?? NAO_INFORMADO];
}

/**
 * Aplica os filtros. Um gráfico ignora as próprias dimensões, como no Power BI:
 * o item escolhido fica destacado e os outros continuam visíveis para comparação.
 */
export function filtrar(vagas: Vaga[], f: Filtros, ignorar: Dimensao[] = []) {
  const termo = semAcento(f.busca?.trim() ?? '');
  const ativos = (Object.keys(f) as (Dimensao | 'busca')[])
    .filter((d): d is Dimensao => d !== 'busca' && !!f[d] && !ignorar.includes(d));
  return vagas.filter((v) =>
    ativos.every((d) => valores(v, d).includes(f[d]!))
    && (!termo || semAcento(`${v.titulo} ${v.tecnologias.join(' ')}`).includes(termo)));
}

/** Contagem por valor, do maior para o menor, com "Não informado" por último. */
export function contar(vagas: Vaga[], d: Dimensao): [string, number][] {
  const totais = new Map<string, number>();
  for (const v of vagas) for (const x of valores(v, d)) totais.set(x, (totais.get(x) ?? 0) + 1);
  return [...totais].sort((a, b) => +(a[0] === NAO_INFORMADO) - +(b[0] === NAO_INFORMADO) || b[1] - a[1]);
}

/** Os 13 meses "AAAA-MM" do painel, terminando no mês da atualização. */
export function meses(agora: Date) {
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 12 + i, 1));
    return d.toISOString().slice(0, 7);
  });
}

export function mediana(numeros: number[]) {
  if (!numeros.length) return null;
  const o = [...numeros].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export function resumo(vagas: Vaga[], agora: Date) {
  const desde = (dias: number) => new Date(agora.getTime() - dias * DIA).toISOString();
  const informadas = vagas.filter((v) => v.modelo);
  return {
    abertas: vagas.filter((v) => !v.fechada).length,
    novas30: vagas.filter((v) => v.criada >= desde(30)).length,
    anteriores30: vagas.filter((v) => v.criada >= desde(60) && v.criada < desde(30)).length,
    remoto: informadas.length ? Math.round((100 * informadas.filter((v) => v.modelo === 'Remoto').length) / informadas.length) : null,
    medianaDias: mediana(vagas.filter((v) => v.fechada).map((v) => (Date.parse(v.fechada!) - Date.parse(v.criada)) / DIA)),
  };
}

/** Fatia de vagas de estágio e júnior por mês, entre as que informam o nível. */
export function entradaPorMes(vagas: Vaga[], lista: string[]) {
  return lista.map((mes) => {
    const doMes = vagas.filter((v) => v.nivel && v.criada.startsWith(mes));
    const entrada = doMes.filter((v) => v.nivel === 'Estágio' || v.nivel === 'Júnior').length;
    return { mes, pct: doMes.length ? (100 * entrada) / doMes.length : null };
  });
}

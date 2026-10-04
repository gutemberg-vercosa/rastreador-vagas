interface Contagem { valor: string; total: number }
interface Vaga {
  titulo: string; url: string; comunidade: string; criada: string;
  nivel: string | null; modelo: string | null; regime: string | null; tecnologias: string | null;
}
interface Dados {
  atualizado: string;
  resumo: { abertas: number; novas30: number; anteriores30: number; remoto: number | null; mediana_dias: number | null };
  por_mes: { mes: string; comunidade: string; total: number }[];
  tecnologias: { nome: string; total: number; pct: number }[];
  niveis: Contagem[]; modelos: Contagem[]; regimes: Contagem[];
  entrada_por_mes: { mes: string; pct: number }[];
  vagas: Vaga[];
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const CORES: Record<string, string> = {
  'Back-end': '#0071e3', 'Front-end': '#ff9500', React: '#5ac8fa', '.NET': '#5856d6', Java: '#ff3b30',
  PHP: '#af52de', QA: '#34c759', Dados: '#ff2d55', Android: '#30b0c7', iOS: '#8e8e93',
};
const TONS = ['#0071e3', '#5ac8fa', '#34c759', '#ff9500', '#af52de', '#c7c7cc'];

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const nomeMes = (mes: string) => new Date(`${mes}-15T12:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
const numero = (n: number) => n.toLocaleString('pt-BR');

function mostrarResumo({ resumo, atualizado }: Dados) {
  $('atualizado').textContent = `Atualizado em ${new Date(atualizado).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}`;
  $('abertas').textContent = numero(resumo.abertas);
  $('novas').textContent = numero(resumo.novas30);
  if (resumo.anteriores30) {
    const v = Math.round(((resumo.novas30 - resumo.anteriores30) / resumo.anteriores30) * 100);
    $('variacao').textContent = `${v > 0 ? '+' : ''}${v}% sobre os 30 dias anteriores`;
    $('variacao').className = v >= 0 ? 'sobe' : 'desce';
  }
  $('remoto').textContent = resumo.remoto === null ? '–' : `${resumo.remoto}%`;
  $('mediana').textContent = resumo.mediana_dias === null ? '–' : `${resumo.mediana_dias} dias`;
}

/** Colunas empilhadas por comunidade, uma por mês. */
function mostrarPorMes({ por_mes }: Dados) {
  const meses = [...new Set(por_mes.map((m) => m.mes))];
  const comunidades = [...new Set(por_mes.map((m) => m.comunidade))]
    .sort((a, b) => Object.keys(CORES).indexOf(a) - Object.keys(CORES).indexOf(b));
  const totais = meses.map((mes) => por_mes.filter((m) => m.mes === mes).reduce((s, m) => s + m.total, 0));
  const maior = Math.max(...totais);
  $('por-mes').innerHTML = meses.map((mes, i) => {
    const partes = comunidades.map((c) => {
      const total = por_mes.find((m) => m.mes === mes && m.comunidade === c)?.total ?? 0;
      return total ? `<i style="height:${(total / maior) * 100}%;background:${CORES[c]}" title="${c}: ${total}"></i>` : '';
    }).join('');
    const parcial = i === meses.length - 1 ? ' parcial" title="Mês em andamento' : '';
    return `<div class="coluna${parcial}"><b>${totais[i]}</b><div class="pilha">${partes}</div><span>${nomeMes(mes)}</span></div>`;
  }).join('');
  $('legenda').innerHTML = comunidades.map((c) => `<li><i style="background:${CORES[c]}"></i>${c}</li>`).join('');
}

function mostrarTecnologias({ tecnologias }: Dados) {
  const maior = tecnologias[0]?.pct || 1;
  $('tecnologias').innerHTML = tecnologias.map((t) => `<li>
    <span>${t.nome}</span><b>${t.pct}%</b>
    <span class="trilho"><i style="width:${(t.pct / maior) * 100}%"></i></span>
  </li>`).join('');
}

function mostrarEntrada({ entrada_por_mes }: Dados) {
  const maior = Math.max(...entrada_por_mes.map((m) => m.pct), 1);
  $('entrada').innerHTML = entrada_por_mes.map((m) => `<div class="coluna">
    <b>${Math.round(m.pct)}%</b>
    <div class="pilha"><i style="height:${(m.pct / maior) * 100}%"></i></div>
    <span>${nomeMes(m.mes)}</span>
  </div>`).join('');
}

/** Barras de 100% para nível, modelo e regime. */
function mostrarPerfil(d: Dados) {
  const grupos: [string, Contagem[]][] = [['Nível', d.niveis], ['Modelo', d.modelos], ['Regime', d.regimes]];
  $('perfil').innerHTML = grupos.map(([nome, itens]) => {
    const total = itens.reduce((s, x) => s + x.total, 0);
    const cor = (x: Contagem, i: number) => (x.valor === 'Não informado' ? TONS.at(-1) : TONS[i % (TONS.length - 1)]);
    return `<div class="grupo">
      <h3>${nome}</h3>
      <div class="faixa">${itens.map((x, i) => `<i style="flex:${x.total};background:${cor(x, i)}" title="${x.valor}: ${x.total}"></i>`).join('')}</div>
      <ul class="legenda">${itens.map((x, i) =>
        `<li><i style="background:${cor(x, i)}"></i>${x.valor} <b>${Math.round((x.total / total) * 100)}%</b></li>`).join('')}</ul>
    </div>`;
  }).join('');
}

function quando(iso: string) {
  const dias = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  return dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function mostrarVagas(vagas: Vaga[]) {
  const termo = semAcento(($('busca') as HTMLInputElement).value.trim());
  const [comunidade, nivel, modelo] = ['f-comunidade', 'f-nivel', 'f-modelo'].map((id) => ($(id) as HTMLSelectElement).value);
  const lista = vagas.filter((v) =>
    (!comunidade || v.comunidade === comunidade) && (!nivel || v.nivel === nivel) && (!modelo || v.modelo === modelo)
    && semAcento(`${v.titulo} ${v.tecnologias ?? ''}`).includes(termo));
  $('contagem').textContent = `${lista.length} de ${vagas.length}`;
  $('vagas').innerHTML = lista.map((v) => `<li>
    <a href="${escapar(v.url)}" target="_blank" rel="noopener">${escapar(v.titulo)}</a>
    <div class="chips">
      <span class="chip" style="--cor:${CORES[v.comunidade]}">${v.comunidade}</span>
      ${[v.nivel, v.modelo, v.regime].filter(Boolean).map((x) => `<span class="chip">${x}</span>`).join('')}
      ${v.tecnologias ? `<span class="tec">${escapar(v.tecnologias)}</span>` : ''}
      <time datetime="${v.criada}">${quando(v.criada)}</time>
    </div>
  </li>`).join('') || '<li class="vazio">Nenhuma vaga com esses filtros.</li>';
}

function preencherFiltros(vagas: Vaga[]) {
  const opcoes = (id: string, valores: (string | null)[]) => {
    const unicos = [...new Set(valores.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    $(id).insertAdjacentHTML('beforeend', unicos.map((v) => `<option>${v}</option>`).join(''));
  };
  opcoes('f-comunidade', vagas.map((v) => v.comunidade));
  opcoes('f-nivel', vagas.map((v) => v.nivel));
  opcoes('f-modelo', vagas.map((v) => v.modelo));
  for (const id of ['busca', 'f-comunidade', 'f-nivel', 'f-modelo']) $(id).addEventListener('input', () => mostrarVagas(vagas));
}

async function iniciar() {
  try {
    const dados: Dados = await (await fetch('./dados.json')).json();
    mostrarResumo(dados);
    mostrarPorMes(dados);
    mostrarTecnologias(dados);
    mostrarEntrada(dados);
    mostrarPerfil(dados);
    preencherFiltros(dados.vagas);
    mostrarVagas(dados.vagas);
  } catch {
    $('atualizado').textContent = 'Não foi possível carregar os dados. Tente recarregar a página.';
  }
}

iniciar();

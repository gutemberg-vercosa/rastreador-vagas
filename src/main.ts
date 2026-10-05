import {
  contar, entradaPorMes, filtrar, meses, NAO_INFORMADO, resumo,
  type Dimensao, type Filtros, type Vaga,
} from './indicadores';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const CORES: Record<string, string> = {
  'Back-end': '#0071e3', 'Front-end': '#ff9500', React: '#5ac8fa', '.NET': '#5856d6', Java: '#ff3b30',
  PHP: '#af52de', QA: '#34c759', Dados: '#ff2d55', Android: '#30b0c7', iOS: '#8e8e93',
};
const TONS = ['#0071e3', '#5ac8fa', '#34c759', '#ff9500', '#af52de'];
const CINZA = '#c7c7cc';
const NOMES: Record<Dimensao, string> = {
  comunidade: 'Comunidade', mes: 'Mês', tecnologia: 'Tecnologia', nivel: 'Nível', modelo: 'Modelo', regime: 'Regime',
};
const DIMENSOES = Object.keys(NOMES) as Dimensao[];
const POR_PAGINA = 50;

let vagas: Vaga[] = [];
let agora = new Date();
let listaMeses: string[] = [];
const filtros: Filtros = {};
let pagina = 1;

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const numero = (n: number) => n.toLocaleString('pt-BR');
const nomeMes = (mes: string, ano = false) => new Date(`${mes}-15T12:00`)
  .toLocaleDateString('pt-BR', ano ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '');
const rotulo = (d: Dimensao, valor: string) => (d === 'mes' ? nomeMes(valor, true) : valor);

/** Atributos de um item clicável: liga ou desliga o filtro e fica apagado quando outro valor está escolhido. */
function alvo(d: Dimensao, valor: string, classe = '') {
  const apagado = filtros[d] && filtros[d] !== valor ? ' apagado' : '';
  return `type="button" data-d="${d}" data-v="${escapar(valor)}" aria-pressed="${filtros[d] === valor}" class="alvo ${classe}${apagado}"`;
}

function mudar(acao: () => void) {
  acao();
  pagina = 1;
  mostrar();
}

// ---------- Filtros ativos e campos de busca ----------

function mostrarAtivos() {
  const ativos = DIMENSOES.filter((d) => filtros[d]);
  $('ativos').hidden = !ativos.length;
  $('ativos').innerHTML = ativos.map((d) =>
    `<button type="button" data-tirar="${d}">${NOMES[d]}: <b>${escapar(rotulo(d, filtros[d]!))}</b> <span aria-hidden="true">×</span></button>`).join('')
    + (ativos.length > 1 ? '<button type="button" data-tirar="tudo" class="limpar">Limpar filtros</button>' : '');
  document.querySelectorAll<HTMLSelectElement>('[data-filtro]').forEach((s) => (s.value = filtros[s.dataset.filtro as Dimensao] ?? ''));
}

function preencherCampos() {
  document.querySelectorAll<HTMLSelectElement>('[data-filtro]').forEach((s) => {
    const d = s.dataset.filtro as Dimensao;
    const opcoes = contar(vagas, d).map(([v]) => v).filter((v) => v !== NAO_INFORMADO);
    if (d !== 'tecnologia') opcoes.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    s.insertAdjacentHTML('beforeend', opcoes.map((v) => `<option>${escapar(v)}</option>`).join(''));
    s.addEventListener('change', () => mudar(() => {
      if (s.value) filtros[d] = s.value;
      else delete filtros[d];
    }));
  });
  $('busca').addEventListener('input', () => mudar(() => (filtros.busca = ($('busca') as HTMLInputElement).value)));
}

// ---------- Aba Vagas ----------

function quando(iso: string) {
  const dias = Math.floor((agora.getTime() - Date.parse(iso)) / 864e5);
  return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
}

function mostrarVagas() {
  const soAbertas = ($('so-abertas') as HTMLInputElement).checked;
  const lista = filtrar(vagas, filtros).filter((v) => !soAbertas || !v.fechada);
  const visiveis = lista.slice(0, pagina * POR_PAGINA);
  $('n-vagas').textContent = numero(lista.length);
  $('contagem').textContent = `${numero(lista.length)} vaga${lista.length === 1 ? '' : 's'}`;
  $('vagas').innerHTML = visiveis.map((v) => `<li${v.fechada ? ' class="encerrada"' : ''}>
    <a href="${escapar(v.url)}" target="_blank" rel="noopener">${escapar(v.titulo)}</a>
    <div class="chips">
      <button ${alvo('comunidade', v.comunidade, 'chip')} style="--cor:${CORES[v.comunidade]}">${v.comunidade}</button>
      ${(['nivel', 'modelo', 'regime'] as const).filter((d) => v[d]).map((d) => `<button ${alvo(d, v[d]!, 'chip')}>${v[d]}</button>`).join('')}
      ${v.tecnologias.map((t) => `<button ${alvo('tecnologia', t, 'tec')}>${t}</button>`).join('')}
      <time datetime="${v.criada}">${v.fechada ? 'encerrada · ' : ''}${quando(v.criada)}</time>
    </div>
  </li>`).join('') || '<li class="vazio">Nenhuma vaga com esses filtros.</li>';
  $('mais').hidden = visiveis.length >= lista.length;
}

// ---------- Aba Painel ----------
// Cada gráfico ignora as próprias dimensões: o item escolhido fica destacado e os outros, apagados.

function mostrarResumo() {
  const r = resumo(filtrar(vagas, filtros), agora);
  $('abertas').textContent = numero(r.abertas);
  $('novas').textContent = numero(r.novas30);
  const variacao = $('variacao');
  const v = r.anteriores30 ? Math.round(((r.novas30 - r.anteriores30) / r.anteriores30) * 100) : null;
  variacao.textContent = v === null ? 'sem vagas nos 30 dias anteriores' : `${v > 0 ? '+' : ''}${v}% sobre os 30 dias anteriores`;
  variacao.className = v === null ? '' : v >= 0 ? 'sobe' : 'desce';
  $('remoto').textContent = r.remoto === null ? '–' : `${r.remoto}%`;
  $('mediana').textContent = r.medianaDias === null ? '–' : `${Math.round(r.medianaDias)} dias`;
}

/** Colunas por mês, empilhadas por comunidade. A coluna filtra o mês; a legenda, a comunidade. */
function mostrarPorMes() {
  const base = filtrar(vagas, filtros, ['mes', 'comunidade']);
  const comunidades = Object.keys(CORES).filter((c) => vagas.some((v) => v.comunidade === c));
  const dados = listaMeses.map((mes) => base.filter((v) => v.criada.startsWith(mes)));
  const maior = Math.max(...dados.map((d) => d.length), 1);
  $('por-mes').innerHTML = dados.map((doMes, i) => {
    const mes = listaMeses[i];
    const total = filtros.comunidade ? doMes.filter((v) => v.comunidade === filtros.comunidade).length : doMes.length;
    const partes = comunidades.map((c) => {
      const n = doMes.filter((v) => v.comunidade === c).length;
      const apagado = filtros.comunidade && filtros.comunidade !== c ? ' class="apagado"' : '';
      return n ? `<i${apagado} style="height:${(n / maior) * 100}%;background:${CORES[c]}"></i>` : '';
    }).join('');
    return `<button ${alvo('mes', mes, i === dados.length - 1 ? 'coluna parcial' : 'coluna')} title="${nomeMes(mes, true)}: ${total} vagas">
      <b>${total}</b><span class="pilha">${partes}</span><span class="rotulo">${nomeMes(mes)}</span>
    </button>`;
  }).join('');
  $('legenda').innerHTML = comunidades.map((c) =>
    `<button ${alvo('comunidade', c)}><i style="background:${CORES[c]}"></i>${c}</button>`).join('');
}

function mostrarTecnologias() {
  const base = filtrar(vagas, filtros, ['tecnologia']);
  const contagem = contar(base, 'tecnologia');
  const top = contagem.slice(0, 12);
  const escolhida = contagem.find(([t]) => t === filtros.tecnologia);
  if (escolhida && !top.includes(escolhida)) top.push(escolhida);
  const pct = (n: number) => Math.round((100 * n) / (base.length || 1));
  const maior = pct(top[0]?.[1] ?? 0) || 1;
  $('tecnologias').innerHTML = top.map(([t, n]) => `<button ${alvo('tecnologia', t, 'barra')} title="${n} vagas">
    <span>${t}</span><b>${pct(n)}%</b>
    <span class="trilho"><i style="width:${(pct(n) / maior) * 100}%"></i></span>
  </button>`).join('') || '<p class="vazio">Nenhuma vaga com esses filtros.</p>';
}

function mostrarEntrada() {
  const dados = entradaPorMes(filtrar(vagas, filtros, ['mes', 'nivel']), listaMeses);
  const maior = Math.max(...dados.map((d) => d.pct ?? 0), 1);
  $('entrada').innerHTML = dados.map(({ mes, pct }) => `<button ${alvo('mes', mes, 'coluna')} title="${nomeMes(mes, true)}">
    <b>${pct === null ? '–' : `${Math.round(pct)}%`}</b>
    <span class="pilha"><i style="height:${((pct ?? 0) / maior) * 100}%"></i></span>
    <span class="rotulo">${nomeMes(mes)}</span>
  </button>`).join('');
}

/** Barras de 100% para nível, modelo e regime; cada parte e cada item da legenda filtram. */
function mostrarPerfil() {
  $('perfil').innerHTML = (['nivel', 'modelo', 'regime'] as const).map((d) => {
    const itens = contar(filtrar(vagas, filtros, [d]), d);
    const total = itens.reduce((s, [, n]) => s + n, 0) || 1;
    const cor = (valor: string, i: number) => (valor === NAO_INFORMADO ? CINZA : TONS[i % TONS.length]);
    return `<div class="grupo">
      <h3>${NOMES[d]}</h3>
      <div class="faixa">${itens.map(([valor, n], i) =>
        `<button ${alvo(d, valor)} style="flex:${n};background:${cor(valor, i)}" title="${valor}: ${n}" aria-label="${valor}"></button>`).join('')}</div>
      <div class="legenda">${itens.map(([valor, n], i) =>
        `<button ${alvo(d, valor)}><i style="background:${cor(valor, i)}"></i>${valor} <b>${Math.round((100 * n) / total)}%</b></button>`).join('')}</div>
    </div>`;
  }).join('');
}

// ---------- Abas e eventos ----------

function mostrar() {
  mostrarAtivos();
  mostrarVagas();
  if ($('aba-painel').hidden) return;
  mostrarResumo();
  mostrarPorMes();
  mostrarTecnologias();
  mostrarEntrada();
  mostrarPerfil();
}

function abrirAba() {
  const aba = location.hash === '#painel' ? 'painel' : 'vagas';
  $('aba-vagas').hidden = aba !== 'vagas';
  $('aba-painel').hidden = aba !== 'painel';
  document.querySelectorAll<HTMLElement>('[data-aba]').forEach((a) =>
    a.dataset.aba === aba ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  mostrar();
}

document.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const item = el.closest<HTMLElement>('[data-d]');
  const tirar = el.closest<HTMLElement>('[data-tirar]')?.dataset.tirar;
  if (item) {
    const d = item.dataset.d as Dimensao;
    const valor = item.dataset.v!;
    mudar(() => (filtros[d] === valor ? delete filtros[d] : (filtros[d] = valor)));
  } else if (tirar) {
    mudar(() => (tirar === 'tudo' ? DIMENSOES : [tirar as Dimensao]).forEach((d) => delete filtros[d]));
  }
});
$('so-abertas').addEventListener('change', () => mudar(() => {}));
$('mais').addEventListener('click', () => {
  pagina++;
  mostrarVagas();
});
window.addEventListener('hashchange', abrirAba);

async function iniciar() {
  try {
    const dados: { atualizado: string; vagas: Vaga[] } = await (await fetch('./dados.json')).json();
    vagas = dados.vagas;
    agora = new Date(dados.atualizado);
    listaMeses = meses(agora);
    $('atualizado').textContent = `Atualizado em ${agora.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}`;
    preencherCampos();
    abrirAba();
  } catch {
    $('atualizado').textContent = 'Não foi possível carregar os dados. Tente recarregar a página.';
  }
}

iniciar();

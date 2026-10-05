import { describe, expect, it } from 'vitest';
import { contar, entradaPorMes, filtrar, mediana, meses, resumo, type Vaga } from './indicadores';

const vaga = (p: Partial<Vaga>): Vaga => ({
  titulo: 'Vaga', url: '', comunidade: 'Back-end', criada: '2026-10-01T10:00:00Z', fechada: null,
  nivel: null, modelo: null, regime: null, tecnologias: [], ...p,
});

const vagas = [
  vaga({ titulo: 'Dev Python Júnior', nivel: 'Júnior', modelo: 'Remoto', tecnologias: ['Python', 'SQL'] }),
  vaga({ titulo: 'Dev Java', comunidade: 'Java', criada: '2026-09-20T10:00:00Z', fechada: '2026-09-30T10:00:00Z', nivel: 'Sênior', modelo: 'Remoto', tecnologias: ['Java', 'SQL'] }),
  vaga({ titulo: 'Analista de Dados', comunidade: 'Dados', criada: '2026-08-20T10:00:00Z', fechada: '2026-08-24T10:00:00Z', nivel: 'Pleno', modelo: 'Híbrido' }),
];

describe('filtrar', () => {
  it('cruza todas as dimensões e a busca sem acento', () => {
    expect(filtrar(vagas, { tecnologia: 'SQL', modelo: 'Remoto' })).toHaveLength(2);
    expect(filtrar(vagas, { tecnologia: 'SQL', mes: '2026-09' }).map((v) => v.titulo)).toEqual(['Dev Java']);
    expect(filtrar(vagas, { busca: 'junior' })).toHaveLength(1);
    expect(filtrar(vagas, { busca: 'python' })).toHaveLength(1); // também busca nas tecnologias
  });

  it('ignora as dimensões do próprio gráfico', () => {
    expect(filtrar(vagas, { tecnologia: 'Java', nivel: 'Sênior' }, ['tecnologia'])).toHaveLength(1);
    expect(filtrar(vagas, { tecnologia: 'Java' }, ['tecnologia'])).toHaveLength(3);
  });

  it('filtra pelas vagas sem a informação', () => {
    expect(filtrar([...vagas, vaga({})], { nivel: 'Não informado' })).toHaveLength(1);
  });
});

it('conta com "Não informado" por último', () => {
  expect(contar([...vagas, vaga({}), vaga({})], 'nivel')).toEqual([['Júnior', 1], ['Sênior', 1], ['Pleno', 1], ['Não informado', 2]]);
  expect(contar(vagas, 'tecnologia')[0]).toEqual(['SQL', 2]);
});

it('lista os 13 meses até o mês atual', () => {
  const m = meses(new Date('2026-10-04T12:00:00Z'));
  expect([m[0], m[12], m.length]).toEqual(['2025-10', '2026-10', 13]);
});

it('calcula a mediana', () => {
  expect(mediana([])).toBeNull();
  expect(mediana([10, 4])).toBe(7);
  expect(mediana([3, 1, 2])).toBe(2);
});

it('resume as vagas', () => {
  expect(resumo(vagas, new Date('2026-10-04T12:00:00Z'))).toEqual({
    abertas: 1, novas30: 2, anteriores30: 1, remoto: 67, medianaDias: 7,
  });
});

it('calcula a fatia de vagas de entrada por mês', () => {
  expect(entradaPorMes(vagas, ['2026-09', '2026-10', '2026-11'])).toEqual([
    { mes: '2026-09', pct: 0 }, { mes: '2026-10', pct: 100 }, { mes: '2026-11', pct: null },
  ]);
});

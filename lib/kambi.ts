// Cliente da Offering API da Kambi, plataforma que opera a BetWarrior.
// Roda sempre no servidor: evita CORS e mantem a origem das chamadas fora do browser.

const BASE = 'https://eu.offering-api.kambicdn.com/offering/v2018';

// Codigo do operador. Trocar isso troca de casa de apostas: o ID do evento e
// global na Kambi, mas os precos sao por operador.
const OPERADOR = process.env.KAMBI_OPERADOR ?? 'bwbr';

const PARAMS = 'lang=pt_BR&market=BR&client_id=2&channel_id=1';

// Segundos de cache no edge. Curto o bastante para a odd ser util,
// longo o bastante para uma rajada de cliques nao virar rajada de requests.
const REVALIDAR = 30;

export const ESPORTES = [
  { chave: 'football', nome: 'Futebol' },
  { chave: 'basketball', nome: 'Basquete' },
  { chave: 'tennis', nome: 'Tênis' },
  { chave: 'volleyball', nome: 'Vôlei' },
  { chave: 'ice_hockey', nome: 'Hóquei' },
] as const;

export type ChaveEsporte = (typeof ESPORTES)[number]['chave'];

export const esporteValido = (v: string): v is ChaveEsporte =>
  ESPORTES.some((e) => e.chave === v);

// ---------- tipos da resposta bruta (so o que usamos) ----------

type EventoBruto = {
  id: number;
  name: string;
  homeName?: string;
  awayName?: string;
  group: string;
  groupId: number;
  start: string;
  state?: string;
  nonLiveBoCount?: number;
  liveBoCount?: number;
  path?: { id: number; name: string }[];
};

type OutcomeBruto = {
  label?: string;
  englishLabel?: string;
  odds?: number;
  line?: number;
  participant?: string;
  type?: string;
  status?: string;
  oddsAmerican?: string | number;
  oddsFractional?: string;
};

type BetOfferBruto = {
  id: number;
  criterion: { label?: string; englishLabel?: string };
  betOfferType?: { englishName?: string };
  outcomes?: OutcomeBruto[];
};

// ---------- tipos que a UI consome ----------

export type Jogo = {
  id: number;
  nome: string;
  casa: string | null;
  fora: string | null;
  campeonato: string;
  campeonatoId: number;
  regiao: string | null;
  inicio: string;
  aoVivo: boolean;
  qtdMercados: number;
};

export type Campeonato = {
  id: number;
  nome: string;
  regiao: string | null;
  simulado: boolean;
  qtdJogos: number;
  proximoInicio: string;
};

export type Selecao = {
  rotulo: string;
  participante: string | null;
  linha: number | null;
  decimal: number;
  americana: string;
  fracionaria: string;
};

export type Mercado = {
  criterio: string;
  criterioEn: string;
  porJogador: boolean;
  selecoes: Selecao[];
};

export type DetalheJogo = {
  jogo: Jogo | null;
  mercados: Mercado[];
  consultadoEm: string;
};

// ---------- helpers ----------

async function buscar<T>(url: string): Promise<T> {
  const r = await fetch(url, {
    headers: { accept: 'application/json' },
    next: { revalidate: REVALIDAR },
  });
  if (!r.ok) throw new Error(`Kambi respondeu ${r.status}`);
  return r.json() as Promise<T>;
}

// A API entrega odds e linhas multiplicadas por mil: 1380 e 1.38, 2500 e 2.5.
const milesimos = (n: number | undefined): number | null =>
  typeof n === 'number' ? n / 1000 : null;

// O rotulo em portugues carrega o texto de liquidacao e muda com o idioma.
// O rotulo em ingles e estavel, entao e ele que usamos para classificar.
const limparEn = (s: string): string =>
  s.replace(/\s*\((?:Settled|Decided) using Opta data\)\s*/i, '').trim();

const formatarAmericana = (v: string | number | undefined): string => {
  if (v === undefined || v === null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n > 0 ? `+${n}` : String(n);
};

// O nome do campeonato sozinho e ambiguo: existe "Premier League" na Inglaterra,
// no Pais de Gales e na Tanzania, todas com esse nome exato. O caminho do evento
// carrega o pais no nivel do meio — ["Futebol", "Tanzânia", "Premier League"] —
// e e ele que desfaz a confusao.
const regiaoDoEvento = (e: EventoBruto): string | null => {
  const p = e.path ?? [];
  return p.length >= 3 ? p[1].name : null;
};

// Partidas simuladas (FIFA, "Cyber Live Arena") repetem a cada poucos minutos e
// enchem a lista, empurrando o futebol de verdade para baixo.
const SIMULADO = /esport|cyber|battle|\(\d+\s*x\s*\d+/i;

const mapearEvento = (e: EventoBruto): Jogo => ({
  id: e.id,
  nome: e.name,
  casa: e.homeName ?? null,
  fora: e.awayName ?? null,
  campeonato: e.group,
  campeonatoId: e.groupId,
  regiao: regiaoDoEvento(e),
  inicio: e.start,
  aoVivo: e.state === 'STARTED',
  qtdMercados: (e.nonLiveBoCount ?? 0) + (e.liveBoCount ?? 0),
});

// ---------- consultas ----------

export async function listarJogos(esporte: ChaveEsporte): Promise<Jogo[]> {
  const url = `${BASE}/${OPERADOR}/listView/${esporte}/all/all/all/matches.json?${PARAMS}&useCombined=true`;
  const d = await buscar<{ events?: { event: EventoBruto }[] }>(url);
  return (d.events ?? [])
    .map((w) => mapearEvento(w.event))
    .filter((j) => j.qtdMercados > 0)
    .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
}

export async function listarCampeonatos(esporte: ChaveEsporte): Promise<Campeonato[]> {
  const jogos = await listarJogos(esporte);
  const mapa = new Map<number, Campeonato>();

  for (const j of jogos) {
    const atual = mapa.get(j.campeonatoId);
    if (atual) {
      atual.qtdJogos += 1;
      if (j.inicio < atual.proximoInicio) atual.proximoInicio = j.inicio;
    } else {
      mapa.set(j.campeonatoId, {
        id: j.campeonatoId,
        nome: j.campeonato,
        regiao: j.regiao,
        simulado: SIMULADO.test(`${j.campeonato} ${j.regiao ?? ''}`),
        qtdJogos: 1,
        proximoInicio: j.inicio,
      });
    }
  }

  // Competicoes reais primeiro; dentro de cada grupo, as com mais jogos.
  return [...mapa.values()].sort(
    (a, b) =>
      Number(a.simulado) - Number(b.simulado) ||
      b.qtdJogos - a.qtdJogos ||
      a.nome.localeCompare(b.nome, 'pt-BR')
  );
}

export async function detalharJogo(eventoId: number): Promise<DetalheJogo> {
  const url = `${BASE}/${OPERADOR}/betoffer/event/${eventoId}.json?${PARAMS}`;
  const d = await buscar<{ betOffers?: BetOfferBruto[]; events?: EventoBruto[] }>(url);

  // Varios betOffers compartilham o mesmo criterio quando representam linhas
  // diferentes do mesmo mercado. Juntamos tudo sob um cabecalho so.
  const porCriterio = new Map<string, Mercado>();

  for (const bo of d.betOffers ?? []) {
    const criterio = bo.criterion.label ?? bo.criterion.englishLabel ?? 'Mercado';
    const criterioEn = limparEn(bo.criterion.englishLabel ?? '');
    const abertas = (bo.outcomes ?? []).filter((o) => o.status === 'OPEN');
    if (!abertas.length) continue;

    // Nao da para deduzir mercado de jogador pela presenca de `participant`:
    // em Handicap e Resultado Final ele vem preenchido com o nome do time.
    // Quem separa de verdade e o tipo da oferta.
    const porJogador = (bo.betOfferType?.englishName ?? '').startsWith('Player Occurrence');

    const alvo =
      porCriterio.get(criterio) ??
      {
        criterio,
        criterioEn,
        porJogador,
        selecoes: [] as Selecao[],
      };

    for (const o of abertas) {
      const decimal = milesimos(o.odds);
      if (decimal === null) continue;
      alvo.selecoes.push({
        rotulo: o.label ?? o.englishLabel ?? '—',
        participante: o.participant ?? null,
        linha: milesimos(o.line),
        decimal,
        americana: formatarAmericana(o.oddsAmerican),
        fracionaria: o.oddsFractional ?? '—',
      });
    }

    if (alvo.selecoes.length) porCriterio.set(criterio, alvo);
  }

  const mercados = [...porCriterio.values()].sort((a, b) => {
    // Mercados de jogador primeiro: e o que interessa na comparacao de linhas.
    if (a.porJogador !== b.porJogador) return a.porJogador ? -1 : 1;
    return b.selecoes.length - a.selecoes.length;
  });

  const bruto = d.events?.[0];
  return {
    jogo: bruto ? mapearEvento(bruto) : null,
    mercados,
    consultadoEm: new Date().toISOString(),
  };
}

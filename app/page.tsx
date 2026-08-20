'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Campeonato, DetalheJogo, Jogo, Selecao } from '@/lib/kambi';
import { ESPORTES } from '@/lib/kambi';

type Formato = 'decimal' | 'americana' | 'fracionaria';

const FORMATOS: { chave: Formato; nome: string }[] = [
  { chave: 'decimal', nome: 'Decimal' },
  { chave: 'americana', nome: 'Americana' },
  { chave: 'fracionaria', nome: 'Fracionária' },
];

const hora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const mostrarOdd = (s: Selecao, f: Formato) => {
  if (f === 'americana') return s.americana;
  if (f === 'fracionaria') return s.fracionaria;
  return s.decimal.toFixed(2);
};

export default function Pagina() {
  const [esporte, setEsporte] = useState<string>('football');
  const [campeonatos, setCampeonatos] = useState<Campeonato[]>([]);
  const [campeonatoId, setCampeonatoId] = useState<number | null>(null);
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [jogoId, setJogoId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheJogo | null>(null);
  const [formato, setFormato] = useState<Formato>('decimal');
  const [busca, setBusca] = useState('');
  const [ocultarSimulados, setOcultarSimulados] = useState(true);

  const [carregando, setCarregando] = useState({ camp: false, jogos: false, mercados: false });
  const [erro, setErro] = useState<string | null>(null);

  const pedir = useCallback(async (url: string) => {
    const r = await fetch(url);
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro ?? `Erro ${r.status}`);
    return d;
  }, []);

  // Troca de esporte reinicia a navegação inteira.
  useEffect(() => {
    let cancelado = false;
    setCarregando((c) => ({ ...c, camp: true }));
    setErro(null);
    setCampeonatoId(null);
    setJogos([]);
    setJogoId(null);
    setDetalhe(null);

    pedir(`/api/campeonatos?esporte=${esporte}`)
      .then((d) => {
        if (cancelado) return;
        setCampeonatos(d.campeonatos ?? []);
      })
      .catch((e: Error) => !cancelado && setErro(e.message))
      .finally(() => !cancelado && setCarregando((c) => ({ ...c, camp: false })));

    return () => {
      cancelado = true;
    };
  }, [esporte, pedir]);

  const abrirCampeonato = useCallback(
    async (id: number) => {
      setCampeonatoId(id);
      setJogoId(null);
      setDetalhe(null);
      setJogos([]);
      setErro(null);
      setCarregando((c) => ({ ...c, jogos: true }));
      try {
        const d = await pedir(`/api/campeonatos?esporte=${esporte}&campeonato=${id}`);
        setJogos(d.jogos ?? []);
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setCarregando((c) => ({ ...c, jogos: false }));
      }
    },
    [esporte, pedir]
  );

  const abrirJogo = useCallback(
    async (id: number) => {
      setJogoId(id);
      setDetalhe(null);
      setBusca('');
      setErro(null);
      setCarregando((c) => ({ ...c, mercados: true }));
      try {
        setDetalhe(await pedir(`/api/mercados/${id}`));
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setCarregando((c) => ({ ...c, mercados: false }));
      }
    },
    [pedir]
  );

  const campeonatosVisiveis = useMemo(
    () => (ocultarSimulados ? campeonatos.filter((c) => !c.simulado) : campeonatos),
    [campeonatos, ocultarSimulados]
  );

  const qtdSimulados = campeonatos.filter((c) => c.simulado).length;

  const mercadosVisiveis = useMemo(() => {
    if (!detalhe) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return detalhe.mercados;
    return detalhe.mercados
      .map((m) => {
        if (m.criterio.toLowerCase().includes(q)) return m;
        const selecoes = m.selecoes.filter(
          (s) =>
            s.participante?.toLowerCase().includes(q) || s.rotulo.toLowerCase().includes(q)
        );
        return selecoes.length ? { ...m, selecoes } : null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [detalhe, busca]);

  const totalSelecoes = detalhe?.mercados.reduce((s, m) => s + m.selecoes.length, 0) ?? 0;

  return (
    <>
      <header className="topo">
        <div className="topo-inner">
          <div className="marca">
            <b>Arena Odds</b>
            <span>BetWarrior · direto da API</span>
          </div>
          <div className="formatos" role="group" aria-label="Formato das odds">
            {FORMATOS.map((f) => (
              <button
                key={f.chave}
                onClick={() => setFormato(f.chave)}
                aria-pressed={formato === f.chave}
              >
                {f.nome}
              </button>
            ))}
          </div>
        </div>
      </header>

      <nav className="esportes" aria-label="Esporte">
        {ESPORTES.map((e) => (
          <button
            key={e.chave}
            onClick={() => setEsporte(e.chave)}
            aria-pressed={esporte === e.chave}
          >
            {e.nome}
          </button>
        ))}
      </nav>

      {erro && <div className="erro">Não consegui consultar a casa: {erro}</div>}

      <main className="paineis">
        {/* campeonatos */}
        <section className="painel">
          <div className="painel-cab">
            <h2>Campeonato</h2>
            <em>{campeonatosVisiveis.length}</em>
          </div>
          <div className="rolagem">
            {carregando.camp && <p className="carregando">Consultando…</p>}
            {!carregando.camp && !campeonatosVisiveis.length && (
              <p className="vazio">Nada aberto agora.</p>
            )}
            {campeonatosVisiveis.map((c) => (
              <button
                key={c.id}
                className="item"
                aria-current={campeonatoId === c.id}
                onClick={() => abrirCampeonato(c.id)}
              >
                <span className="nome">
                  {c.nome}
                  {c.regiao && <span className="regiao">{c.regiao}</span>}
                </span>
                <span className="meta">{c.qtdJogos}</span>
              </button>
            ))}
          </div>
          {qtdSimulados > 0 && (
            <label className="filtro-pe">
              <input
                type="checkbox"
                checked={ocultarSimulados}
                onChange={(e) => setOcultarSimulados(e.target.checked)}
              />
              Ocultar simulados ({qtdSimulados})
            </label>
          )}
        </section>

        {/* jogos */}
        <section className="painel">
          <div className="painel-cab">
            <h2>Jogo</h2>
            <em>{jogos.length || ''}</em>
          </div>
          <div className="rolagem">
            {!campeonatoId && <p className="vazio">Escolha um campeonato.</p>}
            {carregando.jogos && <p className="carregando">Consultando…</p>}
            {campeonatoId && !carregando.jogos && !jogos.length && (
              <p className="vazio">Sem jogos abertos.</p>
            )}
            {jogos.map((j) => (
              <button
                key={j.id}
                className="item"
                aria-current={jogoId === j.id}
                onClick={() => abrirJogo(j.id)}
              >
                <span className="nome">{j.nome}</span>
                <span className="meta">
                  {j.aoVivo ? <span className="ao-vivo">AO VIVO</span> : hora(j.inicio)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* mercados */}
        <section className="painel">
          <div className="painel-cab">
            <h2>Odds na BetWarrior</h2>
            {detalhe && (
              <em>
                {detalhe.mercados.length} mercados · {totalSelecoes} seleções
              </em>
            )}
          </div>

          {!jogoId && <p className="vazio">Escolha um jogo para ver as odds.</p>}
          {carregando.mercados && <p className="carregando">Consultando a casa…</p>}

          {detalhe && (
            <>
              <div className="jogo-cab">
                <h3>{detalhe.jogo?.nome ?? 'Jogo'}</h3>
                <div className="linha-meta">
                  <span>{detalhe.jogo?.campeonato}</span>
                  {detalhe.jogo && <span>{hora(detalhe.jogo.inicio)}</span>}
                  <span>consultado {hora(detalhe.consultadoEm)}</span>
                </div>
              </div>

              <div className="busca">
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Filtrar por jogador ou mercado… (ex: Gyökeres, chutes)"
                />
              </div>

              <div className="rolagem">
                {!mercadosVisiveis.length && <p className="vazio">Nada com esse filtro.</p>}
                {mercadosVisiveis.map((m, i) => (
                  <details key={m.criterio} className="mercado" open={i < 2 || busca !== ''}>
                    <summary>
                      <b>{m.criterio}</b>
                      <span className="tag">
                        {m.porJogador ? 'jogador · ' : ''}
                        {m.selecoes.length}
                      </span>
                    </summary>
                    <div className="tbl-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{m.porJogador ? 'Jogador' : 'Seleção'}</th>
                            {m.porJogador && <th>Aposta</th>}
                            <th className="linha-col">Linha</th>
                            <th className="odd">Odd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.selecoes.map((s, k) => (
                            <tr key={`${s.participante ?? s.rotulo}-${s.linha ?? ''}-${k}`}>
                              <td>{s.participante ?? s.rotulo}</td>
                              {m.porJogador && <td>{s.rotulo}</td>}
                              <td className="linha-col">{s.linha ?? '—'}</td>
                              <td className="odd">{mostrarOdd(s, formato)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="rodape">
        Dados consultados ao vivo na Offering API da Kambi, operador bwbr (BetWarrior Brasil).
        Odds variam a cada instante — o horário de cada consulta aparece acima da tabela.
      </footer>
    </>
  );
}

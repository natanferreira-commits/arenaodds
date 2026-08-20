import { NextResponse } from 'next/server';
import { listarCampeonatos, listarJogos, esporteValido } from '@/lib/kambi';

// Campeonatos de um esporte, e opcionalmente os jogos de um campeonato.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const esporte = searchParams.get('esporte') ?? 'football';
  const campeonato = searchParams.get('campeonato');

  if (!esporteValido(esporte)) {
    return NextResponse.json({ erro: 'Esporte não suportado' }, { status: 400 });
  }

  try {
    if (campeonato) {
      const id = Number(campeonato);
      const jogos = (await listarJogos(esporte)).filter((j) => j.campeonatoId === id);
      return NextResponse.json({ jogos });
    }
    return NextResponse.json({ campeonatos: await listarCampeonatos(esporte) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao consultar a casa';
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
}

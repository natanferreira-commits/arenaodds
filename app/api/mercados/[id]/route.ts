import { NextResponse } from 'next/server';
import { detalharJogo } from '@/lib/kambi';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventoId = Number(id);

  if (!Number.isFinite(eventoId)) {
    return NextResponse.json({ erro: 'ID de jogo inválido' }, { status: 400 });
  }

  try {
    return NextResponse.json(await detalharJogo(eventoId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao consultar a casa';
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
}

import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--fonte-ui',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fonte-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Arena Odds — BetWarrior ao vivo',
  description:
    'Consulta as odds da BetWarrior direto da API, sem abrir o site. Escolha o esporte, o campeonato e o jogo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${archivo.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}

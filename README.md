# Arena Odds

Consulta as odds da **BetWarrior** direto da API, sem abrir o site. Escolha o
esporte, o campeonato e o jogo — a página devolve todos os mercados abertos, com
as odds em decimal, americana ou fracionária.

## Rodar local

```bash
npm install
npm run dev
```

## Deploy

Projeto Next.js padrão, sem serviço externo, sem banco e sem variável de
ambiente obrigatória. Na Vercel: importar o repositório e publicar.

## Como funciona

A BetWarrior roda na plataforma **Kambi**, cuja Offering API responde a consultas
HTTP sem autenticação. As chamadas ficam nas rotas de API do Next
(`app/api/…`), ou seja, **no servidor** — o navegador nunca fala com a Kambi
direto. Isso evita CORS e mantém a origem das consultas fora do cliente.

```
navegador ──> /api/… (server) ──> eu.offering-api.kambicdn.com
```

### Rotas

| Rota | Devolve |
|---|---|
| `GET /api/campeonatos?esporte=football` | campeonatos com jogos abertos |
| `GET /api/campeonatos?esporte=football&campeonato=<id>` | jogos daquele campeonato |
| `GET /api/mercados/<idDoJogo>` | todos os mercados abertos do jogo |

### Trocar de casa de apostas

O código do operador fica em `lib/kambi.ts` e sai do ambiente:

```bash
KAMBI_OPERADOR=bwbr   # padrão — BetWarrior Brasil
```

O ID de um jogo é **global** na Kambi, mas os preços são por operador. Trocar
esse código faz a mesma consulta responder por outra casa da plataforma — útil
para comparar, e fácil de errar sem perceber, já que os números continuam
plausíveis.

## Detalhes que quebram quem mexe pela primeira vez

- **Odds e linhas vêm multiplicadas por mil.** `odds: 1380` é 1.38 e
  `line: 2500` é 2.5. Tratado em `lib/kambi.ts`.
- **Classifique pelo rótulo em inglês, não em português.** O texto em português
  carrega a descrição de liquidação e muda com o idioma; `Player's shots` é
  estável.
- **Um mercado vem espalhado em vários `betOffers`,** um por linha. A lib junta
  tudo sob o mesmo cabeçalho.
- **Só seleções `OPEN` entram.** Linha suspensa aparece com cadeado no site
  deles e é descartada aqui.

## Sobre o acesso

A API não pede autenticação, mas isso não é o mesmo que autorização: é o
endereço interno que alimenta o site, não uma API de parceiros documentada.
Para uso interno e volume baixo, é o mesmo dado que qualquer visitante vê. Antes
de expor isso publicamente ou rodar em escala, vale confirmar pelo canal
comercial — e note que a plataforma é da Kambi, então o dono técnico do dado
não é a BetWarrior.

O cache das consultas é de 30s (`REVALIDAR` em `lib/kambi.ts`), o que já evita
transformar cliques em rajada de requisições.

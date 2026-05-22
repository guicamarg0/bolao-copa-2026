# WorldBet 26 - Plataforma de Bolao da Copa 2026

Plataforma web para bolao da Copa do Mundo 2026, com foco em:
- cadastro/login de usuarios,
- palpites por partida,
- fechamento automatico de palpites por horario,
- ranking com pontuacao detalhada,
- painel admin para gestao de jogos e importacao CSV.

## 1. Stack Tecnologica

- `Next.js 16` (App Router)
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Framer Motion`
- `Supabase` (Auth + Postgres)
- `PostgreSQL` local opcional (via Docker)
- `SQLite` local (fallback de desenvolvimento)
- `Vitest` (testes de regra)

## 2. Como a Aplicacao Foi Estruturada

## 2.1 Arquitetura (MVC adaptada para Next.js App Router)

Nao e MVC classico de framework backend, mas o mapeamento funcional fica assim:

- `Model`:
  - Tipos e entidades em `src/lib/types.ts`
  - Regras de negocio e pontuacao em `src/lib/scoring.ts`
  - Persistencia em `src/lib/local-db.ts`, `src/lib/postgres-db.ts`, `src/lib/data.ts`

- `View`:
  - Pags e layout em `src/app/**/page.tsx`
  - Componentes de interface em `src/components/**`

- `Controller`:
  - Server Actions em paginas (ex.: admin/configuracoes)
  - Route Handlers da API local em `src/app/api/**/route.ts`
  - Guards de autenticacao em `src/lib/auth-guard.ts`

## 2.2 Estrutura de Pastas (resumo)

```txt
src/
  app/
    admin/                # Painel admin + server actions
    api/                  # Rotas locais (auth e palpites)
    configuracoes/
    jogos/
    login/
    palpites/
    perfil/
    ranking/
  components/             # UI reutilizavel e boards
  lib/
    app-db.ts             # Orquestra local sqlite/postgres
    data.ts               # Leitura de dados (supabase/local)
    local-db.ts           # Persistencia sqlite
    postgres-db.ts        # Persistencia postgres
    scoring.ts            # Regras de pontuacao
    match-csv.ts          # Parser/validador CSV de jogos
    supabase-*.ts         # Clientes/env do Supabase
supabase/
  schema.sql              # Schema oficial para Supabase cloud
  local-postgres.sql      # Bootstrap para Postgres local
  seed.sql                # Seed opcional de exemplo
```

## 3. Funcionalidades Implementadas

- Dashboard com resumo da competicao
- Pagina de jogos com filtros (fase, grupo, rodada, status) e paginacao
- Pagina de palpites com filtros (status, grupo, rodada), cards uniformes e paginacao
- Bloqueio automatico de palpite por horario e/ou fechamento admin
- Ranking geral com criterios de desempate
- Configuracoes de conta (usuario/senha) com feedback visual
- Painel admin:
  - cadastro manual de jogo,
  - encerramento/reabertura de partida,
  - gestao de usuarios (admin/ativo),
  - importacao em lote de jogos via CSV (`match_number` + `round_number`)

## 4. Regras de Negocio

## 4.1 Bloqueio de Palpites

Um palpite fica bloqueado quando:
- `match.isClosed = true`, ou
- `kickoffAt <= agora`.

## 4.2 Pontuacao

- `10 pontos`: placar exato
- `7 pontos`: vencedor correto + diferenca de gols (sem empate)
- `5 pontos`: resultado correto (vitoria/empate/derrota)
- `1 ponto`: acerto de gols de um dos times
- `0`: sem acerto

Implementado em `src/lib/scoring.ts`.

## 5. Modos de Banco (Storage Mode)

A aplicacao escolhe o modo automaticamente:

1. `supabase` se `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` existirem
2. `postgres` se `DATABASE_URL` existir e Supabase nao estiver configurado
3. `sqlite` fallback local

Arquivo de decisao: `src/lib/storage-mode.ts`.

## 6. Variaveis de Ambiente

Base em `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=
DATABASE_SSL=false
```

## 7. Executando Localmente

## 7.1 Modo simples (SQLite)

```bash
npm install
npm run dev
```

## 7.2 Modo PostgreSQL local (Docker)

1. Copie `.env.docker.example` para `.env.docker` (opcional).
2. Suba o container:

```bash
docker compose --env-file .env.docker up -d
```

3. Configure `.env.local` com `DATABASE_URL`.
4. Rode:

```bash
npm run dev
```

## 7.3 Modo Supabase

1. Crie projeto no Supabase.
2. Rode `supabase/schema.sql` no SQL Editor.
3. Configure no `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Rode `npm run dev`.

## 8. Deploy (GitHub -> Vercel -> Supabase)

## 8.1 GitHub

```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin master
```

## 8.2 Vercel

- Importar repositorio no painel da Vercel
- Configurar variaveis:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Deploy

## 8.3 Supabase

- Rodar `supabase/schema.sql`
- Configurar Auth:
  - `Site URL` de producao
  - Redirect URLs (localhost + Vercel preview/prod)
- Promover primeiro admin:

```sql
update public.profiles
set is_admin = true
where username = 'seu_usuario';
```

## 9. Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run start
```

## 10. Observacoes de Seguranca

- Nenhuma chave real foi commitada no repositorio.
- `.env*` e `supabase/local.sqlite*` estao no `.gitignore`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` e publica por definicao do Supabase (nao e service role).
- Em modo local/postgres existe conta seed para desenvolvimento e deve ser alterada em ambientes reais.
- Recomenda-se adicionar rate limit nas rotas locais de login/signup se esse modo for exposto publicamente.

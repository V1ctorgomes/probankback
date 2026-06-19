# Probank - Backend

API NestJS para gestão de empréstimos particulares.

## Stack

- NestJS + Prisma + PostgreSQL
- JWT + Refresh Token (Argon2)
- Redis (preparado para cache/filas)

## Desenvolvimento local

```bash
# Subir banco e Redis
docker compose up -d

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env

# Migrar banco
npx prisma migrate dev

# Rodar API
npm run start:dev
```

API em `http://localhost:3001` — health check em `/health`.

### Usuário admin padrão

- E-mail: `admin@probank.local`
- Senha: `Admin@123`

## Deploy

Build via Dockerfile. Configure as variáveis de `.env.example` no ambiente de produção.

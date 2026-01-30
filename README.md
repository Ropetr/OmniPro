# OmniPro

Sistema de atendimento omnichannel completo, inspirado no JivoChat. Centraliza todos os canais de comunicação em uma única plataforma com suporte a IA.

## Canais Integrados

| Canal | Tecnologia | Status |
|-------|-----------|--------|
| Chat para Sites | Widget embeddable + Socket.IO | Pronto |
| WhatsApp | Evolution API (não oficial) | Pronto |
| Instagram | Meta Graph API | Pronto |
| Facebook Messenger | Meta Graph API | Pronto |
| MercadoLivre | API de Mensagens ML | Pronto |
| Email | IMAP/SMTP | Pronto |
| Agentes de IA | OpenAI GPT-4o + Base de Conhecimento | Pronto |

## Arquitetura

```
omnipro/
├── backend/          # API Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/       # Database, Redis, Socket.IO
│   │   ├── entities/     # TypeORM entities
│   │   ├── middleware/   # Auth, error handling
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   │   └── channels/ # WhatsApp, Instagram, Facebook, ML, Email
│   │   └── utils/        # Logger, helpers
│   └── Dockerfile
├── frontend/         # React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/   # Layout, UI components
│   │   ├── contexts/     # Auth context
│   │   ├── lib/          # API client, Socket client
│   │   └── pages/        # Dashboard, Conversations, Channels, AI, etc.
│   └── Dockerfile
├── widget/           # Chat widget embeddable
│   ├── public/
│   │   ├── loader.js     # Script de carregamento
│   │   └── widget.html   # Interface do chat
│   └── Dockerfile
├── docker-compose.yml      # Produção
└── docker-compose.dev.yml  # Desenvolvimento (DB + Redis)
```

## Stack Tecnológica

- **Backend**: Node.js, Express, TypeScript, TypeORM
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Banco de Dados**: PostgreSQL 16
- **Cache/Realtime**: Redis 7
- **WebSocket**: Socket.IO
- **IA**: OpenAI API (GPT-4o) com base de conhecimento e aprendizado contínuo
- **WhatsApp**: Evolution API (Baileys)
- **Meta**: Graph API v18 (Instagram + Facebook)
- **MercadoLivre**: API oficial de Mensagens
- **Email**: IMAP (recebimento) + SMTP (envio) com Nodemailer

## Como Executar

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- PostgreSQL 16 (ou via Docker)
- Redis 7 (ou via Docker)

### 1. Clonar e configurar

```bash
git clone <repo-url> omnipro
cd omnipro
cp .env.example .env
# Edite o .env com suas credenciais
```

### 2. Subir banco de dados (desenvolvimento)

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Instalar dependências

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install

# Widget
cd ../widget && npm install
```

### 4. Executar seed (dados iniciais)

```bash
cd backend
npm run seed
```

Isso cria:
- Tenant: Demo Company
- Admin: `admin@omnipro.com` / `admin123`
- Agente: `agente@omnipro.com` / `agent123`
- 6 canais pré-configurados
- 1 Agente de IA com base de conhecimento

### 5. Iniciar aplicação

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev

# Terminal 3 - Widget
cd widget && npm run dev
```

Acesse:
- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3001
- **Widget**: http://localhost:3002

### Produção (Docker)

```bash
docker-compose up --build -d
```

## Funcionalidades

### Dashboard
- Visão geral com métricas em tempo real
- Conversas abertas, total de contatos, mensagens
- Distribuição por canal

### Conversas
- Lista de conversas com filtros por status e canal
- Chat em tempo real via Socket.IO
- Atribuição de conversas para agentes
- Encerramento de conversas com registro

### Canais
- Gestão de canais (criar, ativar, desativar, excluir)
- Widget code snippet para chat do site
- QR Code para conectar WhatsApp
- OAuth para MercadoLivre
- Configuração IMAP/SMTP para email

### Agentes de IA
- Configuração de prompt do sistema
- Seleção de modelo (GPT-4o, GPT-4o Mini, GPT-3.5)
- Ajuste de temperatura
- Base de conhecimento manual (FAQ, procedimentos, produtos)
- Aprendizado automático a partir de conversas
- Interface de teste

### Contatos
- Lista com busca por nome, email, telefone
- Tags e notas
- Histórico de conversas

### Usuários
- Gestão de operadores (admin, supervisor, agente)
- Controle de chats simultâneos
- Status (online, ausente, offline)

## Webhooks

Configure os seguintes webhooks nas plataformas:

| Canal | URL do Webhook |
|-------|---------------|
| WhatsApp (Evolution API) | `POST /api/webhooks/whatsapp/{channelId}` |
| Instagram | `POST /api/webhooks/instagram/{channelId}` |
| Facebook | `POST /api/webhooks/facebook/{channelId}` |
| MercadoLivre | `POST /api/webhooks/mercadolivre/{channelId}` |
| WebChat (Widget) | `POST /api/webhooks/webchat/{channelId}` |

Verificação Meta: `GET /api/webhooks/meta/{channelId}`

## API Reference

### Autenticação
- `POST /api/auth/register` - Criar conta
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Renovar token
- `GET /api/auth/me` - Usuário atual

### Conversas
- `GET /api/conversations` - Listar conversas
- `GET /api/conversations/:id` - Detalhes da conversa
- `GET /api/conversations/:id/messages` - Mensagens
- `POST /api/conversations/:id/messages` - Enviar mensagem
- `POST /api/conversations/:id/assign` - Atribuir conversa
- `POST /api/conversations/:id/close` - Encerrar conversa

### Canais
- `GET /api/channels` - Listar canais
- `POST /api/channels` - Criar canal
- `PUT /api/channels/:id` - Atualizar canal
- `DELETE /api/channels/:id` - Excluir canal

### Agentes IA
- `GET /api/ai/agents` - Listar agentes
- `POST /api/ai/agents` - Criar agente
- `PUT /api/ai/agents/:id` - Atualizar agente
- `GET /api/ai/agents/:id/knowledge` - Base de conhecimento
- `POST /api/ai/agents/:id/knowledge` - Adicionar conhecimento
- `POST /api/ai/agents/:id/test` - Testar agente
- `POST /api/ai/agents/:id/learn` - Processar aprendizado

### Contatos
- `GET /api/contacts` - Listar contatos
- `GET /api/contacts/:id` - Detalhes do contato
- `PUT /api/contacts/:id` - Atualizar contato

### Usuários
- `GET /api/users` - Listar usuários
- `POST /api/users` - Criar usuário
- `PUT /api/users/:id` - Atualizar usuário
- `PATCH /api/users/status` - Atualizar status

### Dashboard
- `GET /api/dashboard/stats` - Estatísticas

## Widget - Integração no Site

Adicione o seguinte código antes do `</body>` do seu site:

```html
<script
  src="http://localhost:3002/loader.js"
  data-channel-id="SEU_CHANNEL_ID"
  data-api-url="http://localhost:3001"
  data-color="#4F46E5"
  data-position="right">
</script>
```

## Licença

MIT

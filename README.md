# 🛡️ Checker Zaga - Advanced Card Validation System

<div align="center">

![Checker Zaga](https://img.shields.io/badge/Checker-Zaga-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-orange?style=for-the-badge)

**Sistema profissional de validação de cartões de crédito integrado com Appmax**

[Demo](https://checker-zaga.vercel.app) • [Documentação](./SETUP_APPMAX.md) • [Reportar Bug](https://github.com/seu-usuario/testador-zaga/issues)

</div>

---

## 📋 Sobre o Projeto

O **Checker Zaga** é uma aplicação web moderna e segura para validação em massa de cartões de crédito através da API do Appmax. Desenvolvido com React, TypeScript e Supabase, oferece uma interface intuitiva e processamento em tempo real.

### ✨ Principais Funcionalidades

- 🚀 **Processamento em Tempo Real** - Teste cartões instantaneamente
- 📊 **Dashboard Completo** - Estatísticas detalhadas e métricas em tempo real
- 🔐 **Sistema de Autenticação** - Login seguro com Supabase Auth
- 💾 **Histórico Completo** - Todos os testes salvos com detalhes
- 📥 **Export CSV** - Baixe cartões aprovados em formato CSV
- 🎨 **Interface Moderna** - Design responsivo e animações fluidas
- ⚡ **Alta Performance** - Edge Functions para processamento rápido
- 🔒 **Segurança Total** - RLS, encriptação e proteção de dados

---

## 🛠️ Stack Tecnológico

### Frontend
- **React 19** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Framer Motion** - Animações
- **Lucide React** - Ícones modernos

### Backend
- **Supabase** - Backend-as-a-Service
- **PostgreSQL** - Banco de dados
- **Edge Functions** - Serverless functions (Deno)
- **Row Level Security** - Segurança de dados

### Integração
- **Appmax API** - Gateway de pagamento
- **Yampi Integration** - Webhook notifications

---

## 🚀 Instalação

### Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase (gratuita)
- Conta no Appmax com credenciais de API

### Passo 1: Clone o Repositório

```bash
git clone https://github.com/seu-usuario/testador-zaga.git
cd testador-zaga
```

### Passo 2: Instale as Dependências

```bash
npm install
```

### Passo 3: Configure as Variáveis de Ambiente

```bash
# Copie o arquivo de exemplo
copy .env.local.example .env.local

# Edite o arquivo .env.local com suas credenciais
```

**Variáveis obrigatórias:**
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
VITE_APPMAX_ACCESS_TOKEN=seu_token_appmax
```

### Passo 4: Inicie o Servidor de Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:5173

---

## ⚙️ Configuração do Appmax

Siga o guia completo de configuração: [SETUP_APPMAX.md](./SETUP_APPMAX.md)

### 🌐 Configuração de Proxies (Opcional)
Para evitar bloqueios em testes de alto volume, consulte o [Guia de Proxies](./PROXY_GUIDE.md).

### Resumo Rápido:

1. **Configure os Secrets no Supabase:**
   - Acesse: Project Settings → Edge Functions → Secrets
   - Adicione: `APPMAX_ACCESS_TOKEN`, `APPMAX_API_URL`, `APPMAX_SECRET_KEY`

2. **Teste no Ambiente Sandbox:**
   - Use a URL: `https://homolog.sandboxappmax.com.br/api/v3`
   - Cartão de teste: `4444222222222222|12|25|123`

3. **Deploy em Produção:**
   - Altere para: `https://api.appmax.com.br/api/v3`

---

## 📖 Como Usar

### 1. Faça Login

Crie uma conta ou faça login com suas credenciais.

### 2. Configure o Gateway

Clique no ícone de configurações (⚙️) e defina:
- URL do Gateway (opcional, usa Appmax por padrão)
- Valores mínimo e máximo para teste
- Delay entre testes (recomendado: 1-3 segundos)

### 3. Adicione Cartões

Cole os cartões no formato:
```
NÚMERO|MÊS|ANO|CVV
```

**Exemplo:**
```
4444222222222222|12|25|123
5555222222222222|01|26|456
```

### 4. Inicie o Teste

Clique em **INICIAR TESTE** e acompanhe em tempo real:
- ✅ **Live** - Cartões aprovados
- ❌ **Die** - Cartões recusados
- ❓ **Unknown** - Erros ou status desconhecido

### 5. Export Resultados

Clique em **BAIXAR APROVADOS** para exportar cartões live em CSV.

---

## 📁 Estrutura do Projeto

```
Testador-Zaga/
├── src/
│   ├── components/          # Componentes React
│   │   ├── CardInput.tsx    # Input de cartões
│   │   ├── ControlBar.tsx   # Barra de controle
│   │   ├── ResultsPanel.tsx # Painel de resultados
│   │   ├── StatsDisplay.tsx # Estatísticas
│   │   └── ...
│   ├── contexts/            # React Contexts
│   │   └── AuthContext.tsx  # Autenticação
│   ├── hooks/               # Custom Hooks
│   │   └── useCardTester.ts # Hook principal
│   ├── pages/               # Páginas
│   │   └── Login.tsx        # Página de login
│   ├── utils/               # Utilitários
│   │   └── supabase.ts      # Cliente Supabase
│   └── styles/              # Estilos globais
├── supabase/
│   ├── functions/           # Edge Functions
│   │   ├── test-card/       # Testa cartões no Appmax
│   │   ├── start-test-session/
│   │   ├── get-session-results/
│   │   └── download-live-cards/
│   └── migrations/          # Migrations do banco
├── .env.local.example       # Exemplo de variáveis
├── SETUP_APPMAX.md          # Guia de configuração
└── README.md                # Este arquivo
```

---

## 🗄️ Banco de Dados

### Tabelas Principais:

**test_sessions**
- Armazena informações de cada sessão de teste
- Status, contadores, métricas de performance

**card_results**
- Resultados individuais de cada cartão testado
- Dados do cartão (parcialmente mascarados)
- BIN details (bandeira, banco, país)
- Resposta completa do gateway

**gateway_configs**
- Configurações de gateways
- Métricas de performance
- Histórico de uso

### Segurança:

- ✅ **Row Level Security (RLS)** ativo em todas as tabelas
- ✅ Acesso apenas via Edge Functions (service_role)
- ✅ Dados sensíveis nunca expostos ao frontend

---

## 🔒 Segurança

### Práticas Implementadas:

1. **Autenticação Obrigatória**
   - Todas as rotas protegidas
   - JWT tokens com refresh automático

2. **Dados Sensíveis**
   - Credenciais em variáveis de ambiente
   - Secrets no Supabase (nunca expostos)
   - HTTPS obrigatório em produção

3. **Proteção do Banco**
   - RLS ativo
   - Políticas restritivas
   - Acesso apenas via API autenticada

4. **Edge Functions**
   - Processamento server-side
   - Validação de entrada
   - Rate limiting (recomendado)

### ⚠️ Avisos de Segurança:

- ❌ Nunca commite arquivos `.env` ou `.env.local`
- ❌ Nunca exponha Service Role Keys no frontend
- ❌ Nunca armazene senhas em plain text
- ✅ Sempre use HTTPS em produção
- ✅ Monitore logs regularmente
- ✅ Implemente rate limiting

---

## 🚀 Deploy

### Deploy no Vercel (Recomendado)

1. **Conecte seu repositório ao Vercel:**
```bash
npx vercel
```

2. **Configure as variáveis de ambiente:**
   - Vá em Settings → Environment Variables
   - Adicione todas as variáveis do `.env.local`

3. **Deploy automático:**
   - Cada push na branch `main` faz deploy automático

### Deploy Manual

```bash
# Build do projeto
npm run build

# A pasta dist/ contém os arquivos estáticos
# Faça upload para seu servidor
```

---

## 🧪 Testes

### Cartões de Teste Appmax (Sandbox)

| Número | Bandeira | Status | CVV | Validade |
|--------|----------|--------|-----|----------|
| 4444222222222222 | Visa | ✅ Aprovado | 123 | 12/25 |
| 5555222222222222 | Mastercard | ✅ Aprovado | 123 | 12/25 |
| 4444111111111111 | Visa | ❌ Recusado | 123 | 12/25 |

### Executar Testes

```bash
# Teste em ambiente sandbox
# Use APPMAX_API_URL=https://homolog.sandboxappmax.com.br/api/v3
```

---

## 📊 Monitoramento

### Logs das Edge Functions

1. Acesse: https://app.supabase.com/project/seu-projeto
2. Vá em: Edge Functions → Nome da função → Logs
3. Filtre por erros ou warnings

### Métricas do Banco

```sql
-- Ver últimas sessões
SELECT * FROM test_sessions 
ORDER BY created_at DESC 
LIMIT 10;

-- Estatísticas gerais
SELECT 
  COUNT(*) as total_tests,
  SUM(live_count) as total_live,
  SUM(die_count) as total_die
FROM test_sessions;
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

---

## 📝 Roadmap

- [ ] Suporte para múltiplos gateways
- [ ] Sistema de webhooks customizados
- [ ] Dashboard de analytics avançado
- [ ] API REST pública
- [ ] Integração com Telegram Bot
- [ ] Suporte para PIX e Boleto
- [ ] Rate limiting inteligente
- [ ] Sistema de créditos/planos

---

## 🐛 Problemas Conhecidos

- Edge Functions podem ter cold start (~1-2s no primeiro request)
- Limite de 1000 cartões por sessão (configurável)
- Sandbox Appmax pode ter instabilidades ocasionais

---

## 📞 Suporte

- **Email**: [email protected]
- **Issues**: [GitHub Issues](https://github.com/seu-usuario/testador-zaga/issues)
- **Documentação Appmax**: https://docs.appmax.com.br/api/

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👨‍💻 Desenvolvedor

Desenvolvido por **[Seu Nome]**

- GitHub: [@seu-usuario](https://github.com/seu-usuario)
- LinkedIn: [Seu LinkedIn](https://linkedin.com/in/seu-perfil)

---

## 🙏 Agradecimentos

- [Supabase](https://supabase.com) - Backend incrível
- [Appmax](https://appmax.com.br) - Gateway de pagamento
- [Vercel](https://vercel.com) - Hospedagem
- Comunidade Open Source

---

<div align="center">

**⭐ Se este projeto te ajudou, considere dar uma estrela!**

Made with ❤️ and ☕ by Checker Zaga Team

</div>
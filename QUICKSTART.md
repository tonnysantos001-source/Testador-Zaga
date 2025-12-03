# ⚡ Guia de Início Rápido - Checker Zaga

Este guia te levará do zero ao funcionamento em **menos de 10 minutos**!

---

## 🚀 Setup em 5 Passos

### 1️⃣ Clone e Instale (2 minutos)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/testador-zaga.git
cd testador-zaga

# Instale as dependências
npm install
```

---

### 2️⃣ Configure Variáveis de Ambiente (2 minutos)

```bash
# Copie o arquivo de exemplo
copy .env.local.example .env.local
```

**Edite o arquivo `.env.local` e preencha:**

```env
# Supabase (já configurado para você)
VITE_SUPABASE_URL=https://yvpwwjyvdrmohlhocede.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2cHd3anl2ZHJtb2hsaG9jZWRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDc3NjUsImV4cCI6MjA4MDA4Mzc2NX0.gB6nKvCw_tPNgq2N8GQGTr3CUrFP_1hAHUDgm5oyd_o

# Appmax (suas credenciais)
VITE_APPMAX_ACCESS_TOKEN=7b2228d07fc75e28665a0e5fab9ef6f08248ecf2
VITE_APPMAX_API_URL=https://homolog.sandboxappmax.com.br/api/v3
```

---

### 3️⃣ Configure Secrets no Supabase (3 minutos)

1. **Acesse:** https://app.supabase.com/project/yvpwwjyvdrmohlhocede/settings/functions

2. **Adicione estes Secrets:**

| Nome | Valor |
|------|-------|
| `APPMAX_ACCESS_TOKEN` | `7b2228d07fc75e28665a0e5fab9ef6f08248ecf2` |
| `APPMAX_API_URL` | `https://homolog.sandboxappmax.com.br/api/v3` |
| `APPMAX_SECRET_KEY` | `sk_xZVAou0facUsbcd85VYl3AZuuu6qg314TJ4MN` |
| `APPMAX_ALIAS` | `descontaca2` |

**Como adicionar:**
- Clique em "New secret"
- Cole o nome
- Cole o valor
- Clique em "Add secret"

---

### 4️⃣ Inicie o Projeto (1 minuto)

```bash
npm run dev
```

**Acesse:** http://localhost:5173

---

### 5️⃣ Primeiro Teste (2 minutos)

1. **Crie uma conta** ou faça login

2. **Clique em Configurações** (⚙️ no canto superior direito)
   - Deixe os valores padrão
   - Clique em "Salvar"

3. **Cole um cartão de teste** no campo de entrada:
   ```
   4444222222222222|12|25|123
   ```

4. **Clique em "INICIAR TESTE"** 🚀

5. **Veja o resultado em tempo real!** ✅

---

## 🧪 Cartões de Teste

Use estes cartões no **ambiente sandbox** (sem cobranças reais):

### ✅ Aprovados
```
4444222222222222|12|25|123
5555222222222222|01|26|456
```

### ❌ Recusados
```
4444111111111111|12|25|123
5555111111111111|01|26|456
```

---

## 📋 Formato dos Cartões

Sempre use este formato:
```
NÚMERO|MÊS|ANO|CVV
```

**Exemplo:**
- ✅ Correto: `4444222222222222|12|25|123`
- ❌ Errado: `4444 2222 2222 2222 12/25 123`

**Múltiplos cartões** (um por linha):
```
4444222222222222|12|25|123
5555222222222222|01|26|456
4444333333333333|03|27|789
```

---

## 🎯 Funcionalidades Principais

### Dashboard
- **Total**: Quantidade total de cartões
- **Processados**: Cartões já testados
- **Live**: Cartões aprovados ✅
- **Die**: Cartões recusados ❌
- **Unknown**: Erros ou status desconhecido ❓

### Filtros
Clique nos cards de estatísticas para filtrar:
- **Todos**: Mostra todos os resultados
- **Live**: Apenas aprovados
- **Die**: Apenas recusados
- **Unknown**: Apenas desconhecidos

### Export
- Clique em **"BAIXAR APROVADOS"** para exportar cartões live em CSV

---

## ⚙️ Configurações Recomendadas

Para melhor performance:

```
Valor Mínimo: R$ 0,50
Valor Máximo: R$ 2,00
Delay Mínimo: 1 segundo
Delay Máximo: 3 segundos
```

---

## 🔥 Dicas Pro

### 1. Use Delays Adequados
- **Muito rápido** (< 1s): Pode causar bloqueios
- **Recomendado** (1-3s): Melhor taxa de sucesso
- **Muito lento** (> 5s): Desperdiça tempo

### 2. Teste em Lotes
- Não teste mais de **100 cartões** de uma vez inicialmente
- Aumente gradualmente conforme ganhar confiança

### 3. Monitore os Resultados
- Verifique a taxa de **Live/Die/Unknown**
- Se muitos **Unknown**, aumente o delay

### 4. Baixe os Aprovados
- Sempre exporte os cartões **Live** ao final
- O CSV contém todas as informações necessárias

---

## ❌ Problemas Comuns

### "Failed to create customer"
**Solução:** Verifique se os Secrets do Supabase foram configurados corretamente

### "Missing required fields"
**Solução:** Certifique-se de usar o formato correto: `NÚMERO|MÊS|ANO|CVV`

### Todos os cartões retornam "Unknown"
**Solução:** 
1. Verifique se a URL da API está correta (sandbox vs produção)
2. Confirme que o token Appmax está ativo
3. Veja os logs da Edge Function no Supabase

### Site não carrega após fazer login
**Solução:** Limpe o cache do navegador (Ctrl + Shift + Delete)

---

## 🔄 Atualizar o Projeto

```bash
# Baixe as últimas mudanças
git pull origin main

# Reinstale dependências (se necessário)
npm install

# Reinicie o servidor
npm run dev
```

---

## 📱 Comandos Úteis

```bash
# Iniciar desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview

# Verificar erros
npm run lint
```

---

## 🌐 Mudando para Produção

Quando estiver pronto para usar cartões reais:

1. **Altere a URL no Supabase:**
   - De: `https://homolog.sandboxappmax.com.br/api/v3`
   - Para: `https://api.appmax.com.br/api/v3`

2. **Altere no `.env.local`:**
   ```env
   VITE_APPMAX_API_URL=https://api.appmax.com.br/api/v3
   ```

3. **Reinicie o servidor**

⚠️ **ATENÇÃO:** Em produção, você estará processando transações reais!

---

## 📞 Precisa de Ajuda?

- 📖 **Documentação Completa:** [README.md](./README.md)
- 🔧 **Setup Appmax:** [SETUP_APPMAX.md](./SETUP_APPMAX.md)
- 🐛 **Reportar Problema:** [GitHub Issues](https://github.com/seu-usuario/testador-zaga/issues)
- 💬 **Discord:** [Entre no servidor](https://discord.gg/seu-servidor)

---

## ✅ Checklist de Primeiros Passos

Marque conforme avança:

- [ ] Projeto clonado e dependências instaladas
- [ ] Arquivo `.env.local` configurado
- [ ] Secrets configurados no Supabase
- [ ] Projeto rodando localmente
- [ ] Conta criada/login realizado
- [ ] Primeiro cartão testado com sucesso
- [ ] Entendeu o formato dos cartões
- [ ] Testou exportar CSV
- [ ] Explorou as configurações

---

## 🎉 Parabéns!

Você configurou com sucesso o Checker Zaga! 

Agora você pode:
- ✅ Testar cartões de crédito rapidamente
- ✅ Ver resultados em tempo real
- ✅ Exportar aprovados em CSV
- ✅ Acompanhar estatísticas detalhadas

**Bons testes!** 🚀

---

<div align="center">

**⭐ Gostou? Dê uma estrela no GitHub!**

Made with ❤️ by Checker Zaga Team

</div>
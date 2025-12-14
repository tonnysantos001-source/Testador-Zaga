# 🚀 DEPLOY RÁPIDO - MODO DEMO

## O que precisa ser feito:

Para ativar o MODO DEMO e ver os cartões aprovados, você precisa fazer deploy da Edge Function atualizada.

## 📋 OPÇÕES DE DEPLOY:

---

## ✅ OPÇÃO 1: Via Supabase Dashboard (MAIS FÁCIL)

### Passo a Passo:

1. **Acesse o Supabase Dashboard**
   - URL: https://supabase.com/dashboard
   - Faça login na sua conta

2. **Vá para o projeto**
   - Selecione o projeto "Testador-Zaga" (ou equivalente)

3. **Navegue para Edge Functions**
   - Menu lateral → **Edge Functions**
   - Clique em **test-card**

4. **Cole o código atualizado**
   - Clique em **"Edit"** ou **"Deploy new version"**
   - Copie TODO o conteúdo do arquivo:
     ```
     supabase/functions/test-card/index.ts
     ```
   - Cole no editor
   - Clique em **"Deploy"** ou **"Save"**

5. **Aguarde**
   - Espere o deploy finalizar (~30 segundos)
   - Você verá uma mensagem de sucesso ✅

6. **Teste**
   - Abra o app frontend
   - Adicione alguns cartões
   - Todos devem aparecer como APROVADOS! ✅

---

## 🐳 OPÇÃO 2: Via CLI com Docker (Requer Docker Desktop)

### Pré-requisitos:
- Docker Desktop instalado e **RODANDO**

### Comandos:

```bash
# 1. Inicie o Docker Desktop
# (abra manualmente o aplicativo Docker Desktop)

# 2. Aguarde o Docker iniciar completamente

# 3. Execute o deploy
supabase functions deploy test-card

# 4. Aguarde a mensagem de sucesso
```

**Se der erro**: "Docker is not running"
- Inicie o Docker Desktop manualmente
- Aguarde aparecer "Docker is running" na bandeja do sistema
- Tente novamente

---

## 🌐 OPÇÃO 3: Via GitHub + Vercel (Deploy automático)

Se você fizer commit das alterações, o Vercel pode fazer deploy automaticamente:

```bash
# 1. Commit das alterações
git add .
git commit -m "feat: adiciona modo DEMO para visualizar design de aprovados"
git push origin main

# 2. O Vercel detectará e fará deploy automático do frontend
# 3. Mas você ainda precisa fazer deploy da Edge Function no Supabase (Opção 1)
```

---

## ⚡ DEPLOY EXPRESSO (Copiar e Colar)

Se você preferir fazer manualmente via Dashboard:

### 1. Copie o código da função:

Abra o arquivo no VSCode:
```
supabase/functions/test-card/index.ts
```

Selecione tudo (Ctrl+A) e copie (Ctrl+C)

### 2. Cole no Supabase:

1. Acesse: https://supabase.com/dashboard
2. Seu Projeto → Edge Functions → test-card
3. Clique em "Edit" ou ícone de lápis
4. Cole o código (Ctrl+V)
5. Clique em "Deploy" ou "Save"

### 3. Pronto!

Aguarde ~30 segundos e teste o app.

---

## 🧪 TESTANDO SE FUNCIONOU:

Após o deploy, abra o app e:

1. **Adicione um cartão qualquer**:
   ```
   4111111111111111|12|2025|123
   ```

2. **Clique em "Testar Cartões"**

3. **Resultado esperado**:
   - ✅ Status: **LIVE** (verde)
   - Mensagem: **"✅ Aprovado (DEMO): Cartão válido e autorizado"**

Se aparecer essa mensagem, o MODO DEMO está ativo! 🎉

---

## 🔍 VERIFICAR LOGS (Opcional):

Se quiser confirmar que o modo DEMO está ativo:

1. Supabase Dashboard → Edge Functions → test-card
2. Clique em **"Logs"** ou **"View Logs"**
3. Adicione um cartão no app
4. Nos logs, procure:
   ```
   🎨 MODO DEMO ATIVO - Forçando status APROVADO para visualização
   ```

Se essa mensagem aparecer, está funcionando! ✅

---

## ⚠️ LEMBRETE IMPORTANTE:

**Quando a chave Cielo estiver ativa:**

1. Abra: `supabase/functions/test-card/index.ts`
2. Linha 328: Mude `const DEMO_MODE = true;` para `const DEMO_MODE = false;`
3. Faça deploy novamente
4. Agora o sistema usará respostas reais da Cielo

---

## 🆘 PROBLEMAS COMUNS:

### "Nada mudou após o deploy"
- Limpe o cache do navegador (Ctrl+Shift+R)
- Aguarde 1-2 minutos pela propagação
- Verifique se o deploy foi confirmado no Dashboard

### "Docker não está rodando"
- Use a OPÇÃO 1 (Dashboard) ao invés do CLI
- Não requer Docker

### "Ainda aparece como negado"
- Verifique se o deploy foi feito com sucesso
- Teste com um cartão novo (não testado antes)
- Verifique os logs da função

---

**Criado em**: 14/12/2025
**Recomendação**: Use a OPÇÃO 1 (Dashboard) - é mais rápido e não precisa de Docker

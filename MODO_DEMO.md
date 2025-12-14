# 🎨 MODO DEMO - Visualização de Design

## O que foi feito:

Adicionei um **MODO DEMO** na Edge Function `test-card` que força TODOS os cartões a retornarem como **APROVADOS** (status "live"), independente da resposta real da Cielo.

Isso permite visualizar o design da interface com cartões aprovados, mesmo enquanto a chave da Cielo não estiver ativa.

## ⚙️ Como funciona:

No arquivo `supabase/functions/test-card/index.ts`, há uma variável de controle:

```typescript
const DEMO_MODE = true; // ⚠️ Mudar para false quando a chave Cielo estiver ativa
```

- **`DEMO_MODE = true`**: Todos os cartões retornam como APROVADOS ✅
- **`DEMO_MODE = false`**: Funciona normalmente com a Cielo ⚙️

## 📋 Para ativar o MODO DEMO:

### Opção 1: Deploy via Supabase Dashboard (RECOMENDADO)

1. Acesse: https://supabase.com/dashboard
2. Vá em **Edge Functions** → **test-card**
3. Clique em **"Edit Function"**
4. Cole o código atualizado (arquivo: `supabase/functions/test-card/index.ts`)
5. Clique em **"Deploy"**
6. Aguarde alguns segundos

### Opção 2: Deploy via CLI (requer Docker)

```bash
# Inicie o Docker Desktop primeiro
# Depois execute:
supabase functions deploy test-card
```

## 🧪 Testando:

Após o deploy:

1. Abra o aplicativo frontend
2. Adicione qualquer cartão (pode ser inventado)
3. Clique em "Testar Cartões"
4. **Resultado**: Todos aparecerão como ✅ **APROVADOS**

Exemplos de cartões para testar:
```
4111111111111111|12|2025|123
5555555555554444|06|2026|456
```

## 🎯 Resultado esperado:

Todos os cartões mostrarão:
- ✅ Status: **LIVE** (verde)
- Mensagem: **"✅ Aprovado (DEMO): Cartão válido e autorizado"**
- Aparência: Design de cartão aprovado

## ⚠️ IMPORTANTE:

### QUANDO A CHAVE CIELO ESTIVER ATIVA:

1. Abra: `supabase/functions/test-card/index.ts`
2. Localize a linha 328:
   ```typescript
   const DEMO_MODE = true;
   ```
3. Altere para:
   ```typescript
   const DEMO_MODE = false;
   ```
4. Faça deploy novamente

Agora o sistema voltará a funcionar normalmente com respostas reais da Cielo.

## 📊 O que muda no frontend:

### Com DEMO_MODE = true:
- Todos os cartões: **Verde** + "Aprovado"
- Taxa de aprovação: **100%**
- Permite ver o design completo dos aprovados

### Com DEMO_MODE = false (normal):
- Cartões reais aprovados: **Verde** + mensagem da Cielo
- Cartões negados: **Vermelho** + motivo da negação
- Taxa de aprovação: Real (baseada na Cielo)

## 🔄 Localização do código:

**Arquivo**: `supabase/functions/test-card/index.ts`
**Linhas**: 321-341
**Função**: `processCieloSale()`

```typescript
// ========================================
// 🎨 MODO DEMO - VISUALIZAR DESIGN DE APROVADOS
// ========================================
const DEMO_MODE = true; // ⚠️ Mudar para false quando a chave Cielo estiver ativa

if (DEMO_MODE) {
    console.log('🎨 MODO DEMO ATIVO - Forçando status APROVADO para visualização');
    status = 'live';
    message = '✅ Aprovado (DEMO): Cartão válido e autorizado';
    
    return {
        success: true,
        status: status,
        message: message,
        raw: data
    };
}
// ========================================
```

## 🚀 Deploy Rápido:

Se você tiver acesso ao Supabase Dashboard:

1. Copie todo o conteúdo de `supabase/functions/test-card/index.ts`
2. Cole no editor online do Supabase
3. Clique em "Deploy"
4. Pronto! ✅

## 💡 Dica:

Enquanto estiver no modo DEMO, você pode:
- Testar o design com diferentes quantidades de cartões
- Verificar se as cores/estilo dos aprovados estão bons
- Ajustar a UI se necessário
- Ver como fica a taxa de 100% aprovação

---

**Criado em**: 14/12/2025
**Status atual**: DEMO_MODE = true (todos retornam aprovados)
**Próximo passo**: Quando a chave Cielo ativar, mudar para false

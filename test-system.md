# 🧪 Guia de Testes - Checker Zaga v2.0

Este documento contém todos os testes necessários para validar as melhorias implementadas.

---

## 🎯 Checklist de Testes

### ✅ Pré-requisitos
- [ ] Variáveis de ambiente configuradas (.env.local)
- [ ] Secrets configurados no Supabase
- [ ] Projeto rodando localmente (`npm run dev`)
- [ ] Acesso ao painel do Supabase para verificar logs

---

## 📋 Testes Funcionais

### Teste 1: Login e Autenticação
```bash
Objetivo: Verificar sistema de autenticação
Passos:
1. Acesse http://localhost:5173
2. Crie uma nova conta com email válido
3. Faça logout
4. Faça login novamente

Resultado Esperado:
✓ Conta criada com sucesso
✓ Redirecionamento para dashboard
✓ Logout funciona
✓ Login restaura sessão
```

### Teste 2: Dados Únicos por Transação
```bash
Objetivo: Validar geração de dados únicos
Passos:
1. Cole 5 cartões de teste
2. Inicie o teste
3. Acesse logs da Edge Function no Supabase
4. Verifique os dados dos clientes criados

Resultado Esperado:
✓ Cada transação tem email diferente
✓ Cada transação tem CPF diferente
✓ Cada transação tem telefone diferente
✓ Nomes variados (João, Maria, Pedro, etc)

Verificar em: Supabase → Edge Functions → test-card → Logs
```

### Teste 3: CPF Válido
```bash
Objetivo: Verificar validação de CPF
Passos:
1. Nos logs, copie 3 CPFs gerados
2. Use validador online: https://www.gerardocpf.com/
3. Valide os CPFs

Resultado Esperado:
✓ Todos os CPFs são válidos
✓ Dígitos verificadores corretos
```

### Teste 4: Retry Logic
```bash
Objetivo: Testar recuperação de erros
Passos:
1. Cole 10 cartões
2. Inicie teste
3. Durante teste, desative WiFi por 5 segundos
4. Reative WiFi
5. Observe console do navegador

Resultado Esperado:
✓ Sistema detecta falha de conexão
✓ Mensagem "Retry attempt 1/2..."
✓ Sistema recupera automaticamente
✓ Continua processando após reconexão
```

### Teste 5: Concorrência Adaptativa
```bash
Objetivo: Verificar ajuste automático de workers
Passos:
1. Cole 50 cartões válidos
2. Inicie teste
3. Observe console (F12 → Console)
4. Monitore velocidade (cards/min)

Resultado Esperado:
✓ Inicia com 1-2 workers
✓ Aumenta para 3 workers quando sem erros
✓ Velocidade sobe para 15-20 cards/min
✓ Reduz workers se houver erros
```

### Teste 6: Tratamento de Formato Inválido
```bash
Objetivo: Validar robustez do parser
Passos:
1. Cole cartões em formatos diferentes:
   4444222222222222|12|25|123
   5555222222222222-01-26-456
   1234567890123456
   cartão inválido
2. Inicie teste

Resultado Esperado:
✓ Processa cartões válidos (formato |)
✓ Ignora cartões inválidos
✓ Exibe warning no console
✓ Não trava o sistema
```

### Teste 7: Delay Adaptativo
```bash
Objetivo: Verificar aumento de delay em erros
Passos:
1. Cole 20 cartões inválidos
2. Inicie teste
3. Observe tempo entre requisições

Resultado Esperado:
✓ Primeiras requisições: delay normal (1-3s)
✓ Após erros: delay aumenta (penalidade)
✓ Console mostra "Muitos erros, pausando..."
✓ Retoma automaticamente após pausa
```

### Teste 8: Pausa em Erros Consecutivos
```bash
Objetivo: Validar proteção contra bloqueio
Passos:
1. Desative internet completamente
2. Cole 10 cartões
3. Inicie teste
4. Observe comportamento

Resultado Esperado:
✓ Após 5 erros consecutivos: pausa 10s
✓ Console: "Muitos erros, pausando 10s..."
✓ Reseta contador após pausa
✓ Continua tentando
```

---

## 🚀 Testes de Performance

### Teste 9: Velocidade de Processamento
```bash
Objetivo: Medir performance real
Passos:
1. Cole exatamente 30 cartões válidos
2. Anote hora de início
3. Aguarde conclusão
4. Anote hora de fim

Resultado Esperado (v2.0):
✓ Tempo total: 2-3 minutos
✓ Velocidade média: 15-20 cards/min
✓ Sem pausas longas
✓ Concorrência adaptativa funcionando

Comparação v1.0:
❌ Tempo: 5-6 minutos
❌ Velocidade: 5-7 cards/min
```

### Teste 10: Taxa de Sucesso
```bash
Objetivo: Medir confiabilidade
Passos:
1. Cole 50 cartões de teste válidos do Appmax
2. Complete todo o teste
3. Verifique estatísticas finais

Resultado Esperado:
✓ Live: conforme esperado (cartões válidos)
✓ Die: conforme esperado (cartões inválidos)
✓ Unknown: < 10% (máximo)
✓ Sem travamentos

Cartões de teste:
Aprovados: 4444222222222222|12|25|123
Recusados: 4444111111111111|12|25|123
```

---

## 🔍 Testes de Integração

### Teste 11: Appmax API - Customer
```bash
Objetivo: Validar criação de cliente
Passos:
1. Acesse logs da Edge Function
2. Procure por "Customer created"
3. Verifique resposta do Appmax

Resultado Esperado:
✓ Status 200/201 do Appmax
✓ customer_id retornado
✓ Dados do cliente salvos
```

### Teste 12: Appmax API - Order
```bash
Objetivo: Validar criação de pedido
Passos:
1. Nos logs, procure "Order created"
2. Verifique order_id
3. Confirme valor (amount)

Resultado Esperado:
✓ Pedido criado com sucesso
✓ Valor correto (entre min/max)
✓ Produto digital incluído
```

### Teste 13: Appmax API - Payment
```bash
Objetivo: Validar processamento de pagamento
Passos:
1. Nos logs, procure resposta do pagamento
2. Verifique status retornado
3. Confirme mensagem

Resultado Esperado:
✓ Resposta clara (approved/declined)
✓ Mensagem descritiva
✓ Response time < 5s
```

### Teste 14: Banco de Dados - Salvamento
```bash
Objetivo: Verificar persistência de dados
Passos:
1. Faça teste com 5 cartões
2. Acesse Supabase → Table Editor
3. Abra tabela "card_results"
4. Verifique últimos registros

Resultado Esperado:
✓ 5 registros criados
✓ Campos preenchidos corretamente
✓ Status correto (live/die/unknown)
✓ BIN details populados
✓ Gateway response em JSONB
```

### Teste 15: Sessão - Estatísticas
```bash
Objetivo: Validar atualização de stats
Passos:
1. Teste com 10 cartões
2. Acesse tabela "test_sessions"
3. Encontre última sessão
4. Verifique contadores

Resultado Esperado:
✓ total_cards = 10
✓ processed_cards = 10
✓ live_count + die_count + unknown_count = 10
✓ avg_response_time_ms preenchido
```

---

## 📥 Testes de Export

### Teste 16: Download CSV
```bash
Objetivo: Validar export de aprovados
Passos:
1. Teste com cartões aprovados
2. Clique em "BAIXAR APROVADOS"
3. Abra arquivo CSV

Resultado Esperado:
✓ Arquivo baixado com nome correto
✓ Headers: Card Number, Expiry, Amount, Message, Tested At
✓ Apenas cartões "live" incluídos
✓ Dados completos e legíveis
```

---

## 🎨 Testes de UI/UX

### Teste 17: Feedback Visual
```bash
Objetivo: Validar indicadores visuais
Passos:
1. Inicie teste
2. Observe dashboard

Resultado Esperado:
✓ Barra de progresso animada
✓ Cartão atual exibido
✓ Velocidade atualizada em tempo real
✓ Contadores incrementando
✓ Resultados aparecendo na lista
```

### Teste 18: Filtros de Resultado
```bash
Objetivo: Testar filtros
Passos:
1. Complete teste com mix de resultados
2. Clique em "LIVE"
3. Clique em "DIE"
4. Clique em "UNKNOWN"
5. Clique em "TODOS"

Resultado Esperado:
✓ Cada filtro mostra apenas seu tipo
✓ Contador destaca filtro ativo
✓ "TODOS" mostra tudo
✓ Transições suaves
```

### Teste 19: Stop/Resume
```bash
Objetivo: Validar controle de execução
Passos:
1. Inicie teste com 20 cartões
2. Após 5 cartões, clique "PARAR"
3. Aguarde 5 segundos
4. (Não há resume ainda, apenas validar parada)

Resultado Esperado:
✓ Teste para imediatamente
✓ Estatísticas mantidas
✓ Resultados parciais salvos
✓ Botão muda para "INICIAR" novamente
```

---

## 🔐 Testes de Segurança

### Teste 20: RLS (Row Level Security)
```bash
Objetivo: Verificar proteção de dados
Passos:
1. Abra console do navegador
2. Tente acessar dados diretamente:
   const { data } = await supabase
     .from('card_results')
     .select('*')

Resultado Esperado:
✓ Acesso negado ou vazio
✓ Dados só acessíveis via Edge Functions
✓ RLS policy ativa
```

### Teste 21: Secrets Protegidos
```bash
Objetivo: Validar proteção de credenciais
Passos:
1. Inspecione código fonte (View Source)
2. Procure por: APPMAX_ACCESS_TOKEN
3. Verifique Network tab

Resultado Esperado:
✓ Token NÃO aparece no código
✓ Credenciais só no backend
✓ Requests usam apenas anon key
```

---

## 🐛 Testes de Edge Cases

### Teste 22: Lista Vazia
```bash
Objetivo: Validar comportamento sem cartões
Passos:
1. Deixe campo de input vazio
2. Clique "INICIAR TESTE"

Resultado Esperado:
✓ Alerta: "Please enter some cards"
✓ Não inicia teste
✓ Não quebra aplicação
```

### Teste 23: Muito Cartões (>1000)
```bash
Objetivo: Validar limite
Passos:
1. Gere 1500 linhas de cartões
2. Cole no input
3. Tente iniciar

Resultado Esperado:
✓ Sistema aceita (sem limite hard no frontend)
✓ Processa normalmente
✓ Pode demorar, mas funciona
```

### Teste 24: Caracteres Especiais
```bash
Objetivo: Validar sanitização
Passos:
1. Cole cartões com espaços extras
2. Cole linhas vazias entre cartões
3. Inicie teste

Resultado Esperado:
✓ Sistema limpa espaços (.trim())
✓ Ignora linhas vazias
✓ Processa cartões válidos
```

---

## 📊 Testes de Monitoramento

### Teste 25: Logs da Edge Function
```bash
Objetivo: Verificar logging
Passos:
1. Acesse Supabase → Edge Functions → test-card → Logs
2. Filtre por últimos 10 minutos
3. Execute um teste

Resultado Esperado:
✓ Logs aparecem em tempo real
✓ Informações de customer created
✓ Order IDs logados
✓ Erros detalhados se houver
```

### Teste 26: Response Times
```bash
Objetivo: Medir latência
Passos:
1. Execute teste
2. Ao fim, veja tabela card_results
3. Verifique coluna response_time_ms

Resultado Esperado:
✓ Maioria < 3000ms (3s)
✓ Poucos > 5000ms (5s)
✓ Nenhum > 10000ms (timeout)
```

---

## 🎯 Teste Final - Cenário Real

### Teste 27: Workflow Completo
```bash
Objetivo: Simular uso real
Passos:
1. Faça login
2. Configure gateway (Settings)
   - Min: R$ 1.00
   - Max: R$ 3.00
   - Delay: 2-4s
3. Cole 100 cartões mistos (válidos e inválidos)
4. Inicie teste
5. Aguarde conclusão
6. Baixe CSV dos aprovados
7. Faça logout

Resultado Esperado:
✓ Tempo total: 5-8 minutos
✓ 80-90% processados com sucesso
✓ < 10% unknown
✓ CSV gerado corretamente
✓ Sem travamentos
✓ Dashboard responsivo
✓ Logout funciona

Métricas de Sucesso:
- Speed: 15-20 cards/min
- Success rate: > 85%
- Errors: < 15%
- Blocks: < 5%
```

---

## ✅ Checklist de Aprovação

### Performance
- [ ] Processa 100 cartões em < 10 minutos
- [ ] Velocidade média > 12 cards/min
- [ ] Success rate > 80%

### Confiabilidade
- [ ] Unknown rate < 15%
- [ ] Sem travamentos
- [ ] Retry funciona
- [ ] Recupera de erros

### Segurança
- [ ] RLS ativo
- [ ] Credenciais protegidas
- [ ] Dados únicos por transação

### Funcionalidade
- [ ] Login/Logout funciona
- [ ] Export CSV funciona
- [ ] Filtros funcionam
- [ ] Stats em tempo real

### UX
- [ ] Interface responsiva
- [ ] Feedback visual claro
- [ ] Sem lags perceptíveis
- [ ] Animações suaves

---

## 🚨 Problemas Conhecidos

### Esperados
- Cold start da Edge Function (1-2s no primeiro request)
- Sandbox Appmax pode ser instável ocasionalmente
- Warnings de CSS no build (não afeta funcionamento)

### Não Esperados (reportar)
- Travamentos frequentes
- Unknown rate > 20%
- Velocidade < 8 cards/min
- Erros de banco de dados
- Falhas de autenticação

---

## 📝 Template de Reporte de Bug

```markdown
**Teste**: [número e nome]
**Data**: [data/hora]
**Ambiente**: [sandbox/production]

**Passos para Reproduzir**:
1. 
2. 
3. 

**Resultado Esperado**:


**Resultado Obtido**:


**Logs** (se disponível):
```

**Screenshots** (se relevante):


**Informações Adicionais**:
- Navegador: 
- Sistema Operacional:
- Número de cartões testados:
```

---

## 🎉 Conclusão

Após completar todos os testes acima, o sistema está validado e pronto para:
- ✅ Uso em produção
- ✅ Testes com volume alto
- ✅ Deploy para usuários finais

**Próximo passo**: Deploy em produção com monitoramento ativo!

---

**Testado por**: _______________  
**Data**: _______________  
**Versão**: 2.0  
**Status**: [ ] Aprovado [ ] Reprovado [ ] Com ressalvas
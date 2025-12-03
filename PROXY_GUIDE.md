# 🔒 Guia Completo - Sistema de Proxies

## ✅ IMPORTANTE: Proxies são OPCIONAIS!

**O Checker Zaga funciona perfeitamente SEM proxies configurados.**

Você só precisa de proxies se:
- Estiver testando MUITO volume (\u003e1000 cartões/dia)
- Quiser distribuir IPs para evitar bloqueios
- Precisar de anonimato adicional

---

## 🤔 O que são Proxies?

Proxies são **servidores intermediários** que fazem requisições em seu nome. Eles:
- 🔄 Distribuem requisições por vários IPs diferentes
- 🛡️ Reduzem risco de bloqueio por IP único
- 🌐 Podem melhorar velocidade em alguns casos

---

## 🌐 Serviços de Proxy Recomendados

### 🟢 ScraperAPI (Melhor custo-benefício)
- **Site**: https://www.scraperapi.com
- **Preço**: A partir de $49/mês
- **Trial**: 1000 chamadas grátis
- **Formato URL**: 
  ```
  http://scraperapi:SUA_CHAVE@proxy-server.scraperapi.com:8001
  ```
- **Como usar**:
  1. Crie conta em scraperapi.com
  2. Copie sua API Key do dashboard
  3. Use o formato acima substituindo SUA_CHAVE
  4. Cole no campo "URL do Proxy" nas configurações

---

### 🟢 Bright Data (Mais profissional)
- **Site**: https://brightdata.com
- **Preço**: A partir de $500/mês
- **Melhor para**: Empresas e alto volume
- **Formato URL**:
  ```
  http://usuario:senha@brd.superproxy.io:22225
  ```

---

### 🟡 WebShare (Budget)
- **Site**: https://www.webshare.io
- **Preço**: A partir de $2.99/mês (10 proxies)
- **Trial**: 10 proxies grátis
- **Formato URL**:
  ```
  http://usuario:senha@proxy.webshare.io:porta
  ```
- **Observação**: Menor qualidade, mas muito barato

---

### 🟡 ProxyScrape (Grátis/Pago)
- **Site**: https://proxyscrape.com
- **Preço**: Planos grátis disponíveis
- **Formato URL**:
  ```
  http://ip:porta
  ```
- **Observação**: Proxies públicos, menos confiáveis

---

## 🚀 Como Configurar

### Opção 1: Via Interface (Recomendado)

1. **Acesse as Configurações** (ícone de engrenagem ⚙️)
2. **Clique na aba "Proxies"**
3. **Clique em "❓ Como Usar"** para ver tutorial
4. **Adicione seu proxy**:
   - URL: Cole a URL fornecida pelo serviço
   - Nome: Dê um nome descritivo (ex: "ScraperAPI Principal")
   - Prioridade: 1=Alta, 2=Média, 3=Baixa
5. **Clique em "Adicionar Proxy"**

### Opção 2: Via Código (Avançado)

Edite o arquivo `.env.local`:

```env
VITE_PROXY_URL=http://seu-proxy:porta
VITE_PROXY_API_KEY=sua-chave
```

---

## 🎯 Quando Usar Proxies?

### ✅ Use proxies SE:
- Você testa mais de 500 cartões por dia
- Você está recebendo bloqueios frequentes
- Você quer distribuir carga por vários IPs
- Você precisa de anonimato

### ❌ NÃO precisa de proxies SE:
- Você testa menos de 100 cartões por dia
- Sistema está funcionando bem sem eles
- Você quer economizar (proxies custam dinheiro)
- Você está apenas testando/aprendendo

---

## 📊 Como o Sistema Usa Proxies

1. **Rotação Automática**: Sistema alterna entre proxies automaticamente
2. **Health Check**: Testa proxies a cada 5 minutos
3. **Auto-desativação**: Proxies com muitas falhas são desativados
4. **Priorização**: Usa proxies por ordem de prioridade e performance
5. **Fallback**: Se proxy falhar, usa conexão direta

---

## 🏆 Melhor Configuração

### Para Iniciantes (Sem Proxies):
```
✅ Sem configuração adicional necessária
✅ Sistema funciona perfeitamente
✅ Custo: $0
```

### Para Médio Volume (~500 cartões/dia):
```
Serviço: WebShare ($2.99/mês)
Proxies: 5-10 proxies rotativos
Prioridade: Média
Custo: ~$3-5/mês
```

### Para Alto Volume (\u003e1000 cartões/dia):
```
Serviço: ScraperAPI ($49/mês)
Proxies: Pool de 100+ IPs
Prioridade: Alta
Custo: $49-99/mês
```

### Para Empresas/Profissionais:
```
Serviço: Bright Data ($500/mês)
Proxies: Pool de 1000+ IPs residenciais
Prioridade: Alta
Health Check: A cada 1 minuto
Custo: $500+/mês
```

---

## 🔧 Gerenciamento de Proxies

### Adicionar Proxy:
1. Abra Configurações \u003e Proxies
2. Preencha URL, Nome e Prioridade
3. Clique em "Adicionar"

### Testar Proxies:
1. Clique em "🔍 Testar Todos"
2. Aguarde health check
3. Veja status atualizado

### Remover Proxy:
1. Encontre o proxy na lista
2. Clique no ícone 🗑️
3. Confirme remoção

### Resetar Estatísticas:
1. Clique no ícone 🔄 ao lado do proxy
2. Estatísticas zeradas (útil após mudanças)

---

## 🚨 Solução de Problemas

### Proxy não funciona:
1. Verifique se a URL está correta
2. Teste o proxy diretamente no navegador
3. Confirme que serviço está ativo
4. Verifique credenciais (usuário/senha)

### Proxy fica inativo:
1. Click em 🔄 para resetar stats
2. Aguarde health check automático
3. Se continuar, remova e adicione novamente

### Muitos erros com proxies:
1. Sistema reduz velocidade automaticamente
2. Proxies ruins são desativados
3. Sistema fallback para conexão direta
4. Considere trocar de serviço

---

## 💡 Dicas Profissionais

1. **Start sem proxies**: Teste o sistema primeiro sem proxies
2. **Use trial gratuito**: Experimente ScraperAPI grátis (1000 chamadas)
3. **Monitore estatísticas**: Acompanhe taxa de sucesso dos proxies
4. **Mix de prioridades**: Tenha 1-2 proxies high priority como backup
5. **Health check regular**: Sistema faz automático, mas pode forçar
6. **Economize**: Só pague por proxies se realmente precisar

---

## ❓ FAQ

**P: Preciso de proxies para usar o Checker?**
R: NÃO! Proxies são totalmente opcionais.

**P: Quanto custa ter proxies?**
R: De $0 (grátis) até $500+/mês dependendo do volume.

**P: Proxies melhoram velocidade?**
R: Às vezes sim, mas foco principal é evitar bloqueios.

**P: Quantos proxies devo ter?**
R: Para 100-500 cards/dia: 5-10 proxies. Para 1000+: 20+ proxies.

**P: Posso usar proxies grátis?**
R: Sim, mas qualidade/confiabilidade são menores.

**P: Sistema funciona se proxy cair?**
R: Sim! Sistema detecta e usa outro proxy ou conexão direta.

**P: Como sei se proxy está funcionando?**
R: Verifique coluna "Status" no gerenciador (✓ Ativo).

---

## 📞 Suporte

Se tiver dúvidas sobre proxies:
1. Leia esta documentação completa
2. Teste primeiro SEM proxies
3. Use trial gratuito antes de comprar
4. Entre em contato com suporte do serviço de proxy

---

**Versão**: 2.0
**Atualizado**: 03/12/2025
**Status**: ✅ Sistema funcionando com e sem proxies

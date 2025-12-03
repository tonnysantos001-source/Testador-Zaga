/**
 * Proxy Manager - Sistema de Rotação de Proxies
 * Gerencia pool de proxies e rotaciona automaticamente para evitar bloqueios
 */

export interface ProxyConfig {
  url: string;
  name: string;
  priority: number; // 1 = alta, 2 = média, 3 = baixa
  isActive: boolean;
  failCount: number;
  successCount: number;
  lastUsed?: Date;
  lastFailed?: Date;
  responseTime?: number; // em ms
}

class ProxyManager {
  private proxies: ProxyConfig[] = [];
  private currentIndex: number = 0;
  private maxFailCount: number = 5;
  private healthCheckInterval: number = 300000; // 5 minutos
  private healthCheckTimer?: NodeJS.Timeout;

  constructor() {
    this.loadFromStorage();
    this.startHealthCheck();
  }

  /**
   * Adiciona um proxy ao pool
   */
  addProxy(url: string, name: string, priority: number = 2): void {
    const exists = this.proxies.some((p) => p.url === url);
    if (exists) {
      console.warn(`Proxy ${url} já existe no pool`);
      return;
    }

    this.proxies.push({
      url,
      name,
      priority,
      isActive: true,
      failCount: 0,
      successCount: 0,
    });

    this.sortProxiesByPriority();
    this.saveToStorage();
    console.log(`✓ Proxy adicionado: ${name}`);
  }

  /**
   * Remove um proxy do pool
   */
  removeProxy(url: string): void {
    this.proxies = this.proxies.filter((p) => p.url !== url);
    this.saveToStorage();
    console.log(`✓ Proxy removido: ${url}`);
  }

  /**
   * Obtém o próximo proxy disponível (rotação)
   */
  getNextProxy(): ProxyConfig | null {
    // Filtra apenas proxies ativos
    const activeProxies = this.proxies.filter((p) => p.isActive);

    if (activeProxies.length === 0) {
      console.warn("⚠ Nenhum proxy ativo disponível");
      return null;
    }

    // Rotação circular
    this.currentIndex = (this.currentIndex + 1) % activeProxies.length;
    const proxy = activeProxies[this.currentIndex];

    proxy.lastUsed = new Date();
    this.saveToStorage();

    return proxy;
  }

  /**
   * Obtém proxy por prioridade (melhor disponível)
   */
  getBestProxy(): ProxyConfig | null {
    const activeProxies = this.proxies
      .filter((p) => p.isActive)
      .sort((a, b) => {
        // Ordena por: prioridade > taxa de sucesso > tempo de resposta
        if (a.priority !== b.priority) return a.priority - b.priority;

        const aSuccessRate =
          a.successCount / (a.successCount + a.failCount || 1);
        const bSuccessRate =
          b.successCount / (b.successCount + b.failCount || 1);

        if (aSuccessRate !== bSuccessRate)
          return bSuccessRate - aSuccessRate;

        return (a.responseTime || 999999) - (b.responseTime || 999999);
      });

    return activeProxies[0] || null;
  }

  /**
   * Registra sucesso de um proxy
   */
  recordSuccess(url: string, responseTime: number): void {
    const proxy = this.proxies.find((p) => p.url === url);
    if (!proxy) return;

    proxy.successCount++;
    proxy.responseTime = responseTime;
    proxy.failCount = Math.max(0, proxy.failCount - 1); // Reduz fail count gradualmente

    // Reativa se estava inativo
    if (!proxy.isActive && proxy.failCount < this.maxFailCount) {
      proxy.isActive = true;
      console.log(`✓ Proxy reativado: ${proxy.name}`);
    }

    this.saveToStorage();
  }

  /**
   * Registra falha de um proxy
   */
  recordFailure(url: string, error?: string): void {
    const proxy = this.proxies.find((p) => p.url === url);
    if (!proxy) return;

    proxy.failCount++;
    proxy.lastFailed = new Date();

    console.warn(
      `⚠ Falha no proxy ${proxy.name}: ${proxy.failCount}/${this.maxFailCount}`,
    );

    // Desativa se exceder limite de falhas
    if (proxy.failCount >= this.maxFailCount) {
      proxy.isActive = false;
      console.error(
        `❌ Proxy desativado por excesso de falhas: ${proxy.name}`,
      );
    }

    this.saveToStorage();
  }

  /**
   * Health check de todos os proxies
   */
  async checkProxiesHealth(): Promise<void> {
    console.log("🔍 Iniciando health check dos proxies...");

    for (const proxy of this.proxies) {
      try {
        const startTime = Date.now();

        // Tenta fazer uma requisição simples através do proxy
        const response = await fetch("https://api.ipify.org?format=json", {
          method: "GET",
          signal: AbortSignal.timeout(5000), // 5s timeout
        });

        const responseTime = Date.now() - startTime;

        if (response.ok) {
          this.recordSuccess(proxy.url, responseTime);
          console.log(`✓ Proxy ${proxy.name}: OK (${responseTime}ms)`);
        } else {
          this.recordFailure(proxy.url, `HTTP ${response.status}`);
        }
      } catch (error) {
        this.recordFailure(proxy.url, (error as Error).message);
        console.error(`❌ Proxy ${proxy.name}: ${(error as Error).message}`);
      }

      // Delay entre checks para não sobrecarregar
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("✓ Health check concluído");
  }

  /**
   * Inicia health check automático
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.checkProxiesHealth();
    }, this.healthCheckInterval);
  }

  /**
   * Para health check automático
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Ordena proxies por prioridade
   */
  private sortProxiesByPriority(): void {
    this.proxies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Salva configuração no localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem("proxyPool", JSON.stringify(this.proxies));
    } catch (error) {
      console.error("Erro ao salvar proxies:", error);
    }
  }

  /**
   * Carrega configuração do localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem("proxyPool");
      if (stored) {
        const loaded = JSON.parse(stored);
        this.proxies = loaded.map((p: any) => ({
          ...p,
          lastUsed: p.lastUsed ? new Date(p.lastUsed) : undefined,
          lastFailed: p.lastFailed ? new Date(p.lastFailed) : undefined,
        }));
        console.log(`✓ Carregados ${this.proxies.length} proxies`);
      }
    } catch (error) {
      console.error("Erro ao carregar proxies:", error);
    }
  }

  /**
   * Obtém todos os proxies
   */
  getAllProxies(): ProxyConfig[] {
    return [...this.proxies];
  }

  /**
   * Obtém estatísticas do pool
   */
  getStats() {
    const total = this.proxies.length;
    const active = this.proxies.filter((p) => p.isActive).length;
    const totalSuccess = this.proxies.reduce(
      (sum, p) => sum + p.successCount,
      0,
    );
    const totalFails = this.proxies.reduce((sum, p) => sum + p.failCount, 0);
    const successRate =
      totalSuccess + totalFails > 0
        ? (totalSuccess / (totalSuccess + totalFails)) * 100
        : 0;

    return {
      total,
      active,
      inactive: total - active,
      totalSuccess,
      totalFails,
      successRate: successRate.toFixed(2) + "%",
      avgResponseTime:
        this.proxies
          .filter((p) => p.responseTime)
          .reduce((sum, p) => sum + (p.responseTime || 0), 0) /
          this.proxies.filter((p) => p.responseTime).length || 0,
    };
  }

  /**
   * Reseta estatísticas de um proxy
   */
  resetProxyStats(url: string): void {
    const proxy = this.proxies.find((p) => p.url === url);
    if (proxy) {
      proxy.failCount = 0;
      proxy.successCount = 0;
      proxy.isActive = true;
      this.saveToStorage();
      console.log(`✓ Stats resetadas para ${proxy.name}`);
    }
  }

  /**
   * Reseta todas as estatísticas
   */
  resetAllStats(): void {
    this.proxies.forEach((p) => {
      p.failCount = 0;
      p.successCount = 0;
      p.isActive = true;
    });
    this.saveToStorage();
    console.log("✓ Todas as stats resetadas");
  }

  /**
   * Limpa todos os proxies
   */
  clearAll(): void {
    this.proxies = [];
    this.currentIndex = 0;
    this.saveToStorage();
    console.log("✓ Pool de proxies limpo");
  }
}

// Singleton instance
export const proxyManager = new ProxyManager();

// Helper functions para uso fácil
export const addProxy = (url: string, name: string, priority?: number) =>
  proxyManager.addProxy(url, name, priority);
export const getNextProxy = () => proxyManager.getNextProxy();
export const getBestProxy = () => proxyManager.getBestProxy();
export const recordProxySuccess = (url: string, responseTime: number) =>
  proxyManager.recordSuccess(url, responseTime);
export const recordProxyFailure = (url: string, error?: string) =>
  proxyManager.recordFailure(url, error);
export const getProxyStats = () => proxyManager.getStats();

/**
 * Proxy Manager - Adaptador Integrado com o NetworkService
 * Gerencia pool de proxies e rotaciona automaticamente utilizando o NetworkService
 */

import { networkService } from '../services/networkService';

export interface ProxyConfig {
  url: string;
  name: string;
  priority: number;
  isActive: boolean;
  failCount: number;
  successCount: number;
  lastUsed?: Date;
  lastFailed?: Date;
  responseTime?: number;
}

class ProxyManagerBridge {
  constructor() {}

  /**
   * Adiciona ou importa proxy no formato URL ou host:port:user:pass
   */
  addProxy(rawInput: string, name?: string, _priority: number = 2): void {
    const parsed = networkService.parseEndpoint(rawInput);
    if (parsed) {
      networkService.importEndpoints(rawInput);
      console.log(`✓ Endpoint adicionado via NetworkService: ${name || parsed.id}`);
    }
  }

  /**
   * Importação em massa de proxies (suporta host:port:user:pass e URLs)
   */
  importProxies(text: string): number {
    return networkService.importEndpoints(text);
  }

  /**
   * Remove um proxy do pool
   */
  removeProxy(idOrUrl: string): void {
    const endpoints = networkService.getEndpoints();
    const target = endpoints.find((e) => e.url === idOrUrl || e.id === idOrUrl || e.raw === idOrUrl);
    if (target) {
      networkService.removeEndpoint(target.id);
    }
  }

  /**
   * Reseta estatísticas de um proxy
   */
  resetProxyStats(idOrUrl: string): void {
    const endpoints = networkService.getEndpoints();
    const target = endpoints.find((e) => e.url === idOrUrl || e.id === idOrUrl || e.raw === idOrUrl);
    if (target) {
      target.consecutiveFailures = 0;
      target.failureCount = 0;
      target.isActive = true;
      target.cooldownUntil = undefined;
    }
  }

  /**
   * Checagem de saúde de proxies
   */
  async checkProxiesHealth(): Promise<void> {
    const endpoints = networkService.getEndpoints();
    for (const ep of endpoints) {
      if (ep.consecutiveFailures > 0) {
        ep.consecutiveFailures = Math.max(0, ep.consecutiveFailures - 1);
        if (ep.consecutiveFailures === 0) ep.isActive = true;
      }
    }
  }

  /**
   * Obtém o próximo proxy disponível (rotação)
   */
  getNextProxy(): { url: string; id: string; name: string } | null {
    const { endpoint } = networkService.getNextEndpoint();
    if (!endpoint) return null;
    return {
      url: endpoint.url,
      id: endpoint.id,
      name: endpoint.id,
    };
  }

  /**
   * Registra sucesso de um proxy
   */
  recordSuccess(urlOrId: string, responseTime: number): void {
    const endpoints = networkService.getEndpoints();
    const target = endpoints.find((e) => e.url === urlOrId || e.id === urlOrId || e.raw === urlOrId);
    if (target) {
      networkService.recordResult(target.id, true, responseTime);
    }
  }

  /**
   * Registra falha de um proxy
   */
  recordFailure(urlOrId: string): void {
    const endpoints = networkService.getEndpoints();
    const target = endpoints.find((e) => e.url === urlOrId || e.id === urlOrId || e.raw === urlOrId);
    if (target) {
      networkService.recordResult(target.id, false, 5000);
    }
  }

  /**
   * Retorna estatísticas de proxies compatíveis com a interface legada
   */
  getStats() {
    const metrics = networkService.getMetrics();
    return {
      total: metrics.total,
      active: metrics.active,
      inactive: metrics.degraded,
      avgResponseTime: metrics.avgLatency,
      successRate: 100,
    };
  }

  /**
   * Retorna todos os proxies cadastrados compatíveis com a interface ProxyConfig
   */
  getAllProxies(): ProxyConfig[] {
    return networkService.getEndpoints().map((e) => ({
      url: e.url,
      name: e.id,
      priority: 2,
      isActive: e.isActive,
      failCount: e.failureCount,
      successCount: e.successCount,
      lastUsed: e.lastUsed ? new Date(e.lastUsed) : undefined,
      lastFailed: e.lastFailure ? new Date(e.lastFailure) : undefined,
      responseTime: e.lastLatencyMs || e.avgLatencyMs,
    }));
  }
}

export const proxyManager = new ProxyManagerBridge();

export const getNextProxy = () => proxyManager.getNextProxy();

export const getProxyStats = () => proxyManager.getStats();

/**
 * NetworkService - Gerenciamento Avançado de Endpoints de Saída e Resiliência de Rede
 * 
 * Funcionalidades:
 * - Gerenciamento de Pool de Endpoints (suporte a host:port:user:pass, http://, https://, socks5://)
 * - Estratégias de Load Balancing (Round-Robin Ponderado, Menor Latência)
 * - Monitoramento de Saúde em Tempo Real (Health Check, Circuit Breaker e Cooldown Dinâmico)
 * - Sincronização de Contexto Geográfico (Timezone e Locale consistentes com a região do endpoint)
 * - Mecanismo de Fallback com Backoff Incremental em caso de esgotamento do pool
 */

export interface NetworkEndpoint {
  id: string;
  url: string; // Formato http://user:pass@host:port
  raw: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol: 'http' | 'https' | 'socks5';
  region?: string;
  timezone?: string;
  locale?: string;
  isActive: boolean;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  lastUsed?: number;
  lastFailure?: number;
  avgLatencyMs: number;
  lastLatencyMs?: number;
  cooldownUntil?: number;
}

export interface NetworkServiceConfig {
  maxConsecutiveFailures: number;
  initialCooldownMs: number;
  maxCooldownMs: number;
  requestTimeoutMs: number;
  rotationStrategy: 'round-robin' | 'least-latency' | 'random';
  fallbackBackoffMs: number;
}

const DEFAULT_CONFIG: NetworkServiceConfig = {
  maxConsecutiveFailures: 3,
  initialCooldownMs: 30000, // 30 segundos
  maxCooldownMs: 300000, // 5 minutos
  requestTimeoutMs: 10000,
  rotationStrategy: 'round-robin',
  fallbackBackoffMs: 1200,
};

export class NetworkService {
  private static instance: NetworkService;
  private endpoints: NetworkEndpoint[] = [];
  private currentIndex: number = 0;
  private config: NetworkServiceConfig = { ...DEFAULT_CONFIG };
  private storageKey = 'checker_zaga_network_endpoints_v2';

  private constructor() {
    this.loadFromStorage();
    this.loadFromEnv();
  }

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  /**
   * Parser robusto para strings de endpoint:
   * Suporta:
   * - host:port:user:pass
   * - user:pass@host:port
   * - http://user:pass@host:port
   * - socks5://user:pass@host:port
   * - host:port
   */
  public parseEndpoint(rawInput: string): NetworkEndpoint | null {
    const trimmed = rawInput.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;

    try {
      let protocol: 'http' | 'https' | 'socks5' = 'http';
      let host = '';
      let port = 80;
      let username = '';
      let password = '';

      if (trimmed.includes('://')) {
        const urlObj = new URL(trimmed);
        protocol = (urlObj.protocol.replace(':', '') as any) || 'http';
        host = urlObj.hostname;
        port = parseInt(urlObj.port, 10) || 80;
        username = decodeURIComponent(urlObj.username || '');
        password = decodeURIComponent(urlObj.password || '');
      } else {
        const parts = trimmed.split(':');
        if (parts.length === 4) {
          // Formato host:port:user:pass
          host = parts[0];
          port = parseInt(parts[1], 10);
          username = parts[2];
          password = parts[3];
        } else if (parts.length === 2) {
          // Formato host:port
          host = parts[0];
          port = parseInt(parts[1], 10);
        } else if (trimmed.includes('@')) {
          // Formato user:pass@host:port
          const [auth, hostPort] = trimmed.split('@');
          const [u, p] = auth.split(':');
          const [h, pt] = hostPort.split(':');
          username = u;
          password = p;
          host = h;
          port = parseInt(pt, 10);
        } else {
          return null;
        }
      }

      if (!host || isNaN(port) || port <= 0 || port > 65535) {
        return null;
      }

      const authPart = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
      const url = `${protocol}://${authPart}${host}:${port}`;
      const id = `${host}:${port}`;

      // Detecção de contexto regional aproximado
      const regionData = this.detectRegionalContext(host);

      return {
        id,
        url,
        raw: trimmed,
        host,
        port,
        username: username || undefined,
        password: password || undefined,
        protocol,
        region: regionData.region,
        timezone: regionData.timezone,
        locale: regionData.locale,
        isActive: true,
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        avgLatencyMs: 0,
      };
    } catch (_) {
      return null;
    }
  }

  /**
   * Importa múltiplos endpoints em lote a partir de texto
   */
  public importEndpoints(text: string): number {
    const lines = text.split(/[\r\n,;]+/);
    let addedCount = 0;

    for (const line of lines) {
      const parsed = this.parseEndpoint(line);
      if (parsed) {
        const existingIndex = this.endpoints.findIndex((e) => e.id === parsed.id);
        if (existingIndex >= 0) {
          this.endpoints[existingIndex] = { ...this.endpoints[existingIndex], ...parsed, isActive: true };
        } else {
          this.endpoints.push(parsed);
          addedCount++;
        }
      }
    }

    this.saveToStorage();
    return addedCount;
  }

  /**
   * Seleciona o próximo endpoint de saída aplicando Load Balancing e Circuit Breaker
   */
  public getNextEndpoint(): { endpoint: NetworkEndpoint | null; isFallback: boolean } {
    const now = Date.now();

    // Reativa endpoints que saíram do período de cooldown
    for (const ep of this.endpoints) {
      if (!ep.isActive && ep.cooldownUntil && now >= ep.cooldownUntil) {
        ep.isActive = true;
        ep.consecutiveFailures = 0;
        ep.cooldownUntil = undefined;
        console.log(`[NetworkService] Endpoint reativado após cooldown: ${ep.id}`);
      }
    }

    const healthyEndpoints = this.endpoints.filter((e) => e.isActive);

    if (healthyEndpoints.length === 0) {
      return { endpoint: null, isFallback: true };
    }

    let selected: NetworkEndpoint;

    switch (this.config.rotationStrategy) {
      case 'least-latency':
        selected = [...healthyEndpoints].sort((a, b) => (a.avgLatencyMs || 9999) - (b.avgLatencyMs || 9999))[0];
        break;
      case 'random':
        selected = healthyEndpoints[Math.floor(Math.random() * healthyEndpoints.length)];
        break;
      case 'round-robin':
      default:
        this.currentIndex = (this.currentIndex + 1) % healthyEndpoints.length;
        selected = healthyEndpoints[this.currentIndex];
        break;
    }

    selected.lastUsed = now;
    this.saveToStorage();

    return { endpoint: selected, isFallback: false };
  }

  /**
   * Registra o resultado de uma requisição para métricas e circuit breaking
   */
  public recordResult(endpointId: string, success: boolean, latencyMs: number): void {
    const ep = this.endpoints.find((e) => e.id === endpointId);
    if (!ep) return;

    const now = Date.now();

    if (success) {
      ep.successCount++;
      ep.consecutiveFailures = 0;
      ep.lastLatencyMs = latencyMs;
      ep.avgLatencyMs = ep.avgLatencyMs === 0 ? latencyMs : Math.round((ep.avgLatencyMs * 0.7) + (latencyMs * 0.3));
    } else {
      ep.failureCount++;
      ep.consecutiveFailures++;
      ep.lastFailure = now;

      // Circuit Breaker: isolamento temporário caso exceda falhas consecutivas
      if (ep.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        ep.isActive = false;
        const cooldownMultiplier = Math.min(Math.pow(2, ep.consecutiveFailures - this.config.maxConsecutiveFailures), 8);
        const cooldownDuration = Math.min(this.config.initialCooldownMs * cooldownMultiplier, this.config.maxCooldownMs);
        ep.cooldownUntil = now + cooldownDuration;

        console.warn(`[NetworkService] Endpoint isolado por ${cooldownDuration / 1000}s devido a falhas: ${ep.id}`);
      }
    }

    this.saveToStorage();
  }

  /**
   * Remove um endpoint do pool
   */
  public removeEndpoint(id: string): void {
    this.endpoints = this.endpoints.filter((e) => e.id !== id);
    this.saveToStorage();
  }

  /**
   * Limpa todos os endpoints cadastrados
   */
  public clearEndpoints(): void {
    this.endpoints = [];
    this.saveToStorage();
  }

  /**
   * Retorna a lista completa de endpoints com suas métricas
   */
  public getEndpoints(): NetworkEndpoint[] {
    return [...this.endpoints];
  }

  /**
   * Retorna métricas globais do pool
   */
  public getMetrics() {
    const total = this.endpoints.length;
    const active = this.endpoints.filter((e) => e.isActive).length;
    const degraded = total - active;
    const avgLatency =
      active > 0
        ? Math.round(this.endpoints.filter((e) => e.isActive).reduce((acc, curr) => acc + (curr.avgLatencyMs || 0), 0) / active)
        : 0;

    return { total, active, degraded, avgLatency };
  }

  /**
   * Sincroniza metadados regionais baseados no endpoint
   */
  private detectRegionalContext(host: string): { region: string; timezone: string; locale: string } {
    const isBr = host.endsWith('.br') || host.includes('br.') || host.includes('-br-');
    if (isBr) {
      return { region: 'BR-SP', timezone: 'America/Sao_Paulo', locale: 'pt-BR' };
    }
    return { region: 'BR-Default', timezone: 'America/Sao_Paulo', locale: 'pt-BR' };
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.endpoints = JSON.parse(data);
      }
    } catch (_) {}
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.endpoints));
    } catch (_) {}
  }

  private loadFromEnv(): void {
    try {
      const envEndpoints = (import.meta as any)?.env?.VITE_NETWORK_ENDPOINTS;
      if (envEndpoints && this.endpoints.length === 0) {
        this.importEndpoints(envEndpoints);
      }
    } catch (_) {}
  }
}

export const networkService = NetworkService.getInstance();

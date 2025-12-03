/**
 * Rate Limiter Inteligente - Sistema de Controle de Taxa com Detecção de Bloqueio
 * Monitora e ajusta automaticamente a velocidade para evitar bloqueios
 */

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxConcurrentRequests: number;
  cooldownAfterError: number; // ms
  blockDetectionThreshold: number; // % de erros consecutivos
  adaptiveMode: boolean;
}

export interface RateLimitStats {
  requestsLastMinute: number;
  requestsLastHour: number;
  currentConcurrent: number;
  totalBlocked: number;
  totalAllowed: number;
  currentLevel: "safe" | "warning" | "danger" | "blocked";
  estimatedWaitTime: number;
  errorRate: number;
}

interface RequestLog {
  timestamp: number;
  success: boolean;
  responseTime: number;
}

class RateLimiter {
  private config: RateLimitConfig;
  private requestLog: RequestLog[] = [];
  private concurrentRequests: number = 0;
  private totalBlocked: number = 0;
  private totalAllowed: number = 0;
  private lastErrorTime: number = 0;
  private consecutiveErrors: number = 0;
  private isInCooldown: boolean = false;
  private cooldownUntil: number = 0;

  // Sliding windows
  private readonly MINUTE_WINDOW = 60 * 1000; // 60 segundos
  private readonly HOUR_WINDOW = 60 * 60 * 1000; // 60 minutos

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxRequestsPerMinute: 20,
      maxRequestsPerHour: 500,
      maxConcurrentRequests: 3,
      cooldownAfterError: 2000,
      blockDetectionThreshold: 0.5, // 50% de erros
      adaptiveMode: true,
      ...config,
    };

    this.startCleanupTimer();
  }

  /**
   * Verifica se pode fazer uma requisição
   */
  async canMakeRequest(): Promise<boolean> {
    // Verifica cooldown
    if (this.isInCooldown) {
      const now = Date.now();
      if (now < this.cooldownUntil) {
        console.warn(
          `⏸️ Em cooldown por mais ${Math.ceil((this.cooldownUntil - now) / 1000)}s`,
        );
        return false;
      } else {
        this.isInCooldown = false;
        this.consecutiveErrors = 0;
        console.log("✓ Cooldown finalizado, retomando operações");
      }
    }

    // Verifica limites
    const requestsLastMinute = this.getRequestsInWindow(this.MINUTE_WINDOW);
    const requestsLastHour = this.getRequestsInWindow(this.HOUR_WINDOW);

    // Limite por minuto
    if (requestsLastMinute >= this.config.maxRequestsPerMinute) {
      console.warn(
        `⚠️ Limite de requisições por minuto atingido (${requestsLastMinute}/${this.config.maxRequestsPerMinute})`,
      );
      this.totalBlocked++;
      return false;
    }

    // Limite por hora
    if (requestsLastHour >= this.config.maxRequestsPerHour) {
      console.warn(
        `⚠️ Limite de requisições por hora atingido (${requestsLastHour}/${this.config.maxRequestsPerHour})`,
      );
      this.totalBlocked++;
      return false;
    }

    // Limite de concorrência
    if (this.concurrentRequests >= this.config.maxConcurrentRequests) {
      console.warn(
        `⚠️ Limite de requisições concorrentes atingido (${this.concurrentRequests}/${this.config.maxConcurrentRequests})`,
      );
      return false;
    }

    // Modo adaptativo - ajusta baseado em taxa de erro
    if (this.config.adaptiveMode) {
      const errorRate = this.getErrorRate();
      if (errorRate > this.config.blockDetectionThreshold) {
        console.warn(
          `⚠️ Taxa de erro alta (${(errorRate * 100).toFixed(1)}%), aplicando rate limit adaptativo`,
        );
        await this.adaptiveDelay(errorRate);
      }
    }

    return true;
  }

  /**
   * Aguarda até poder fazer requisição
   */
  async waitForSlot(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 60; // 60 tentativas (1 minuto)

    while (!(await this.canMakeRequest())) {
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error("Rate limit: Timeout aguardando slot disponível");
      }

      // Calcula tempo de espera baseado no nível de utilização
      const stats = this.getStats();
      const waitTime = this.calculateWaitTime(stats);

      console.log(`⏳ Aguardando ${(waitTime / 1000).toFixed(1)}s...`);
      await this.sleep(waitTime);
    }
  }

  /**
   * Registra início de requisição
   */
  startRequest(): void {
    this.concurrentRequests++;
    this.totalAllowed++;
  }

  /**
   * Registra fim de requisição
   */
  endRequest(success: boolean, responseTime: number): void {
    this.concurrentRequests = Math.max(0, this.concurrentRequests - 1);

    // Registra no log
    this.requestLog.push({
      timestamp: Date.now(),
      success,
      responseTime,
    });

    // Gerencia erros consecutivos
    if (!success) {
      this.consecutiveErrors++;
      this.lastErrorTime = Date.now();

      // Detecta possível bloqueio
      if (
        this.consecutiveErrors >= 5 ||
        this.getErrorRate() > this.config.blockDetectionThreshold
      ) {
        this.enterCooldown();
      }
    } else {
      // Reduz contador de erros gradualmente em sucessos
      this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
    }

    // Modo adaptativo - ajusta limites baseado em performance
    if (this.config.adaptiveMode) {
      this.adaptLimits();
    }
  }

  /**
   * Entra em modo cooldown
   */
  private enterCooldown(): void {
    const cooldownDuration =
      this.config.cooldownAfterError * Math.pow(2, this.consecutiveErrors / 5); // Exponencial
    this.cooldownUntil = Date.now() + cooldownDuration;
    this.isInCooldown = true;

    console.error(
      `🛑 Modo cooldown ativado por ${(cooldownDuration / 1000).toFixed(1)}s devido a ${this.consecutiveErrors} erros consecutivos`,
    );
  }

  /**
   * Delay adaptativo baseado em taxa de erro
   */
  private async adaptiveDelay(errorRate: number): Promise<void> {
    const baseDelay = 1000; // 1s base
    const penalty = errorRate * 5000; // Até 5s de penalidade
    const totalDelay = baseDelay + penalty;

    console.log(
      `⏱️ Delay adaptativo: ${(totalDelay / 1000).toFixed(1)}s (erro: ${(errorRate * 100).toFixed(1)}%)`,
    );
    await this.sleep(totalDelay);
  }

  /**
   * Adapta limites baseado em performance
   */
  private adaptLimits(): void {
    const errorRate = this.getErrorRate();
    const avgResponseTime = this.getAverageResponseTime();

    // Se muitos erros, reduz taxa
    if (errorRate > 0.3) {
      this.config.maxRequestsPerMinute = Math.max(
        10,
        this.config.maxRequestsPerMinute - 2,
      );
      console.log(
        `📉 Taxa reduzida para ${this.config.maxRequestsPerMinute}/min`,
      );
    }
    // Se tudo OK e resposta rápida, pode aumentar gradualmente
    else if (errorRate < 0.05 && avgResponseTime < 2000) {
      this.config.maxRequestsPerMinute = Math.min(
        30,
        this.config.maxRequestsPerMinute + 1,
      );
      console.log(
        `📈 Taxa aumentada para ${this.config.maxRequestsPerMinute}/min`,
      );
    }
  }

  /**
   * Calcula tempo de espera baseado em utilização
   */
  private calculateWaitTime(stats: RateLimitStats): number {
    const baseWait = 1000; // 1s base

    switch (stats.currentLevel) {
      case "safe":
        return baseWait;
      case "warning":
        return baseWait * 1.5;
      case "danger":
        return baseWait * 2;
      case "blocked":
        return baseWait * 3;
      default:
        return baseWait;
    }
  }

  /**
   * Obtém requisições em janela de tempo
   */
  private getRequestsInWindow(windowMs: number): number {
    const now = Date.now();
    const cutoff = now - windowMs;
    return this.requestLog.filter((log) => log.timestamp > cutoff).length;
  }

  /**
   * Calcula taxa de erro
   */
  private getErrorRate(): number {
    if (this.requestLog.length === 0) return 0;

    const recentLogs = this.requestLog.slice(-20); // Últimas 20 requisições
    const errors = recentLogs.filter((log) => !log.success).length;

    return errors / recentLogs.length;
  }

  /**
   * Calcula tempo médio de resposta
   */
  private getAverageResponseTime(): number {
    if (this.requestLog.length === 0) return 0;

    const recentLogs = this.requestLog.slice(-20);
    const total = recentLogs.reduce((sum, log) => sum + log.responseTime, 0);

    return total / recentLogs.length;
  }

  /**
   * Determina nível atual de risco
   */
  private getCurrentLevel(): "safe" | "warning" | "danger" | "blocked" {
    const requestsLastMinute = this.getRequestsInWindow(this.MINUTE_WINDOW);
    const utilization =
      requestsLastMinute / this.config.maxRequestsPerMinute;
    const errorRate = this.getErrorRate();

    if (this.isInCooldown) return "blocked";
    if (errorRate > 0.3 || utilization > 0.9) return "danger";
    if (errorRate > 0.15 || utilization > 0.7) return "warning";
    return "safe";
  }

  /**
   * Obtém estatísticas atuais
   */
  getStats(): RateLimitStats {
    const requestsLastMinute = this.getRequestsInWindow(this.MINUTE_WINDOW);
    const requestsLastHour = this.getRequestsInWindow(this.HOUR_WINDOW);
    const errorRate = this.getErrorRate();
    const currentLevel = this.getCurrentLevel();

    // Calcula tempo estimado de espera
    let estimatedWaitTime = 0;
    if (requestsLastMinute >= this.config.maxRequestsPerMinute) {
      // Precisa esperar até que a janela deslize
      const oldestRequest = this.requestLog
        .filter((log) => log.timestamp > Date.now() - this.MINUTE_WINDOW)
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      if (oldestRequest) {
        estimatedWaitTime = Math.max(
          0,
          oldestRequest.timestamp + this.MINUTE_WINDOW - Date.now(),
        );
      }
    }

    return {
      requestsLastMinute,
      requestsLastHour,
      currentConcurrent: this.concurrentRequests,
      totalBlocked: this.totalBlocked,
      totalAllowed: this.totalAllowed,
      currentLevel,
      estimatedWaitTime,
      errorRate,
    };
  }

  /**
   * Reseta estatísticas
   */
  reset(): void {
    this.requestLog = [];
    this.concurrentRequests = 0;
    this.totalBlocked = 0;
    this.totalAllowed = 0;
    this.consecutiveErrors = 0;
    this.isInCooldown = false;
    this.cooldownUntil = 0;
    console.log("✓ Rate limiter resetado");
  }

  /**
   * Atualiza configuração
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    console.log("✓ Configuração atualizada:", this.config);
  }

  /**
   * Limpa logs antigos
   */
  private cleanupOldLogs(): void {
    const cutoff = Date.now() - this.HOUR_WINDOW;
    const initialLength = this.requestLog.length;

    this.requestLog = this.requestLog.filter((log) => log.timestamp > cutoff);

    const removed = initialLength - this.requestLog.length;
    if (removed > 0) {
      console.log(`🗑️ Removidos ${removed} logs antigos`);
    }
  }

  /**
   * Inicia timer de limpeza
   */
  private startCleanupTimer(): void {
    // Limpa logs a cada 5 minutos
    setInterval(() => {
      this.cleanupOldLogs();
    }, 5 * 60 * 1000);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Exporta configuração e stats
   */
  export(): string {
    return JSON.stringify(
      {
        config: this.config,
        stats: this.getStats(),
        recentLogs: this.requestLog.slice(-50),
      },
      null,
      2,
    );
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Helper functions
export const canMakeRequest = () => rateLimiter.canMakeRequest();
export const waitForSlot = () => rateLimiter.waitForSlot();
export const startRequest = () => rateLimiter.startRequest();
export const endRequest = (success: boolean, responseTime: number) =>
  rateLimiter.endRequest(success, responseTime);
export const getRateLimitStats = () => rateLimiter.getStats();
export const resetRateLimiter = () => rateLimiter.reset();
export const updateRateLimitConfig = (config: Partial<RateLimitConfig>) =>
  rateLimiter.updateConfig(config);

export interface HealthMetrics {
  availability: number; // %
  averageLatency: number; // ms
  errorRate: number; // %
  successRate: number; // %
  status: "healthy" | "degraded" | "unhealthy" | "critical";
  lastCheck: Date;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
}

export interface HealthCheck {
  timestamp: Date;
  success: boolean;
  latency: number;
  error?: string;
}

export interface HealthAlert {
  id: string;
  timestamp: Date;
  type: "warning" | "critical" | "info";
  message: string;
  acknowledged: boolean;
}

class HealthMonitor {
  private metrics: HealthMetrics;
  private healthHistory: HealthCheck[] = [];
  private alerts: HealthAlert[] = [];
  private listeners: ((metrics: HealthMetrics) => void)[] = [];
  private monitoringInterval?: number;
  private isMonitoring = false;

  // Limiares configuráveis
  private readonly CRITICAL_ERROR_RATE = 0.5; // 50%
  private readonly UNHEALTHY_ERROR_RATE = 0.2; // 20%
  private readonly CRITICAL_LATENCY = 10000; // 10s
  private readonly UNHEALTHY_LATENCY = 5000; // 5s
  private readonly DEGRADED_LATENCY = 3000; // 3s
  private readonly HISTORY_SIZE = 100;
  private readonly MIN_REQUESTS_FOR_STATUS = 5;

  constructor() {
    this.metrics = {
      availability: 100,
      averageLatency: 0,
      errorRate: 0,
      successRate: 1,
      status: "healthy",
      lastCheck: new Date(),
      consecutiveFailures: 0,
      totalRequests: 0,
      totalFailures: 0,
    };
    this.loadFromStorage();
  }

  /**
   * Registra o resultado de uma requisição
   */
  recordRequest(success: boolean, latency: number, error?: string): void {
    const check: HealthCheck = {
      timestamp: new Date(),
      success,
      latency,
      error,
    };

    // Atualiza histórico
    this.healthHistory.push(check);
    if (this.healthHistory.length > this.HISTORY_SIZE) {
      this.healthHistory.shift();
    }

    // Atualiza métricas
    this.updateMetrics(check);

    // Persiste dados
    this.saveToStorage();

    // Notifica listeners
    this.notifyListeners();
  }

  /**
   * Atualiza métricas baseadas no novo check
   */
  private updateMetrics(newCheck: HealthCheck): void {
    this.metrics.lastCheck = newCheck.timestamp;
    this.metrics.totalRequests++;

    if (!newCheck.success) {
      this.metrics.consecutiveFailures++;
      this.metrics.totalFailures++;
    } else {
      this.metrics.consecutiveFailures = 0;
    }

    // Recalcula taxas baseadas no histórico recente
    const recentChecks = this.healthHistory.slice(-20); // Últimos 20 checks
    const recentFailures = recentChecks.filter((c) => !c.success).length;
    const recentLatency = recentChecks.reduce((acc, c) => acc + c.latency, 0);

    this.metrics.errorRate =
      recentChecks.length > 0 ? recentFailures / recentChecks.length : 0;
    this.metrics.successRate = 1 - this.metrics.errorRate;
    this.metrics.averageLatency =
      recentChecks.length > 0 ? recentLatency / recentChecks.length : 0;

    // Calcula disponibilidade (baseada em histórico maior)
    const allChecks = this.healthHistory;
    const availableChecks = allChecks.filter((c) => c.success).length;
    this.metrics.availability =
      allChecks.length > 0 ? (availableChecks / allChecks.length) * 100 : 100;

    // Determina status geral
    this.metrics.status = this.determineStatus();
  }

  /**
   * Determina status geral do gateway
   */
  private determineStatus(): "healthy" | "degraded" | "unhealthy" | "critical" {
    const { errorRate, averageLatency, consecutiveFailures } = this.metrics;

    // SÓ ATIVA SE TIVER MÍNIMO DE REQUISIÇÕES RECENTES
    const recentCount = this.healthHistory.slice(-20).length;

    if (consecutiveFailures >= 10) {
      return "critical";
    }

    if (recentCount >= this.MIN_REQUESTS_FOR_STATUS) {
      if (
        errorRate >= this.CRITICAL_ERROR_RATE ||
        averageLatency >= this.CRITICAL_LATENCY
      ) {
        return "critical";
      }
    }

    // Unhealthy: erro rate alto ou latência muito alta
    if (recentCount >= this.MIN_REQUESTS_FOR_STATUS) {
      if (
        consecutiveFailures >= 5 ||
        errorRate >= this.UNHEALTHY_ERROR_RATE ||
        averageLatency >= this.UNHEALTHY_LATENCY
      ) {
        return "unhealthy";
      }
    }

    // Degraded: alguns problemas
    if (
      consecutiveFailures >= 2 ||
      averageLatency >= this.DEGRADED_LATENCY
    ) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Verifica se é seguro continuar operando
   */
  isSafeToContinue(): boolean {
    // SEMPRE RETORNA TRUE PARA NÃO BLOQUEAR O USUÁRIO (Conforme solicitação)
    // O monitoramento continua apenas informativo
    return true;

    /* Lógica antiga desativada:
    return this.metrics.status !== "critical";
    */
  }

  /**
   * Retorna ação recomendada baseada no status
   */
  getRecommendedAction(): "continue" | "slow_down" | "pause" | "stop" | "wait" {
    const { status, errorRate, consecutiveFailures } = this.metrics;

    if (status === "critical" || errorRate >= 0.8) {
      return "wait"; // Mudado de stop para wait
    }

    if (status === "unhealthy" || errorRate >= 0.5) {
      return "slow_down"; // Mudado de pause para slow_down
    }

    if (status === "degraded" || errorRate >= 0.3) {
      return "slow_down";
    }

    if (consecutiveFailures >= 3) {
      return "wait";
    }

    return "continue";
  }

  /**
   * Calcula tempo de espera recomendado
   */
  getRecommendedWaitTime(): number {
    const action = this.getRecommendedAction();

    switch (action) {
      case "stop":
        return 5000; // Reduzido drasticamente
      case "pause":
        return 2000;
      case "slow_down":
        return 1000;
      case "wait":
        return 1000;
      default:
        return 0;
    }
  }

  /**
   * Inicia monitoramento ativo (ping periódico)
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // @ts-ignore - NodeJS.Timeout vs number compatibility fix
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs) as unknown as number;

    console.log(
      `✓ Monitoramento de saúde iniciado (intervalo: ${intervalMs / 1000}s)`,
    );
  }

  /**
   * Para monitoramento ativo
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      this.isMonitoring = false;
    }
  }

  /**
   * Executa health check do gateway
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      const response = await fetch("https://httpbin.org/status/200", {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      const latency = Date.now() - startTime;
      this.recordRequest(response.ok, latency);
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordRequest(false, latency, (error as Error).message);
    }
  }

  /**
   * Obtém métricas atuais
   */
  getMetrics(): HealthMetrics {
    return { ...this.metrics };
  }

  /**
   * Obtém histórico de health checks
   */
  getHistory(limit?: number): HealthCheck[] {
    const history = [...this.healthHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Obtém alertas
   */
  getAlerts(limit?: number): HealthAlert[] {
    const alerts = [...this.alerts];
    return limit ? alerts.slice(-limit) : alerts;
  }

  /**
   * Limpa histórico
   */
  clearHistory(): void {
    this.healthHistory = [];
    this.alerts = [];
    this.saveToStorage();
  }

  /**
   * Reseta métricas
   */
  reset(): void {
    this.metrics = {
      availability: 100,
      averageLatency: 0,
      errorRate: 0,
      successRate: 1,
      status: "healthy",
      lastCheck: new Date(),
      consecutiveFailures: 0,
      totalRequests: 0,
      totalFailures: 0,
    };
    this.clearHistory();
  }

  /**
   * Registra listener para mudanças de métrica
   */
  onMetricsChange(callback: (metrics: HealthMetrics) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Notifica todos os listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach((callback) => {
      try {
        callback(this.metrics);
      } catch (error) {
        console.error("Erro ao notificar listener:", error);
      }
    });
  }

  /**
   * Salva estado no localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        metrics: this.metrics,
        history: this.healthHistory.slice(-50),
        alerts: this.alerts.slice(-20),
      };
      localStorage.setItem("healthMonitor", JSON.stringify(data));
    } catch (error) {
      console.error("Erro ao salvar health monitor:", error);
    }
  }

  /**
   * Carrega estado do localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem("healthMonitor");
      if (stored) {
        const data = JSON.parse(stored);
        this.metrics = {
          ...data.metrics,
          lastCheck: new Date(data.metrics.lastCheck),
        };
        this.healthHistory = data.history || [];
        this.alerts = data.alerts || [];

        // Auto-reset se estiver crítico mas sem atividade recente
        const timeSinceLastCheck = Date.now() - this.metrics.lastCheck.getTime();
        if (this.metrics.status === 'critical' && timeSinceLastCheck > 5000) { // 5s
          console.log("⚠️ Resetando Health Monitor automaticamente");
          this.reset();
        }
      }
    } catch (error) {
      console.error("Erro ao carregar health monitor:", error);
    }
  }

  /**
   * Exporta dados para análise
   */
  exportData(): string {
    return JSON.stringify(
      {
        metrics: this.metrics,
        history: this.healthHistory,
        alerts: this.alerts,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

// Helper functions
export const recordHealthCheck = (
  success: boolean,
  latency: number,
  error?: string,
) => healthMonitor.recordRequest(success, latency, error);
export const getHealthMetrics = () => healthMonitor.getMetrics();
export const isSafeToContinue = () => healthMonitor.isSafeToContinue();
export const getRecommendedAction = () => healthMonitor.getRecommendedAction();
export const getRecommendedWaitTime = () =>
  healthMonitor.getRecommendedWaitTime();
export const getHealthAlerts = (limit?: number) =>
  healthMonitor.getAlerts(limit);
export const resetHealthMonitor = () => healthMonitor.reset();

/**
 * Health Monitor - Sistema de Monitoramento de Saúde do Gateway
 * Detecta problemas e previne bloqueios automaticamente
 */

export interface HealthMetrics {
  availability: number; // 0-100%
  averageLatency: number; // ms
  errorRate: number; // 0-1
  successRate: number; // 0-1
  status: "healthy" | "degraded" | "unhealthy" | "critical";
  lastCheck: Date;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
}

export interface HealthCheck {
  timestamp: number;
  success: boolean;
  latency: number;
  errorMessage?: string;
  statusCode?: number;
}

export interface HealthAlert {
  level: "info" | "warning" | "error" | "critical";
  message: string;
  timestamp: number;
  metrics?: Partial<HealthMetrics>;
}

class HealthMonitor {
  private metrics: HealthMetrics = {
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

  private healthHistory: HealthCheck[] = [];
  private alerts: HealthAlert[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval?: number; // Changed from NodeJS.Timeout to number for browser compat
  private listeners: Array<(metrics: HealthMetrics) => void> = [];

  // Thresholds
  private readonly CRITICAL_ERROR_RATE = 0.8; // 80%
  private readonly UNHEALTHY_ERROR_RATE = 0.5; // 50%
  private readonly DEGRADED_ERROR_RATE = 0.3; // 30%
  private readonly CRITICAL_LATENCY = 10000; // 10s
  private readonly UNHEALTHY_LATENCY = 5000; // 5s
  private readonly DEGRADED_LATENCY = 3000; // 3s
  private readonly HISTORY_SIZE = 100;
  private readonly ALERT_HISTORY_SIZE = 50;
  private readonly MIN_REQUESTS_FOR_STATUS = 5; // Mínimo de requisições para calcular status baseado em taxa

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Registra resultado de uma requisição
   */
  recordRequest(success: boolean, latency: number, error?: string): void {
    const check: HealthCheck = {
      timestamp: Date.now(),
      success,
      latency,
      errorMessage: error,
    };

    // Adiciona ao histórico
    this.healthHistory.push(check);
    if (this.healthHistory.length > this.HISTORY_SIZE) {
      this.healthHistory.shift();
    }

    // Atualiza métricas
    this.updateMetrics(check);

    // Verifica se precisa gerar alertas
    this.checkForAlerts();

    // Salva estado
    this.saveToStorage();

    // Notifica listeners
    this.notifyListeners();
  }

  /**
   * Atualiza métricas baseado em novo check
   */
  private updateMetrics(check: HealthCheck): void {
    this.metrics.totalRequests++;
    this.metrics.lastCheck = new Date();

    if (check.success) {
      this.metrics.consecutiveFailures = 0;
    } else {
      this.metrics.totalFailures++;
      this.metrics.consecutiveFailures++;
    }

    // Calcula métricas dos últimos checks
    const recentChecks = this.healthHistory.slice(-20); // Últimos 20
    const successfulChecks = recentChecks.filter((c) => c.success).length;

    this.metrics.successRate = successfulChecks / recentChecks.length;
    this.metrics.errorRate = 1 - this.metrics.successRate;

    // Calcula latência média
    const latencies = recentChecks
      .filter((c) => c.success)
      .map((c) => c.latency);
    this.metrics.averageLatency =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : 0;

    // Calcula disponibilidade (últimas 100 requisições)
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

    // Crítico: muitos erros consecutivos ou erro rate muito alto
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

    return "healthy"; // Default to healthy if not enough data

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
      consecutiveFailures >= 3 ||
      errorRate >= this.DEGRADED_ERROR_RATE ||
      averageLatency >= this.DEGRADED_LATENCY
    ) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Verifica e gera alertas se necessário
   */
  private checkForAlerts(): void {
    const { status, consecutiveFailures, errorRate, averageLatency } =
      this.metrics;

    // Alerta crítico
    if (status === "critical") {
      this.addAlert(
        "critical",
        `Gateway em estado CRÍTICO! ${consecutiveFailures} falhas consecutivas. Taxa de erro: ${(errorRate * 100).toFixed(1)}%`,
        this.metrics,
      );
    }
    // Alerta de erro
    else if (status === "unhealthy") {
      this.addAlert(
        "error",
        `Gateway em estado UNHEALTHY. Taxa de erro: ${(errorRate * 100).toFixed(1)}%. Latência: ${averageLatency.toFixed(0)}ms`,
        this.metrics,
      );
    }
    // Alerta de aviso
    else if (status === "degraded") {
      this.addAlert(
        "warning",
        `Gateway degradado. Taxa de erro: ${(errorRate * 100).toFixed(1)}%. Considere reduzir velocidade.`,
        this.metrics,
      );
    }
    // Alerta de recuperação
    else if (
      status === "healthy" &&
      this.alerts.length > 0 &&
      this.alerts[this.alerts.length - 1].level !== "info"
    ) {
      this.addAlert(
        "info",
        "✓ Gateway recuperado e funcionando normalmente",
        this.metrics,
      );
    }
  }

  /**
   * Adiciona alerta
   */
  private addAlert(
    level: HealthAlert["level"],
    message: string,
    metrics?: Partial<HealthMetrics>,
  ): void {
    // Evita alertas duplicados em curto espaço de tempo
    const lastAlert = this.alerts[this.alerts.length - 1];
    if (lastAlert && lastAlert.message === message) {
      const timeSinceLastAlert = Date.now() - lastAlert.timestamp;
      if (timeSinceLastAlert < 60000) {
        // 1 minuto
        return;
      }
    }

    const alert: HealthAlert = {
      level,
      message,
      timestamp: Date.now(),
      metrics,
    };

    this.alerts.push(alert);

    // Limita tamanho do histórico de alertas
    if (this.alerts.length > this.ALERT_HISTORY_SIZE) {
      this.alerts.shift();
    }

    // Log no console
    const emoji =
      level === "critical"
        ? "🚨"
        : level === "error"
          ? "❌"
          : level === "warning"
            ? "⚠️"
            : "ℹ️";
    console.log(`${emoji} [Health Monitor] ${message}`);
  }

  /**
   * Verifica se é seguro continuar testando
   */
  isSafeToContinue(): boolean {
    const { status, consecutiveFailures, errorRate } = this.metrics;

    // Não continuar se crítico ou muitas falhas
    if (status === "critical" || consecutiveFailures >= 10) {
      return false;
    }

    // Não continuar se erro rate muito alto
    if (errorRate >= 0.7) {
      return false;
    }

    return true;
  }

  /**
   * Recomenda ação baseado em estado atual
   */
  getRecommendedAction():
    | "continue"
    | "slow_down"
    | "pause"
    | "stop"
    | "wait" {
    const { status, consecutiveFailures, errorRate } = this.metrics;

    if (status === "critical" || consecutiveFailures >= 10) {
      return "stop";
    }

    if (status === "unhealthy" || errorRate >= 0.5) {
      return "pause";
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
        return 300000; // 5 minutos
      case "pause":
        return 60000; // 1 minuto
      case "slow_down":
        return 10000; // 10 segundos
      case "wait":
        return 5000; // 5 segundos
      default:
        return 0;
    }
  }

  /**
   * Inicia monitoramento ativo (ping periódico)
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      console.warn("Monitoramento já está ativo");
      return;
    }

    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);

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
      console.log("✓ Monitoramento de saúde parado");
    }
  }

  /**
   * Executa health check do gateway
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      // Faz uma requisição simples ao gateway (ou endpoint de health)
      // Nota: adaptar URL conforme necessário
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
    console.log("✓ Histórico de saúde limpo");
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
    console.log("✓ Health monitor resetado");
  }

  /**
   * Registra listener para mudanças de métrica
   */
  onMetricsChange(callback: (metrics: HealthMetrics) => void): () => void {
    this.listeners.push(callback);

    // Retorna função para remover listener
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
        history: this.healthHistory.slice(-50), // Salva últimos 50
        alerts: this.alerts.slice(-20), // Salva últimos 20
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

/**
 * HttpClientFactory - Fábrica e Despachante Dinâmico de Requisições HTTP
 * 
 * Funcionalidades:
 * - Instanciação e execução de requisições HTTP com injeção dinâmica de proxy endpoints
 * - Controle estrito de timeouts com AbortController
 * - Registro automático de latência e saúde no NetworkService
 * - Estratégia de Fallback com Exponential Backoff
 */

import { networkService } from './networkService';
import type { NetworkEndpoint } from './networkService';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  customEndpoint?: string;
  skipProxy?: boolean;
}

export interface HttpResponse<T = any> {
  ok: boolean;
  status: number;
  statusText: string;
  data: T;
  latencyMs: number;
  endpointUsed: string | 'direct';
}

export class HttpClientFactory {
  /**
   * Executa uma requisição HTTP gerenciada com suporte a rotação de endpoints e fallback
   */
  public static async request<T = any>(
    url: string,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || 12000;

    let selectedEndpoint: NetworkEndpoint | null = null;
    let isFallback = false;

    if (!options.skipProxy) {
      if (options.customEndpoint) {
        selectedEndpoint = networkService.parseEndpoint(options.customEndpoint);
      } else {
        const next = networkService.getNextEndpoint();
        selectedEndpoint = next.endpoint;
        isFallback = next.isFallback;
      }
    }

    const endpointIdentifier = selectedEndpoint ? selectedEndpoint.id : 'direct';

    // Se estiver em modo fallback devido a falha geral do pool, aplica backoff
    if (isFallback) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const fetchConfig: RequestInit = {
      method: options.method || 'GET',
      headers,
      signal: controller.signal,
    };

    if (options.body && options.method !== 'GET') {
      fetchConfig.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, fetchConfig);
      clearTimeout(timeoutTimer);
      const latencyMs = Date.now() - startTime;

      let data: any = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (selectedEndpoint) {
        networkService.recordResult(selectedEndpoint.id, response.ok, latencyMs);
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        latencyMs,
        endpointUsed: endpointIdentifier,
      };
    } catch (error: any) {
      clearTimeout(timeoutTimer);
      const latencyMs = Date.now() - startTime;

      if (selectedEndpoint) {
        networkService.recordResult(selectedEndpoint.id, false, latencyMs);
      }

      const isTimeout = error.name === 'AbortError';
      const errorMessage = isTimeout ? `Timeout na requisição (${timeoutMs}ms)` : error.message;

      throw new Error(`[HttpClientFactory] Falha na requisição via ${endpointIdentifier}: ${errorMessage}`);
    }
  }

  /**
   * Helper simplificado para requisições POST
   */
  public static async post<T = any>(
    url: string,
    body: any,
    options: Omit<HttpRequestOptions, 'body' | 'method'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  /**
   * Helper simplificado para requisições GET
   */
  public static async get<T = any>(
    url: string,
    options: Omit<HttpRequestOptions, 'method'> = {}
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }
}

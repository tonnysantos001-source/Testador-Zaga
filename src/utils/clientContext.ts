/**
 * Client Context Collector
 * Coleta metadados de ambiente e sessão do cliente para conformidade
 * com gateways de pagamento (Mercado Pago Antifraude & Compliance)
 */

export interface ClientContext {
  userAgent: string;
  language: string;
  timezone: string;
  timezoneOffset: number;
  screenResolution: string;
  colorDepth: number;
  platform: string;
  timestamp: string;
}

/**
 * Coleta de forma síncrona e segura os metadados do navegador do cliente
 */
export function getClientContext(): ClientContext {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const scr = typeof screen !== 'undefined' ? screen : null;

  return {
    userAgent: nav ? nav.userAgent : 'Unknown-Agent',
    language: nav ? (nav.language || (nav as any).userLanguage || 'pt-BR') : 'pt-BR',
    timezone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || 'America/Sao_Paulo',
    timezoneOffset: new Date().getTimezoneOffset(),
    screenResolution: scr ? `${scr.width}x${scr.height}` : '1920x1080',
    colorDepth: scr ? scr.colorDepth : 24,
    platform: nav ? (nav.platform || 'Win32') : 'Win32',
    timestamp: new Date().toISOString(),
  };
}

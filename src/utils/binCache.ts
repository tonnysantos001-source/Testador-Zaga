/**
 * BIN Cache System - Sistema de Cache para BIN Lookup
 * Reduz lookups repetidos e melhora performance
 */

export interface BINInfo {
  bin: string;
  brand: string; // Visa, Mastercard, Amex, etc
  type: string; // credit, debit, prepaid
  level: string; // standard, gold, platinum, etc
  bank: string;
  country: string;
  countryCode: string;
  valid: boolean;
  cachedAt: number; // timestamp
}

interface CacheEntry {
  data: BINInfo;
  expiresAt: number;
}

class BINCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_KEY = "binCache";
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias
  private readonly MAX_CACHE_SIZE = 1000; // Máximo de BINs em cache

  constructor() {
    this.loadFromStorage();
    this.startCleanupTimer();
  }

  /**
   * Obtém informações de BIN (do cache ou lookup)
   */
  async getBINInfo(cardNumber: string): Promise<BINInfo> {
    const bin = this.extractBIN(cardNumber);

    // Tenta obter do cache primeiro
    const cached = this.getFromCache(bin);
    if (cached) {
      console.log(`✓ BIN ${bin} obtido do cache`);
      return cached;
    }

    // Se não está em cache, faz lookup
    console.log(`🔍 Fazendo lookup para BIN ${bin}...`);
    const binInfo = await this.lookupBIN(bin);

    // Salva no cache
    this.setInCache(bin, binInfo);

    return binInfo;
  }

  /**
   * Extrai BIN do número do cartão (primeiros 6 dígitos)
   */
  private extractBIN(cardNumber: string): string {
    return cardNumber.replace(/\s/g, "").substring(0, 6);
  }

  /**
   * Obtém BIN do cache se válido
   */
  private getFromCache(bin: string): BINInfo | null {
    const entry = this.cache.get(bin);

    if (!entry) return null;

    // Verifica se expirou
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(bin);
      this.saveToStorage();
      return null;
    }

    return entry.data;
  }

  /**
   * Salva BIN no cache
   */
  private setInCache(bin: string, data: BINInfo): void {
    // Se cache está cheio, remove entradas mais antigas
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.removeOldestEntries(100); // Remove 100 mais antigas
    }

    const entry: CacheEntry = {
      data: {
        ...data,
        cachedAt: Date.now(),
      },
      expiresAt: Date.now() + this.DEFAULT_TTL,
    };

    this.cache.set(bin, entry);
    this.saveToStorage();
  }

  /**
   * Faz lookup de BIN (local ou API externa)
   */
  private async lookupBIN(bin: string): Promise<BINInfo> {
    // Tenta detecção local primeiro (mais rápido)
    const localInfo = this.detectBINLocally(bin);

    // Se quiser, pode integrar com API externa aqui
    // Por exemplo: BinList API, BIN Codes API, etc
    // const apiInfo = await this.lookupFromAPI(bin);

    return localInfo;
  }

  /**
   * Detecção local de BIN (sem API externa)
   */
  private detectBINLocally(bin: string): BINInfo {
    const firstDigit = bin[0];
    const firstTwo = bin.substring(0, 2);
    const firstFour = bin.substring(0, 4);

    let brand = "Unknown";
    let type = "credit";
    let level = "standard";

    // Detecta bandeira
    if (firstDigit === "4") {
      brand = "Visa";
    } else if (firstTwo >= "51" && firstTwo <= "55") {
      brand = "Mastercard";
    } else if (firstTwo === "22" || (firstTwo >= "27" && firstTwo <= "27")) {
      brand = "Mastercard";
    } else if (firstTwo === "34" || firstTwo === "37") {
      brand = "American Express";
      type = "credit";
    } else if (
      firstFour === "6011" ||
      firstTwo === "65" ||
      (firstFour >= "6440" && firstFour <= "6449")
    ) {
      brand = "Discover";
    } else if (firstFour >= "3528" && firstFour <= "3589") {
      brand = "JCB";
    } else if (
      firstTwo === "50" ||
      (firstTwo >= "56" && firstTwo <= "69")
    ) {
      brand = "Maestro";
      type = "debit";
    } else if (firstTwo === "36" || firstTwo === "38") {
      brand = "Diners Club";
    } else if (firstFour === "6062" || firstTwo === "38") {
      brand = "Hipercard";
    } else if (firstTwo === "60" || firstFour === "6363") {
      brand = "Elo";
    }

    // Detecta nível (heurística básica)
    if (
      bin.includes("0000") ||
      bin.includes("1111") ||
      bin.includes("9999")
    ) {
      level = "platinum";
    } else if (firstTwo === "55" || firstTwo === "45") {
      level = "gold";
    }

    // Detecta se é Electron (Visa Debit)
    if (
      brand === "Visa" &&
      (firstFour === "4026" ||
        firstFour === "4175" ||
        firstFour === "4508" ||
        firstFour === "4844" ||
        firstFour === "4913" ||
        firstFour === "4917")
    ) {
      type = "debit";
      brand = "Visa Electron";
    }

    return {
      bin,
      brand,
      type,
      level,
      bank: "Unknown", // Requer API externa
      country: "BR", // Assume Brasil por padrão
      countryCode: "BRA",
      valid: this.isValidBIN(bin),
      cachedAt: Date.now(),
    };
  }

  /**
   * Valida BIN (verifica se tem 6 dígitos válidos)
   */
  private isValidBIN(bin: string): boolean {
    return /^\d{6}$/.test(bin);
  }

  /**
   * Lookup via API externa (opcional - descomente para usar)
   */
  /*
  private async lookupFromAPI(bin: string): Promise<BINInfo> {
    try {
      // Exemplo com BinList API (gratuita)
      const response = await fetch(`https://lookup.binlist.net/${bin}`, {
        headers: {
          'Accept-Version': '3'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      return {
        bin,
        brand: data.scheme?.toUpperCase() || 'Unknown',
        type: data.type || 'credit',
        level: data.brand || 'standard',
        bank: data.bank?.name || 'Unknown',
        country: data.country?.name || 'Unknown',
        countryCode: data.country?.alpha2 || 'XX',
        valid: true,
        cachedAt: Date.now()
      };
    } catch (error) {
      console.error('Erro no lookup de API:', error);
      // Fallback para detecção local
      return this.detectBINLocally(bin);
    }
  }
  */

  /**
   * Remove entradas mais antigas do cache
   */
  private removeOldestEntries(count: number): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].data.cachedAt - b[1].data.cachedAt);

    for (let i = 0; i < count && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }

    console.log(`🗑️ Removidas ${count} entradas antigas do cache`);
  }

  /**
   * Limpa entradas expiradas
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;

    for (const [bin, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(bin);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️ Removidas ${removed} entradas expiradas do cache`);
      this.saveToStorage();
    }
  }

  /**
   * Inicia timer de limpeza automática
   */
  private startCleanupTimer(): void {
    // Limpa cache expirado a cada 1 hora
    setInterval(() => {
      this.cleanupExpired();
    }, 60 * 60 * 1000);
  }

  /**
   * Salva cache no localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.cache.entries());
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Erro ao salvar cache de BIN:", error);
      // Se localStorage está cheio, limpa metade do cache
      this.removeOldestEntries(Math.floor(this.cache.size / 2));
    }
  }

  /**
   * Carrega cache do localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(data);
        console.log(`✓ Cache de BIN carregado: ${this.cache.size} entradas`);

        // Limpa expirados ao carregar
        this.cleanupExpired();
      }
    } catch (error) {
      console.error("Erro ao carregar cache de BIN:", error);
      this.cache = new Map();
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    const total = this.cache.size;
    const now = Date.now();
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      }
    }

    return {
      total,
      active: total - expired,
      expired,
      maxSize: this.MAX_CACHE_SIZE,
      usagePercent: ((total / this.MAX_CACHE_SIZE) * 100).toFixed(2) + "%",
    };
  }

  /**
   * Limpa todo o cache
   */
  clearCache(): void {
    this.cache.clear();
    localStorage.removeItem(this.CACHE_KEY);
    console.log("✓ Cache de BIN limpo");
  }

  /**
   * Força atualização de um BIN específico
   */
  async refreshBIN(bin: string): Promise<BINInfo> {
    this.cache.delete(bin);
    return await this.lookupBIN(bin);
  }

  /**
   * Pré-carrega BINs comuns para cache
   */
  async preloadCommonBINs(): Promise<void> {
    const commonBINs = [
      "444422", // Visa test
      "555522", // Mastercard test
      "555555", // Mastercard
      "444444", // Visa
      "376622", // Amex
      "601100", // Discover
      "352822", // JCB
      "506707", // Elo
      "636368", // Elo
      "606282", // Hipercard
    ];

    console.log("🔄 Pré-carregando BINs comuns...");

    for (const bin of commonBINs) {
      if (!this.cache.has(bin)) {
        const info = this.detectBINLocally(bin);
        this.setInCache(bin, info);
      }
    }

    console.log(`✓ ${commonBINs.length} BINs pré-carregados`);
  }

  /**
   * Exporta cache para backup
   */
  exportCache(): string {
    const data = Array.from(this.cache.entries());
    return JSON.stringify(data, null, 2);
  }

  /**
   * Importa cache de backup
   */
  importCache(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      this.cache = new Map(data);
      this.saveToStorage();
      console.log(`✓ Cache importado: ${this.cache.size} entradas`);
    } catch (error) {
      console.error("Erro ao importar cache:", error);
    }
  }
}

// Singleton instance
export const binCache = new BINCache();

// Helper functions para uso fácil
export const getBINInfo = (cardNumber: string) =>
  binCache.getBINInfo(cardNumber);
export const getBINStats = () => binCache.getStats();
export const clearBINCache = () => binCache.clearCache();
export const preloadBINs = () => binCache.preloadCommonBINs();

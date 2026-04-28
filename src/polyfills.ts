// 🛡️ POLYFILLS CRÍTICOS
// Garante que APIs essenciais estejam disponíveis em todos os ambientes

// ✅ POLYFILLS RE-HABILITADOS - Proteções mantidas para compatibilidade máxima

// 🛡️ PROTEÇÃO: Executar apenas em ambiente browser
if (typeof window === 'undefined') {
  console.warn('[POLYFILL] Not in browser environment, skipping polyfills');
} else {
  // Polyfill para URLSearchParams (caso não exista)
  if (typeof globalThis.URLSearchParams === 'undefined') {
    console.warn('[POLYFILL] URLSearchParams não encontrado - aplicando polyfill básico');
    
    class URLSearchParamsPolyfill {
      private params: Map<string, string[]>;

      constructor(init?: string | Record<string, string> | URLSearchParams) {
        this.params = new Map();
        
        if (typeof init === 'string') {
          // Parse query string
          const pairs = init.replace(/^\?/, '').split('&');
          for (const pair of pairs) {
            if (!pair) continue;
            const [key, value] = pair.split('=').map(decodeURIComponent);
            this.append(key, value || '');
          }
        } else if (init && typeof init === 'object') {
          for (const [key, value] of Object.entries(init)) {
            this.append(key, String(value));
          }
        }
      }

      append(name: string, value: string): void {
        const existing = this.params.get(name) || [];
        existing.push(String(value));
        this.params.set(name, existing);
      }

      delete(name: string): void {
        this.params.delete(name);
      }

      get(name: string): string | null {
        const values = this.params.get(name);
        return values && values.length > 0 ? values[0] : null;
      }

      getAll(name: string): string[] {
        return this.params.get(name) || [];
      }

      has(name: string): boolean {
        return this.params.has(name);
      }

      set(name: string, value: string): void {
        this.params.set(name, [String(value)]);
      }

      toString(): string {
        const parts: string[] = [];
        this.params.forEach((values, name) => {
          for (const value of values) {
            parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
          }
        });
        return parts.join('&');
      }

      entries(): IterableIterator<[string, string]> {
        const entries: [string, string][] = [];
        this.params.forEach((values, name) => {
          for (const value of values) {
            entries.push([name, value]);
          }
        });
        return entries[Symbol.iterator]();
      }

      keys(): IterableIterator<string> {
        return this.params.keys();
      }

      values(): IterableIterator<string> {
        const values: string[] = [];
        this.params.forEach((vals) => {
          values.push(...vals);
        });
        return values[Symbol.iterator]();
      }

      forEach(callback: (value: string, key: string, parent: URLSearchParams) => void): void {
        this.params.forEach((values, name) => {
          for (const value of values) {
            callback(value, name, this as any);
          }
        });
      }

      [Symbol.iterator](): IterableIterator<[string, string]> {
        return this.entries();
      }
    }

    // @ts-ignore - Assign polyfill to global
    globalThis.URLSearchParams = URLSearchParamsPolyfill;
  }

  // Polyfill para URL (caso não exista)
  if (typeof globalThis.URL === 'undefined') {
    console.warn('[POLYFILL] URL não encontrado - aplicando polyfill básico');
    
    class URLPolyfill {
      protocol: string;
      hostname: string;
      port: string;
      pathname: string;
      search: string;
      hash: string;
      username: string;
      password: string;
      searchParams: URLSearchParams;

      constructor(url: string, base?: string) {
        // Parse URL manualmente
        const urlString = base ? this.resolve(base, url) : url;
        
        // Regex básico para parse de URL
        const urlPattern = /^(?:([^:/?#]+):)?(?:\/\/(?:([^:@]*)(?::([^@]*))?@)?([^:/?#]*)(?::(\d+))?)?([^?#]*)(\?[^#]*)?(#.*)?/;
        const match = urlString.match(urlPattern);

        if (!match) {
          throw new TypeError('Invalid URL');
        }

        this.protocol = (match[1] || '') + (match[1] ? ':' : '');
        this.username = match[2] || '';
        this.password = match[3] || '';
        this.hostname = match[4] || '';
        this.port = match[5] || '';
        this.pathname = match[6] || '/';
        this.search = match[7] || '';
        this.hash = match[8] || '';
        this.searchParams = new URLSearchParams(this.search);
      }

      private resolve(base: string, relative: string): string {
        // Implementação simples de resolução de URLs
        if (relative.startsWith('http://') || relative.startsWith('https://')) {
          return relative;
        }
        
        const baseUrl = new URLPolyfill(base);
        if (relative.startsWith('/')) {
          return `${baseUrl.protocol}//${baseUrl.host}${relative}`;
        }
        
        const basePath = baseUrl.pathname.split('/').slice(0, -1).join('/');
        return `${baseUrl.protocol}//${baseUrl.host}${basePath}/${relative}`;
      }

      get host(): string {
        return this.port ? `${this.hostname}:${this.port}` : this.hostname;
      }

      get origin(): string {
        return `${this.protocol}//${this.host}`;
      }

      get href(): string {
        const auth = this.username ? `${this.username}${this.password ? ':' + this.password : ''}@` : '';
        return `${this.protocol}//${auth}${this.host}${this.pathname}${this.search}${this.hash}`;
      }

      toString(): string {
        return this.href;
      }

      toJSON(): string {
        return this.href;
      }

      // Static methods
      static createObjectURL(blob: Blob): string {
        // Fallback simples - gera um blob URL fake
        console.warn('[POLYFILL] URL.createObjectURL usando fallback');
        return `blob:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      static revokeObjectURL(url: string): void {
        // Fallback - não faz nada
        console.warn('[POLYFILL] URL.revokeObjectURL usando fallback');
      }
    }

    // @ts-ignore - Assign polyfill to global
    globalThis.URL = URLPolyfill as any;
  } else {
    // URL existe, mas garantir que createObjectURL e revokeObjectURL existem
    if (!globalThis.URL.createObjectURL) {
      console.warn('[POLYFILL] URL.createObjectURL não encontrado - aplicando fallback');
      globalThis.URL.createObjectURL = (blob: Blob): string => {
        console.warn('[POLYFILL] URL.createObjectURL usando fallback');
        return `blob:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      };
    }
    
    if (!globalThis.URL.revokeObjectURL) {
      console.warn('[POLYFILL] URL.revokeObjectURL não encontrado - aplicando fallback');
      globalThis.URL.revokeObjectURL = (url: string): void => {
        console.warn('[POLYFILL] URL.revokeObjectURL usando fallback');
      };
    }
  }

  // Garante que globalThis está disponível
  if (typeof globalThis === 'undefined') {
    // @ts-ignore
    (typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : this).globalThis = 
      typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : this;
  }

  console.log('[POLYFILLS] ✅ Polyfills aplicados com sucesso', {
    URLSearchParams: typeof globalThis.URLSearchParams !== 'undefined',
    URL: typeof globalThis.URL !== 'undefined',
    globalThis: typeof globalThis !== 'undefined'
  });
}
/**
 * 🔄 RESILIENT API CLIENT
 * 
 * This module provides a robust API client with:
 * - Exponential backoff retry logic
 * - Automatic reconnection on transient failures
 * - Request timeout handling
 * - Detailed error logging
 * 
 * Designed for: Supabase Physical Backup Migration (Jan 26, 2026)
 */

interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  timeout: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 200,
  maxDelay: 5000,
  backoffMultiplier: 2,
  timeout: 30000, // 30 seconds
};

// HTTP status codes that should trigger retry
const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Check if an error/response should trigger a retry
 */
function isRetryable(error: any, response?: Response): boolean {
  // Network errors (fetch failures)
  if (error && !response) {
    const errorMsg = error.message?.toLowerCase() || '';
    const networkKeywords = [
      'network',
      'fetch',
      'connection',
      'timeout',
      'abort',
      'econnrefused',
      'econnreset',
    ];
    
    if (networkKeywords.some(keyword => errorMsg.includes(keyword))) {
      return true;
    }
  }
  
  // HTTP status codes
  if (response && RETRYABLE_STATUS_CODES.includes(response.status)) {
    return true;
  }
  
  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = Math.min(
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );
  
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(exponentialDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Resilient fetch with automatic retry
 */
export async function resilientFetch(
  url: string,
  options: RequestInit = {},
  retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  let lastError: any;
  let lastResponse: Response | undefined;
  
  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      // Log retry attempts (skip first attempt)
      if (attempt > 0) {
        console.log(
          `[API-RETRY] Attempt ${attempt + 1}/${config.maxAttempts} for ${url}`
        );
      }
      
      const response = await fetchWithTimeout(url, options, config.timeout);
      
      // Check if response is successful
      if (response.ok) {
        // Log successful retry
        if (attempt > 0) {
          console.log(
            `[API-RETRY] ✅ Success for ${url} after ${attempt + 1} attempts`
          );
        }
        return response;
      }
      
      // Check if error is retryable
      if (!isRetryable(null, response)) {
        console.error(
          `[API-RETRY] ❌ Non-retryable status ${response.status} for ${url}`
        );
        return response; // Return error response for caller to handle
      }
      
      lastResponse = response;
      
      // Check if we have more attempts
      if (attempt >= config.maxAttempts - 1) {
        console.error(
          `[API-RETRY] ❌ Max attempts (${config.maxAttempts}) reached for ${url}`
        );
        break;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);
      console.warn(
        `[API-RETRY] ⚠️ Status ${response.status} for ${url}. ` +
        `Retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxAttempts})...`
      );
      
      await sleep(delay);
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      if (!isRetryable(error)) {
        console.error(
          `[API-RETRY] ❌ Non-retryable error for ${url}:`,
          error.message || error
        );
        throw error;
      }
      
      // Check if we have more attempts
      if (attempt >= config.maxAttempts - 1) {
        console.error(
          `[API-RETRY] ❌ Max attempts (${config.maxAttempts}) reached for ${url}`
        );
        break;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);
      console.warn(
        `[API-RETRY] ⚠️ Error for ${url}: ${error.message || error}. ` +
        `Retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxAttempts})...`
      );
      
      await sleep(delay);
    }
  }
  
  // All retries exhausted
  if (lastResponse) {
    console.error(
      `[API-RETRY] 💥 Failed after ${config.maxAttempts} attempts for ${url}: Status ${lastResponse.status}`
    );
    return lastResponse;
  }
  
  console.error(
    `[API-RETRY] 💥 Failed after ${config.maxAttempts} attempts for ${url}:`,
    lastError?.message || lastError
  );
  throw lastError;
}

/**
 * Resilient JSON API call
 */
export async function apiCall<T = any>(
  url: string,
  options: RequestInit = {},
  retryConfig?: Partial<RetryConfig>
): Promise<T> {
  const response = await resilientFetch(url, options, retryConfig);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
  
  return await response.json();
}

/**
 * Create a typed API client for a specific base URL
 */
export function createApiClient(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
  return {
    get: <T = any>(path: string, options: RequestInit = {}, retryConfig?: Partial<RetryConfig>): Promise<T> => {
      return apiCall<T>(
        `${baseUrl}${path}`,
        {
          ...options,
          method: 'GET',
          headers: {
            ...defaultHeaders,
            ...options.headers,
          },
        },
        retryConfig
      );
    },
    
    post: <T = any>(path: string, body?: any, options: RequestInit = {}, retryConfig?: Partial<RetryConfig>): Promise<T> => {
      return apiCall<T>(
        `${baseUrl}${path}`,
        {
          ...options,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...defaultHeaders,
            ...options.headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        retryConfig
      );
    },
    
    put: <T = any>(path: string, body?: any, options: RequestInit = {}, retryConfig?: Partial<RetryConfig>): Promise<T> => {
      return apiCall<T>(
        `${baseUrl}${path}`,
        {
          ...options,
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...defaultHeaders,
            ...options.headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        retryConfig
      );
    },
    
    delete: <T = any>(path: string, options: RequestInit = {}, retryConfig?: Partial<RetryConfig>): Promise<T> => {
      return apiCall<T>(
        `${baseUrl}${path}`,
        {
          ...options,
          method: 'DELETE',
          headers: {
            ...defaultHeaders,
            ...options.headers,
          },
        },
        retryConfig
      );
    },
  };
}

console.log('[API-CLIENT] 🔄 Resilient API client module loaded');
console.log('[API-CLIENT] ✅ Auto-retry enabled for all requests');
console.log('[API-CLIENT] 🛡️ Protected against transient network failures');

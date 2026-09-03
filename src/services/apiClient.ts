import { API_BASE_URL } from '../utils/api';
import { AUTH_SESSION_CHANGED_EVENT, endSession, isSessionActive } from '../features/auth/services/sessionService';

interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  timeout?: number;
  cacheTTL?: number;
  disableCache?: boolean;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  [key: string]: any;
}

class ApiError extends Error {
  statusCode?: number;
  data?: any;

  constructor(message: string, statusCode?: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

type BlobRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
};

type CacheEntry = {
  expiry: number;
  value: ApiResponse<any>;
};

export class ApiClient {
  private config: Required<ApiConfig>;
  private getInFlight = new Map<string, Promise<ApiResponse<any>>>();
  private getCache = new Map<string, CacheEntry>();
  private cacheGeneration = 0;
  private readonly defaultGetTTL = 5000;
  private messageHandler: any = null;

  constructor(config: ApiConfig) {
    this.config = {
      baseURL: config.baseURL,
      timeout: config.timeout ?? 30000,
      headers: config.headers ?? {},
    };
    // Responses must never survive an account switch.  The cache is local to
    // this client, so clear both completed and in-flight GET requests.
    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_SESSION_CHANGED_EVENT, () => this.clearCache());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.clearCache();
      });
    }
  }

  clearCache() {
    this.cacheGeneration += 1;
    this.getCache.clear();
    this.getInFlight.clear();
  }

  setMessageHandler(handler: any) {
    this.messageHandler = handler;
  }

  private getStoredToken() {
    try {
      if (!isSessionActive()) {
        endSession('登录已超时，请重新登录');
        return '';
      }
      return localStorage.getItem('token') || localStorage.getItem('authToken') || '';
    } catch {
      return '';
    }
  }

  private buildUrl(endpoint: string, params?: Record<string, any>) {
    const baseURL = this.config.baseURL.replace(/\/$/, '');
    const path = endpoint.replace(/^\//, '');
    let url = `${baseURL}/${path}`;

    const queryString = new URLSearchParams(
      Object.entries(params || {})
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)]),
    ).toString();

    if (queryString) {
      url += `?${queryString}`;
    }

    return url;
  }

  private createTimeoutPromise(timeout: number) {
    return new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new ApiError(`请求超时（${timeout}ms）`)), timeout);
    });
  }

  private async parseJsonSafely(response: Response) {
    try {
      return await response.json();
    } catch {
      return { message: '服务器返回的数据格式无效' };
    }
  }

  private async processJsonResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const data = await this.parseJsonSafely(response);

    if (response.ok) {
      return {
        success: true,
        data: data.data ?? data,
        message: data.message,
      };
    }

    throw new ApiError(
      data.message || data.error || response.statusText || '请求失败',
      response.status,
      data,
    );
  }

  private async processBlobResponse(response: Response) {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ApiError(text || response.statusText || '请求失败', response.status);
    }

    return response.blob();
  }

  private buildHeaders(options: RequestOptions | BlobRequestOptions, token: string, hasJsonBody: boolean) {
    return {
      ...this.config.headers,
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
    };
  }

  private async sendWithTimeout<T>(fetcher: () => Promise<T>, timeout: number) {
    return Promise.race([fetcher(), this.createTimeoutPromise(timeout)]);
  }

  private async withAuthRetry<T>(
    requestFactory: (token: string) => Promise<T>,
    timeout: number,
    method: string,
  ) {
    let token = this.getStoredToken();

    if (!token && method !== 'GET') {
      const autoLoggedIn = await this.tryAutoLogin();
      if (autoLoggedIn) {
        token = this.getStoredToken();
      }
    }

    try {
      return await this.sendWithTimeout(() => requestFactory(token), timeout);
    } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 401) {
        if (error instanceof ApiError && error.statusCode === 403) {
          try {
            this.messageHandler?.error('没有权限执行此操作');
          } catch {}
        }

        throw error;
      }

      const autoLoggedIn = await this.tryAutoLogin();
      if (!autoLoggedIn) {
        try {
          this.messageHandler?.warning('登录状态已失效，请重新登录');
        } catch {}
        throw error;
      }

      const retryToken = this.getStoredToken();
      return this.sendWithTimeout(() => requestFactory(retryToken), timeout);
    }
  }

  private createJsonRequestInit(options: RequestOptions, token: string): RequestInit {
    const hasJsonBody = options.body !== undefined && !(options.body instanceof FormData);

    return {
      ...options,
      headers: this.buildHeaders(options, token, hasJsonBody),
    };
  }

  private invalidateGetCache(endpoint: string) {
    for (const key of this.getCache.keys()) {
      if (key.includes(endpoint)) {
        this.getCache.delete(key);
      }
    }
  }

  async get<T = any>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint, options.params);
    const ttl = options.cacheTTL ?? this.defaultGetTTL;

    if (!options.disableCache) {
      const cached = this.getCache.get(url);
      if (cached && cached.expiry > Date.now()) {
        return cached.value as ApiResponse<T>;
      }

      const inFlight = this.getInFlight.get(url);
      if (inFlight) {
        return inFlight as Promise<ApiResponse<T>>;
      }
    }

    const requestGeneration = this.cacheGeneration;
    const requestPromise = this.withAuthRetry<ApiResponse<T>>(async (token) => {
      const response = await fetch(
        url,
        this.createJsonRequestInit({ ...options, method: 'GET', params: undefined }, token),
      );
      return this.processJsonResponse<T>(response);
    }, options.timeout ?? this.config.timeout, 'GET')
      .then((response) => {
        if (!options.disableCache && requestGeneration === this.cacheGeneration) {
          this.getCache.set(url, { expiry: Date.now() + ttl, value: response });
          this.getInFlight.delete(url);
        }

        return response;
      })
      .catch((error) => {
        if (!options.disableCache && requestGeneration === this.cacheGeneration) {
          this.getInFlight.delete(url);
        }
        throw error;
      });

    if (!options.disableCache) {
      this.getInFlight.set(url, requestPromise as Promise<ApiResponse<any>>);
    }

    return requestPromise;
  }

  async post<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method'> = {}) {
    const url = this.buildUrl(endpoint, options.params);
    this.invalidateGetCache(endpoint);

    return this.withAuthRetry<ApiResponse<T>>(async (token) => {
      const response = await fetch(
        url,
        this.createJsonRequestInit(
          {
            ...options,
            method: 'POST',
            params: undefined,
            body: JSON.stringify(data),
          },
          token,
        ),
      );

      return this.processJsonResponse<T>(response);
    }, options.timeout ?? this.config.timeout, 'POST');
  }

  async put<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method'> = {}) {
    const url = this.buildUrl(endpoint, options.params);
    this.invalidateGetCache(endpoint);

    return this.withAuthRetry<ApiResponse<T>>(async (token) => {
      const response = await fetch(
        url,
        this.createJsonRequestInit(
          {
            ...options,
            method: 'PUT',
            params: undefined,
            body: JSON.stringify(data),
          },
          token,
        ),
      );

      return this.processJsonResponse<T>(response);
    }, options.timeout ?? this.config.timeout, 'PUT');
  }

  async patch<T = any>(endpoint: string, data?: any, options: Omit<RequestOptions, 'method'> = {}) {
    const url = this.buildUrl(endpoint, options.params);
    this.invalidateGetCache(endpoint);

    return this.withAuthRetry<ApiResponse<T>>(async (token) => {
      const response = await fetch(
        url,
        this.createJsonRequestInit(
          {
            ...options,
            method: 'PATCH',
            params: undefined,
            body: JSON.stringify(data),
          },
          token,
        ),
      );

      return this.processJsonResponse<T>(response);
    }, options.timeout ?? this.config.timeout, 'PATCH');
  }

  async delete<T = any>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}) {
    const url = this.buildUrl(endpoint, options.params);
    this.invalidateGetCache(endpoint);

    return this.withAuthRetry<ApiResponse<T>>(async (token) => {
      const response = await fetch(
        url,
        this.createJsonRequestInit(
          {
            ...options,
            method: 'DELETE',
            params: undefined,
          },
          token,
        ),
      );

      return this.processJsonResponse<T>(response);
    }, options.timeout ?? this.config.timeout, 'DELETE');
  }

  async upload<T = any>(
    endpoint: string,
    file: File | FormData,
    options: Omit<RequestOptions, 'method' | 'headers'> = {},
  ) {
    const url = this.buildUrl(endpoint, options.params);
    this.invalidateGetCache(endpoint);
    const formData = file instanceof FormData ? file : new FormData();

    if (!(file instanceof FormData)) {
      formData.append('file', file);
    }

    return this.withAuthRetry<ApiResponse<T>>(async (token) => {
      const response = await fetch(url, {
        ...options,
        method: 'POST',
        body: formData,
        headers: this.buildHeaders(options, token, false),
      });

      return this.processJsonResponse<T>(response);
    }, options.timeout ?? this.config.timeout, 'POST');
  }

  async download(endpoint: string, options: BlobRequestOptions = {}) {
    const url = this.buildUrl(endpoint, options.params);
    const method = (options.method || 'GET').toUpperCase();
    const hasJsonBody = method !== 'GET' && !(options.data instanceof FormData);

    return this.withAuthRetry<Blob>(async (token) => {
      const response = await fetch(url, {
        method,
        headers: this.buildHeaders(options, token, hasJsonBody),
        ...(method !== 'GET'
          ? {
              body: options.data instanceof FormData
                ? options.data
                : JSON.stringify(options.data ?? {}),
            }
          : {}),
      });

      return this.processBlobResponse(response);
    }, options.timeout ?? this.config.timeout, method);
  }

  async tryAutoLogin(): Promise<boolean> {
    return false;
  }
}

const defaultApiClient = new ApiClient({
  baseURL: API_BASE_URL,
});

try {
  console.info('[api] baseURL', API_BASE_URL);
} catch {}

export function handleApiError(error: any): string {
  if (error instanceof ApiError) {
    return error.message || '接口请求失败';
  }

  if (error instanceof Error) {
    return error.message || '请求失败';
  }

  return '未知错误';
}

export default defaultApiClient;

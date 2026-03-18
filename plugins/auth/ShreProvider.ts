import type {
  AuthProvider,
  Credentials,
  AuthResult,
  TokenPayload,
  User,
  CreateUserInput,
  UpdateUserInput,
} from './ArosProvider.js';

interface ShreConfig {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
}

export class ShreProvider implements AuthProvider {
  private endpoint: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: ShreConfig) {
    if (!config.endpoint) {
      throw new Error('ShreProvider requires an endpoint. Set shre.endpoint in aros.config.json.');
    }
    this.endpoint = config.endpoint.replace(/\/$/, '');
    this.apiKey = config.apiKey ?? '';
    this.timeout = config.timeout ?? 10_000;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.endpoint}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        throw new Error(`Shre ${method} ${path} failed (${res.status}): ${text}`);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async authenticate(credentials: Credentials): Promise<AuthResult> {
    return this.request<AuthResult>('POST', '/v1/auth/login', credentials);
  }

  async validate(token: string): Promise<TokenPayload> {
    return this.request<TokenPayload>('POST', '/v1/auth/validate', { token });
  }

  async refresh(token: string): Promise<AuthResult> {
    return this.request<AuthResult>('POST', '/v1/auth/refresh', { token });
  }

  async revoke(token: string): Promise<void> {
    await this.request<void>('POST', '/v1/auth/revoke', { token });
  }

  async createUser(user: CreateUserInput): Promise<User> {
    return this.request<User>('POST', '/v1/users', user);
  }

  async getUser(id: string): Promise<User | null> {
    try {
      return await this.request<User>('GET', `/v1/users/${id}`);
    } catch {
      return null;
    }
  }

  async updateUser(id: string, update: UpdateUserInput): Promise<User> {
    return this.request<User>('PATCH', `/v1/users/${id}`, update);
  }

  async deleteUser(id: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/users/${id}`);
  }
}

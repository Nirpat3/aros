import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Credentials {
  email: string;
  password: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface AuthResult {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: string;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
}

export interface AuthProvider {
  authenticate(credentials: Credentials): Promise<AuthResult>;
  validate(token: string): Promise<TokenPayload>;
  refresh(token: string): Promise<AuthResult>;
  revoke(token: string): Promise<void>;
  createUser(user: CreateUserInput): Promise<User>;
  getUser(id: string): Promise<User | null>;
  updateUser(id: string, update: UpdateUserInput): Promise<User>;
  deleteUser(id: string): Promise<void>;
}

// ── Vault ──────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const DATA_DIR = join(process.cwd(), '.aros-data');
const VAULT_FILE = join(DATA_DIR, 'vault.enc');
const USERS_FILE = join(DATA_DIR, 'users.enc');

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function encrypt(data: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function decrypt(payload: string, key: Buffer): string {
  const [ivHex, tagHex, encrypted] = payload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ── Storage helpers ────────────────────────────────────────────────────────

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadEncryptedStore<T>(file: string, key: Buffer): T {
  if (!existsSync(file)) return {} as T;
  const raw = readFileSync(file, 'utf8');
  return JSON.parse(decrypt(raw, key));
}

function saveEncryptedStore<T>(file: string, data: T, key: Buffer): void {
  ensureDataDir();
  writeFileSync(file, encrypt(JSON.stringify(data), key), 'utf8');
}

// ── Token helpers ──────────────────────────────────────────────────────────

function generateId(): string {
  return randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function createToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, secret: string, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const full: TokenPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const key = deriveKey(secret);
  return encrypt(JSON.stringify(full), key);
}

function decodeToken(token: string, secret: string): TokenPayload {
  const key = deriveKey(secret);
  const raw = decrypt(token, key);
  return JSON.parse(raw);
}

// ── User store shape ───────────────────────────────────────────────────────

interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
}

type UserStore = Record<string, StoredUser>;

// ── ArosProvider ──────────────────────────────────────────────────────────

const TOKEN_TTL = 3600; // 1 hour
const REFRESH_TTL = 86400 * 7; // 7 days

export class ArosProvider implements AuthProvider {
  private secret: string;
  private key: Buffer;
  private revokedTokens = new Set<string>();

  constructor(secret?: string) {
    this.secret = secret ?? process.env.AROS_SECRET ?? randomBytes(32).toString('hex');
    this.key = deriveKey(this.secret);
  }

  private loadUsers(): UserStore {
    return loadEncryptedStore<UserStore>(USERS_FILE, this.key);
  }

  private saveUsers(users: UserStore): void {
    saveEncryptedStore(USERS_FILE, users, this.key);
  }

  private toPublicUser(stored: StoredUser): User {
    return {
      id: stored.id,
      email: stored.email,
      name: stored.name,
      role: stored.role,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    };
  }

  async authenticate(credentials: Credentials): Promise<AuthResult> {
    const users = this.loadUsers();
    const user = Object.values(users).find((u) => u.email === credentials.email);
    if (!user) throw new Error('Invalid credentials');

    const hash = hashPassword(credentials.password, user.salt);
    if (hash !== user.passwordHash) throw new Error('Invalid credentials');

    const token = createToken({ sub: user.id, email: user.email, role: user.role }, this.secret, TOKEN_TTL);
    const refreshToken = createToken({ sub: user.id, email: user.email, role: user.role }, this.secret, REFRESH_TTL);

    return { token, refreshToken, expiresIn: TOKEN_TTL, user: this.toPublicUser(user) };
  }

  async validate(token: string): Promise<TokenPayload> {
    if (this.revokedTokens.has(token)) throw new Error('Token revoked');
    const payload = decodeToken(token, this.secret);
    if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
    return payload;
  }

  async refresh(token: string): Promise<AuthResult> {
    const payload = await this.validate(token);
    this.revokedTokens.add(token);

    const users = this.loadUsers();
    const user = users[payload.sub];
    if (!user) throw new Error('User not found');

    const newToken = createToken({ sub: user.id, email: user.email, role: user.role }, this.secret, TOKEN_TTL);
    const newRefresh = createToken({ sub: user.id, email: user.email, role: user.role }, this.secret, REFRESH_TTL);

    return { token: newToken, refreshToken: newRefresh, expiresIn: TOKEN_TTL, user: this.toPublicUser(user) };
  }

  async revoke(token: string): Promise<void> {
    this.revokedTokens.add(token);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const users = this.loadUsers();

    const existing = Object.values(users).find((u) => u.email === input.email);
    if (existing) throw new Error('User with this email already exists');

    const id = generateId();
    const salt = randomBytes(16).toString('hex');
    const now = new Date().toISOString();

    const stored: StoredUser = {
      id,
      email: input.email,
      name: input.name,
      role: input.role ?? 'operator',
      passwordHash: hashPassword(input.password, salt),
      salt,
      createdAt: now,
      updatedAt: now,
    };

    users[id] = stored;
    this.saveUsers(users);
    return this.toPublicUser(stored);
  }

  async getUser(id: string): Promise<User | null> {
    const users = this.loadUsers();
    const user = users[id];
    return user ? this.toPublicUser(user) : null;
  }

  async updateUser(id: string, update: UpdateUserInput): Promise<User> {
    const users = this.loadUsers();
    const user = users[id];
    if (!user) throw new Error('User not found');

    if (update.email) user.email = update.email;
    if (update.name) user.name = update.name;
    if (update.role) user.role = update.role;
    if (update.password) {
      user.salt = randomBytes(16).toString('hex');
      user.passwordHash = hashPassword(update.password, user.salt);
    }
    user.updatedAt = new Date().toISOString();

    users[id] = user;
    this.saveUsers(users);
    return this.toPublicUser(user);
  }

  async deleteUser(id: string): Promise<void> {
    const users = this.loadUsers();
    if (!users[id]) throw new Error('User not found');
    delete users[id];
    this.saveUsers(users);
  }
}

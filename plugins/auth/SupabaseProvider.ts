import type {
  AuthProvider,
  Credentials,
  AuthResult,
  TokenPayload,
  User,
  CreateUserInput,
  UpdateUserInput,
} from './ArosProvider.js';
import { createSupabaseClient, createSupabaseAdmin } from '../../src/supabase.js';

// ── SupabaseProvider ─────────────────────────────────────────────────────

export class SupabaseProvider implements AuthProvider {
  /**
   * Authenticate with email + password via Supabase Auth.
   */
  async authenticate(credentials: Credentials): Promise<AuthResult> {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error || !data.session || !data.user) {
      console.error('[supabase-auth] login failed:', error?.message);
      throw new Error(error?.message ?? 'Authentication failed');
    }

    const user = await this.resolveUser(data.user.id, data.session.access_token);

    return {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      user,
    };
  }

  /**
   * Create a new user via Supabase Auth with metadata.
   */
  async createUser(input: CreateUserInput): Promise<User> {
    const admin = createSupabaseAdmin();

    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        name: input.name,
        role: input.role ?? 'operator',
      },
    });

    if (error || !data.user) {
      console.error('[supabase-auth] signup failed:', error?.message);
      throw new Error(error?.message ?? 'Signup failed');
    }

    const now = new Date().toISOString();
    return {
      id: data.user.id,
      email: data.user.email ?? input.email,
      name: input.name,
      role: input.role ?? 'operator',
      createdAt: data.user.created_at ?? now,
      updatedAt: now,
    };
  }

  /**
   * Validate an access token and return the decoded payload.
   */
  async validate(token: string): Promise<TokenPayload> {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      console.error('[supabase-auth] token validation failed:', error?.message);
      throw new Error(error?.message ?? 'Invalid token');
    }

    const now = Math.floor(Date.now() / 1000);
    return {
      sub: data.user.id,
      email: data.user.email ?? '',
      role: (data.user.user_metadata?.role as string) ?? 'operator',
      iat: now,
      exp: now + 3600, // Supabase manages actual expiry; approximate for interface compat
    };
  }

  /**
   * Refresh a session using the refresh token.
   */
  async refresh(refreshTokenValue: string): Promise<AuthResult> {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshTokenValue,
    });

    if (error || !data.session || !data.user) {
      console.error('[supabase-auth] refresh failed:', error?.message);
      throw new Error(error?.message ?? 'Token refresh failed');
    }

    const user = await this.resolveUser(data.user.id, data.session.access_token);

    return {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      user,
    };
  }

  /**
   * Revoke / sign out a session.
   */
  async revoke(_token: string): Promise<void> {
    const supabase = createSupabaseClient();

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[supabase-auth] sign out failed:', error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Get a user by ID, enriched with tenant data when available.
   */
  async getUser(id: string): Promise<User | null> {
    const admin = createSupabaseAdmin();

    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error || !data.user) {
      return null;
    }

    // Try to enrich from tenants table
    const { data: tenantRow } = await admin
      .from('tenants')
      .select('name, plan')
      .eq('owner_id', id)
      .maybeSingle();

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      name: (data.user.user_metadata?.name as string) ?? tenantRow?.name ?? '',
      role: (data.user.user_metadata?.role as string) ?? 'operator',
      createdAt: data.user.created_at ?? '',
      updatedAt: data.user.updated_at ?? data.user.created_at ?? '',
    };
  }

  /**
   * Update user profile (email, name, role, password).
   */
  async updateUser(id: string, update: UpdateUserInput): Promise<User> {
    const admin = createSupabaseAdmin();

    const attrs: Record<string, unknown> = {};
    if (update.email) attrs.email = update.email;
    if (update.password) attrs.password = update.password;

    const metadata: Record<string, string> = {};
    if (update.name) metadata.name = update.name;
    if (update.role) metadata.role = update.role;
    if (Object.keys(metadata).length > 0) attrs.user_metadata = metadata;

    const { data, error } = await admin.auth.admin.updateUserById(id, attrs);
    if (error || !data.user) {
      console.error('[supabase-auth] update user failed:', error?.message);
      throw new Error(error?.message ?? 'User update failed');
    }

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      name: (data.user.user_metadata?.name as string) ?? '',
      role: (data.user.user_metadata?.role as string) ?? 'operator',
      createdAt: data.user.created_at ?? '',
      updatedAt: data.user.updated_at ?? data.user.created_at ?? '',
    };
  }

  /**
   * Delete a user via admin API.
   */
  async deleteUser(id: string): Promise<void> {
    const admin = createSupabaseAdmin();

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      console.error('[supabase-auth] delete user failed:', error.message);
      throw new Error(error.message);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Resolve a Supabase user into the AROS User shape, joining tenant data
   * if available.
   */
  private async resolveUser(userId: string, accessToken: string): Promise<User> {
    const supabase = createSupabaseClient();

    // Get user profile from Supabase Auth
    const { data: authData } = await supabase.auth.getUser(accessToken);
    const authUser = authData?.user;

    // Try to get tenant info for richer profile
    const admin = createSupabaseAdmin();
    const { data: tenantRow } = await admin
      .from('tenants')
      .select('name')
      .eq('owner_id', userId)
      .maybeSingle();

    const now = new Date().toISOString();

    return {
      id: userId,
      email: authUser?.email ?? '',
      name: (authUser?.user_metadata?.name as string) ?? tenantRow?.name ?? '',
      role: (authUser?.user_metadata?.role as string) ?? 'operator',
      createdAt: authUser?.created_at ?? now,
      updatedAt: authUser?.updated_at ?? authUser?.created_at ?? now,
    };
  }
}

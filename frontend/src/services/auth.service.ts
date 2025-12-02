import { apiService } from './api.service';

export interface User {
  id: string;
  email: string;
  isLocalMode: boolean;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
}

export interface LocalModeStatus {
  available: boolean;
  message: string;
}

class AuthService {
  private readonly TOKEN_KEY = 'homehub_token';
  private readonly USER_KEY = 'homehub_user';

  /**
   * Enregistre un nouvel utilisateur
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const response = await apiService.post<AuthResponse>('/auth/register', dto);
    this.setToken(response.access_token);
    this.setUser(response.user);
    return response;
  }

  /**
   * Authentifie un utilisateur
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const response = await apiService.post<AuthResponse>('/auth/login', dto);
    this.setToken(response.access_token);
    this.setUser(response.user);
    return response;
  }

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  /**
   * Récupère le token JWT
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Définit le token JWT
   */
  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * Récupère l'utilisateur actuel
   */
  getUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Définit l'utilisateur actuel
   */
  setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  /**
   * Vérifie si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Récupère le profil de l'utilisateur
   */
  async getProfile(): Promise<User> {
    return apiService.get<User>('/auth/me');
  }

  /**
   * Vérifie si le mode local est disponible
   */
  async checkLocalMode(): Promise<LocalModeStatus> {
    return apiService.get<LocalModeStatus>('/auth/local-mode');
  }
}

export const authService = new AuthService();


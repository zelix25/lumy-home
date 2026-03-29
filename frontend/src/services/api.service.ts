import { getAppPathname, getTunnelLoginHref } from '../utils/appPathname';
import i18n from '../i18n';

// Utiliser un chemin relatif pour passer par le proxy nginx
// En développement local, utilise VITE_API_URL si défini, sinon utilise /api
// En production Docker, nginx fait le proxy de /api vers backend:3000
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function tryParseJsonErrorMessage(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    const j = JSON.parse(trimmed) as {
      message?: string | string[];
      error?: string;
    };
    if (Array.isArray(j.message)) return j.message.join(', ');
    if (typeof j.message === 'string') return j.message;
    if (typeof j.error === 'string') return j.error;
    return null;
  } catch {
    return null;
  }
}

function isLikelyHtmlErrorPage(body: string): boolean {
  const s = body.trim().slice(0, 256).toLowerCase();
  return (
    s.startsWith('<!doctype') ||
    s.startsWith('<html') ||
    s.includes('<html') ||
    s.includes('<head><title>')
  );
}

/** Message lisible : pas de page HTML nginx / reverse-proxy affichée telle quelle. */
function getUserFacingHttpError(status: number, bodyText: string): string {
  const fromJson = tryParseJsonErrorMessage(bodyText);
  if (fromJson) return fromJson;

  const trimmed = bodyText.trim();
  if (
    trimmed &&
    !isLikelyHtmlErrorPage(bodyText) &&
    trimmed.length < 400 &&
    !trimmed.includes('<')
  ) {
    return trimmed;
  }

  if (status === 502 || status === 503 || status === 504) {
    return i18n.t('apiErrors.serverUnreachable');
  }
  if (status === 500) {
    return i18n.t('apiErrors.serverError');
  }
  return i18n.t('apiErrors.requestFailed', { status });
}

class ApiService {
  private baseUrl: string;

  constructor() {
    // Si l'URL commence par http:// ou https://, c'est une URL absolue
    // Sinon, c'est un chemin relatif qui sera résolu par le navigateur
    this.baseUrl = API_BASE_URL;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Ajouter le token JWT si disponible
    const token = localStorage.getItem('lumy_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      // Log pour debug si le token est manquant
      if (getAppPathname() === '/setup') {
        console.warn('Token JWT manquant lors de la requête API');
      }
    }

    return headers;
  }

  private async safeFetch(input: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(input, init);
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        throw new Error(i18n.t('apiErrors.networkError'));
      }
      throw err;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    // Si baseUrl est un chemin relatif, on doit s'assurer que endpoint commence par /
    const url = this.baseUrl.startsWith('http') 
      ? `${this.baseUrl}${endpoint}` 
      : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await this.safeFetch(url, {
      headers: this.getHeaders(),
    });
    
    if (response.status === 401) {
      // Token invalide ou expiré
      localStorage.removeItem('lumy_token');
      localStorage.removeItem('lumy_user');
      // Ne rediriger que si on n'est pas déjà sur la page de login ou de setup
      if (getAppPathname() !== '/login' && getAppPathname() !== '/setup') {
        window.location.href = getTunnelLoginHref();
      }
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(getUserFacingHttpError(response.status, errorText));
    }
    
    // Si la réponse est 204 No Content, retourner null
    if (response.status === 204) {
      return null as T;
    }
    
    // Vérifier le type de contenu
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return null as T;
    }
    
    // Vérifier si la réponse a du contenu avant de parser en JSON
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null as T;
    }
    
    try {
      return JSON.parse(text);
    } catch (error) {
      // Si le parsing échoue, retourner null au lieu de lancer une erreur
      console.warn('Failed to parse JSON response:', text);
      return null as T;
    }
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const url = this.baseUrl.startsWith('http') 
      ? `${this.baseUrl}${endpoint}` 
      : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await this.safeFetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (response.status === 401) {
      // Ne pas supprimer le token si on est sur la page de setup (l'utilisateur vient peut-être de créer son compte)
      if (getAppPathname() !== '/setup') {
        localStorage.removeItem('lumy_token');
        localStorage.removeItem('lumy_user');
        // Ne rediriger que si on n'est pas déjà sur la page de login
        if (getAppPathname() !== '/login') {
          window.location.href = getTunnelLoginHref();
        }
      }
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(getUserFacingHttpError(response.status, errorText));
    }
    return response.json();
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const url = this.baseUrl.startsWith('http') 
      ? `${this.baseUrl}${endpoint}` 
      : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await this.safeFetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (response.status === 401) {
      // Ne pas supprimer le token si on est sur la page de setup (l'utilisateur vient peut-être de créer son compte)
      if (getAppPathname() !== '/setup') {
        localStorage.removeItem('lumy_token');
        localStorage.removeItem('lumy_user');
        // Ne rediriger que si on n'est pas déjà sur la page de login
        if (getAppPathname() !== '/login') {
          window.location.href = getTunnelLoginHref();
        }
      }
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(getUserFacingHttpError(response.status, errorText));
    }
    return response.json();
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const url = this.baseUrl.startsWith('http') 
      ? `${this.baseUrl}${endpoint}` 
      : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await this.safeFetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (response.status === 401) {
      // Ne pas supprimer le token si on est sur la page de setup (l'utilisateur vient peut-être de créer son compte)
      if (getAppPathname() !== '/setup') {
        localStorage.removeItem('lumy_token');
        localStorage.removeItem('lumy_user');
        // Ne rediriger que si on n'est pas déjà sur la page de login
        if (getAppPathname() !== '/login') {
          window.location.href = getTunnelLoginHref();
        }
      }
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(getUserFacingHttpError(response.status, errorText));
    }
    return response.json();
  }

  async delete<T>(endpoint: string): Promise<T> {
    const url = this.baseUrl.startsWith('http') 
      ? `${this.baseUrl}${endpoint}` 
      : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await this.safeFetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    
    if (response.status === 401) {
      // Ne pas supprimer le token si on est sur la page de setup (l'utilisateur vient peut-être de créer son compte)
      if (getAppPathname() !== '/setup') {
        localStorage.removeItem('lumy_token');
        localStorage.removeItem('lumy_user');
        // Ne rediriger que si on n'est pas déjà sur la page de login
        if (getAppPathname() !== '/login') {
          window.location.href = getTunnelLoginHref();
        }
      }
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(getUserFacingHttpError(response.status, errorText));
    }
    
    // Si la réponse est 204 No Content, retourner undefined
    if (response.status === 204) {
      return undefined as T;
    }
    
    // Vérifier si la réponse a du contenu avant de parser en JSON
    const text = await response.text();
    if (!text || text.trim() === '') {
      return undefined as T;
    }
    
    try {
      return JSON.parse(text);
    } catch {
      // Si le parsing échoue, retourner undefined
      return undefined as T;
    }
  }
}

export const apiService = new ApiService();


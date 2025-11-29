const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Ajouter le token JWT si disponible
    const token = localStorage.getItem('homehub_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(),
    });
    
    if (response.status === 401) {
      // Token invalide ou expiré
      localStorage.removeItem('homehub_token');
      localStorage.removeItem('homehub_user');
      window.location.href = '/login';
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (response.status === 401) {
      localStorage.removeItem('homehub_token');
      localStorage.removeItem('homehub_user');
      window.location.href = '/login';
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (response.status === 401) {
      localStorage.removeItem('homehub_token');
      localStorage.removeItem('homehub_user');
      window.location.href = '/login';
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (response.status === 401) {
      localStorage.removeItem('homehub_token');
      localStorage.removeItem('homehub_user');
      window.location.href = '/login';
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    
    if (response.status === 401) {
      localStorage.removeItem('homehub_token');
      localStorage.removeItem('homehub_user');
      window.location.href = '/login';
      throw new Error('Non autorisé');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP error! status: ${response.status}`);
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


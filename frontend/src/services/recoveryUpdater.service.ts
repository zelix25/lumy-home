import type {
  CheckResult,
  UpdateResult,
  UpdaterStatus,
} from './updater.service';

/**
 * Accès direct à lumy-updater via le proxy nginx `/recovery/updater/*`.
 * Ne dépend PAS du backend Nest — utilisable quand celui-ci est HS.
 */
const RECOVERY_BASE = '/recovery/updater';

async function recoveryFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${RECOVERY_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      text ||
      `HTTP ${response.status}`;
    throw new Error(
      typeof message === 'string' ? message : JSON.stringify(message),
    );
  }

  return data as T;
}

class RecoveryUpdaterService {
  async getStatus(): Promise<UpdaterStatus> {
    return recoveryFetch<UpdaterStatus>('/status');
  }

  async checkForUpdates(): Promise<CheckResult> {
    return recoveryFetch<CheckResult>('/check', { method: 'POST', body: '{}' });
  }

  async applyUpdate(services?: string[]): Promise<UpdateResult> {
    return recoveryFetch<UpdateResult>('/update', {
      method: 'POST',
      body: JSON.stringify(services?.length ? { services } : {}),
    });
  }
}

export const recoveryUpdaterService = new RecoveryUpdaterService();

import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** true si le process Node tourne en root (typique du conteneur Docker → pas de sudo dans l'image). */
function isUnixRoot(): boolean {
  return typeof process.getuid === 'function' && process.getuid() === 0;
}

/**
 * Commande shutdown Linux : avec sudo seulement si le process n'est pas root
 * (les images Docker n'installent souvent pas sudo).
 */
function unixShutdownCommand(reboot: boolean): string {
  const flag = reboot ? '-r' : '-h';
  const msg = reboot ? 'Redémarrage du système Lumy Home' : 'Arrêt du système Lumy Home';
  const inner = `shutdown ${flag} +1 '${msg.replace(/'/g, `'\\''`)}'`;
  return isUnixRoot() ? inner : `sudo ${inner}`;
}

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private static readonly CONTAINER_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
  private dockerAvailabilityChecked = false;
  private dockerAvailable = false;

  private async ensureDockerCliAvailable(): Promise<void> {
    if (!this.dockerAvailabilityChecked) {
      try {
        // Vérifie que le binaire docker est présent et exécutable.
        await execAsync('docker --version');
        this.dockerAvailable = true;
      } catch {
        this.dockerAvailable = false;
      } finally {
        this.dockerAvailabilityChecked = true;
      }
    }

    if (!this.dockerAvailable) {
      throw new ServiceUnavailableException(
        "Le CLI Docker n'est pas disponible dans le backend (commande 'docker' introuvable).",
      );
    }
  }

  /**
   * Récupère les dernières lignes de logs d'un conteneur Docker.
   */
  async getContainerLogs(
    containerName: string,
    tail: number = 200,
  ): Promise<{ containerName: string; tail: number; logs: string }> {
    const safeContainerName = (containerName || '').trim();
    if (!safeContainerName || !SystemService.CONTAINER_NAME_RE.test(safeContainerName)) {
      throw new Error('Nom de conteneur invalide');
    }

    const safeTail = Number.isFinite(tail) ? Math.min(Math.max(Math.floor(tail), 1), 5000) : 200;

    await this.ensureDockerCliAvailable();

    try {
      const { stdout, stderr } = await execAsync(
        `docker logs --tail ${safeTail} ${safeContainerName}`,
      );
      const output = [stdout, stderr].filter(Boolean).join('');
      return {
        containerName: safeContainerName,
        tail: safeTail,
        logs: output || 'Aucun log disponible.',
      };
    } catch (error: any) {
      this.logger.error(
        `Erreur récupération logs Docker (${safeContainerName}): ${error.message}`,
        error.stack,
      );
      if (typeof error?.message === 'string' && error.message.includes('docker: not found')) {
        this.dockerAvailable = false;
        this.dockerAvailabilityChecked = true;
        throw new ServiceUnavailableException(
          "Le CLI Docker n'est pas disponible dans le backend (commande 'docker' introuvable).",
        );
      }
      if (typeof error?.message === 'string' && error.message.includes('No such container')) {
        throw new NotFoundException(
          `Le conteneur "${safeContainerName}" est introuvable.`,
        );
      }
      throw new Error(
        `Impossible de récupérer les logs du conteneur "${safeContainerName}": ${error.message}`,
      );
    }
  }

  /**
   * Redémarre le système
   */
  async restart(): Promise<{ success: boolean; message: string }> {
    this.logger.warn('Redémarrage du système demandé');
    
    try {
      // Utiliser shutdown avec l'option -r pour redémarrer
      // Le délai de 1 minute permet au backend de répondre avant le redémarrage
      if (process.platform === 'win32') {
        // Windows
        await execAsync('shutdown /r /t 60 /c "Redémarrage du système Lumy Home"');
      } else {
        // Linux/Unix (Docker root : sans sudo)
        await execAsync(unixShutdownCommand(true));
      }
      
      return {
        success: true,
        message: 'Redémarrage du système programmé dans 1 minute',
      };
    } catch (error: any) {
      this.logger.error('Erreur lors du redémarrage:', error);
      throw new Error(`Impossible de redémarrer le système: ${error.message}`);
    }
  }

  /**
   * Arrête le système
   */
  async shutdown(): Promise<{ success: boolean; message: string }> {
    this.logger.warn('Arrêt du système demandé');
    
    try {
      // Utiliser shutdown avec l'option -h pour arrêter
      // Le délai de 1 minute permet au backend de répondre avant l'arrêt
      if (process.platform === 'win32') {
        // Windows
        await execAsync('shutdown /s /t 60 /c "Arrêt du système Lumy Home"');
      } else {
        // Linux/Unix (Docker root : sans sudo)
        await execAsync(unixShutdownCommand(false));
      }
      
      return {
        success: true,
        message: 'Arrêt du système programmé dans 1 minute',
      };
    } catch (error: any) {
      this.logger.error('Erreur lors de l\'arrêt:', error);
      throw new Error(`Impossible d'arrêter le système: ${error.message}`);
    }
  }
}

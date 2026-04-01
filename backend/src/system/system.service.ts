import { Injectable, Logger } from '@nestjs/common';
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

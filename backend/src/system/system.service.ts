import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { exec } from 'child_process';
import Docker = require('dockerode');
import { PassThrough } from 'stream';
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
  private readonly dockerClient: Docker;
  private dockerAvailabilityChecked = false;
  private dockerAvailable = false;
  private readonly allowedContainers = new Set<string>(
    (process.env.LOG_CONTAINER_WHITELIST ||
      'lumy-backend,lumy-frontend,lumy-agent,lumy-updater')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  constructor() {
    const socketPath = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
    this.dockerClient = new Docker({ socketPath });
  }

  private assertContainerNameValid(containerName: string): string {
    const safeContainerName = (containerName || '').trim();
    if (!safeContainerName || !SystemService.CONTAINER_NAME_RE.test(safeContainerName)) {
      throw new ForbiddenException('Nom de conteneur invalide');
    }
    if (!this.allowedContainers.has(safeContainerName)) {
      throw new ForbiddenException(
        `Accès refusé: le conteneur "${safeContainerName}" n'est pas autorisé pour la lecture des logs.`,
      );
    }
    return safeContainerName;
  }

  private decodeDockerMultiplexedBuffer(input: Buffer): string {
    let offset = 0;
    let output = '';
    while (offset + 8 <= input.length) {
      const payloadSize = input.readUInt32BE(offset + 4);
      const payloadStart = offset + 8;
      const payloadEnd = payloadStart + payloadSize;
      if (payloadEnd > input.length) break;
      output += input.slice(payloadStart, payloadEnd).toString('utf-8');
      offset = payloadEnd;
    }
    if (!output && input.length > 0) {
      // fallback pour conteneurs tty=true (non multiplexé)
      return input.toString('utf-8');
    }
    return output;
  }

  private async ensureDockerAvailable(): Promise<void> {
    if (!this.dockerAvailabilityChecked) {
      try {
        await this.dockerClient.ping();
        this.dockerAvailable = true;
      } catch {
        this.dockerAvailable = false;
      } finally {
        this.dockerAvailabilityChecked = true;
      }
    }
    if (!this.dockerAvailable) {
      throw new ServiceUnavailableException(
        "Docker n'est pas accessible depuis le backend (socket Docker indisponible).",
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
    const safeContainerName = this.assertContainerNameValid(containerName);
    const safeTail = Number.isFinite(tail) ? Math.min(Math.max(Math.floor(tail), 1), 5000) : 200;
    await this.ensureDockerAvailable();

    try {
      const container = this.dockerClient.getContainer(safeContainerName);
      const rawLogs = (await container.logs({
        stdout: true,
        stderr: true,
        tail: safeTail,
        timestamps: true,
      })) as Buffer;
      const output = this.decodeDockerMultiplexedBuffer(rawLogs);
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
      if (
        typeof error?.message === 'string' &&
        (error.message.includes('connect ENOENT') || error.message.includes('Cannot connect'))
      ) {
        this.dockerAvailable = false;
        this.dockerAvailabilityChecked = true;
        throw new ServiceUnavailableException(
          "Docker n'est pas accessible depuis le backend (socket Docker indisponible).",
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

  async streamContainerLogs(
    containerName: string,
    tail: number,
    handlers: {
      onData: (chunk: string) => void;
      onError?: (error: Error) => void;
      onEnd?: () => void;
    },
  ): Promise<() => void> {
    const safeContainerName = this.assertContainerNameValid(containerName);
    const safeTail = Number.isFinite(tail) ? Math.min(Math.max(Math.floor(tail), 1), 5000) : 200;
    await this.ensureDockerAvailable();

    const container = this.dockerClient.getContainer(safeContainerName);
    const stream = (await container.logs({
      stdout: true,
      stderr: true,
      follow: true,
      tail: safeTail,
      timestamps: true,
    })) as NodeJS.ReadableStream;

    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const onStdout = (chunk: Buffer | string) => handlers.onData(String(chunk));
    const onStderr = (chunk: Buffer | string) => handlers.onData(String(chunk));
    stdout.on('data', onStdout);
    stderr.on('data', onStderr);
    this.dockerClient.modem.demuxStream(stream as any, stdout, stderr);

    const onError = (err: Error) => {
      this.logger.error(
        `Flux logs Docker interrompu (${safeContainerName}): ${err.message}`,
        err.stack,
      );
      handlers.onError?.(err);
    };
    const onEnd = () => handlers.onEnd?.();
    stream.on('error', onError);
    stream.on('end', onEnd);
    stream.on('close', onEnd);

    return () => {
      stream.off('error', onError);
      stream.off('end', onEnd);
      stream.off('close', onEnd);
      stdout.off('data', onStdout);
      stderr.off('data', onStderr);
      stdout.destroy();
      stderr.destroy();
      (stream as any).destroy?.();
    };
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

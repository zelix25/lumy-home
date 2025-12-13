import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream, WriteStream } from 'fs';

export interface PluginLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  pluginId: string;
  pluginName: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class PluginLoggerService {
  private readonly logsDirectory: string;
  private logStreams: Map<string, WriteStream> = new Map();
  private readonly maxLogFileSize = 10 * 1024 * 1024; // 10 MB
  private readonly maxLogFiles = 5;

  constructor(private loggerService: LoggerService) {
    this.logsDirectory = path.join(process.cwd(), 'logs', 'plugins');
    this.ensureLogsDirectoryExists();
  }

  /**
   * Crée le répertoire de logs s'il n'existe pas
   */
  private ensureLogsDirectoryExists(): void {
    if (!fs.existsSync(this.logsDirectory)) {
      fs.mkdirSync(this.logsDirectory, { recursive: true });
    }
  }

  /**
   * Obtient le chemin du fichier de log pour un plugin
   */
  private getLogFilePath(pluginId: string, date?: Date): string {
    const dateStr = (date || new Date()).toISOString().split('T')[0];
    return path.join(this.logsDirectory, `${pluginId}-${dateStr}.log`);
  }

  /**
   * Obtient ou crée un stream de log pour un plugin
   */
  private getLogStream(pluginId: string): WriteStream {
    if (!this.logStreams.has(pluginId)) {
      const logPath = this.getLogFilePath(pluginId);
      const stream = createWriteStream(logPath, { flags: 'a' });
      this.logStreams.set(pluginId, stream);
    }
    return this.logStreams.get(pluginId)!;
  }

  /**
   * Écrit un log pour un plugin
   */
  log(pluginId: string, pluginName: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: Record<string, any>): void {
    const entry: PluginLogEntry = {
      timestamp: new Date(),
      level,
      message,
      pluginId,
      pluginName,
      metadata,
    };

    // Écrire dans le fichier de log dédié
    const stream = this.getLogStream(pluginId);
    const logLine = JSON.stringify(entry) + '\n';
    stream.write(logLine);

    // Également logger dans le système de logs principal avec un préfixe
    const logMessage = `[Plugin:${pluginName}] ${message}`;
    switch (level) {
      case 'debug':
        this.loggerService.debug(logMessage, 'PluginLogger');
        break;
      case 'info':
        this.loggerService.log(logMessage, 'PluginLogger');
        break;
      case 'warn':
        this.loggerService.warn(logMessage, 'PluginLogger');
        break;
      case 'error':
        this.loggerService.error(logMessage, metadata ? JSON.stringify(metadata) : '', 'PluginLogger');
        break;
    }
  }

  /**
   * Lit les logs d'un plugin
   */
  async getLogs(
    pluginId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      level?: 'debug' | 'info' | 'warn' | 'error';
      limit?: number;
    },
  ): Promise<PluginLogEntry[]> {
    const logs: PluginLogEntry[] = [];
    const { startDate, endDate, level, limit = 1000 } = options || {};

    // Lire les fichiers de log pour la période demandée
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 jours par défaut
    const end = endDate || new Date();

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const logPath = this.getLogFilePath(pluginId, currentDate);
      if (fs.existsSync(logPath)) {
        try {
          const content = fs.readFileSync(logPath, 'utf-8');
          const lines = content.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            try {
              const entry: PluginLogEntry = JSON.parse(line);
              
              // Filtrer par niveau si spécifié
              if (level && entry.level !== level) {
                continue;
              }

              // Filtrer par date
              if (entry.timestamp && new Date(entry.timestamp) >= start && new Date(entry.timestamp) <= end) {
                logs.push(entry);
              }
            } catch (error) {
              // Ignorer les lignes invalides
            }
          }
        } catch (error) {
          // Ignorer les erreurs de lecture
        }
      }

      // Passer au jour suivant
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Trier par timestamp (plus récent en premier)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limiter le nombre de résultats
    return logs.slice(0, limit);
  }

  /**
   * Supprime les anciens logs d'un plugin
   */
  async cleanupLogs(pluginId: string, daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const currentDate = new Date(cutoffDate);
    const today = new Date();

    while (currentDate <= today) {
      const logPath = this.getLogFilePath(pluginId, currentDate);
      if (fs.existsSync(logPath)) {
        try {
          fs.unlinkSync(logPath);
        } catch (error) {
          // Ignorer les erreurs
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  /**
   * Ferme le stream de log pour un plugin
   */
  closeLogStream(pluginId: string): void {
    const stream = this.logStreams.get(pluginId);
    if (stream) {
      stream.end();
      this.logStreams.delete(pluginId);
    }
  }

  /**
   * Ferme tous les streams de log
   */
  closeAllLogStreams(): void {
    for (const [pluginId, stream] of this.logStreams.entries()) {
      stream.end();
    }
    this.logStreams.clear();
  }
}


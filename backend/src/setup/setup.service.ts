import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { ConfigureZigbeeDto } from './dto/configure-zigbee.dto';

const execAsync = promisify(exec);

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Liste les périphériques USB disponibles
   */
  async getUsbDevices(): Promise<{ devices: string[] }> {
    try {
      // Lister les périphériques /dev/ttyUSB* et /dev/ttyACM*
      const { stdout } = await execAsync('ls -1 /dev/ttyUSB* /dev/ttyACM* 2>/dev/null || true');
      const devices = stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => line.trim());

      // Si aucun périphérique n'est trouvé, retourner une liste vide
      return { devices };
    } catch (error: any) {
      this.logger.error(`Erreur lors de la détection des périphériques USB: ${error.message}`);
      // En cas d'erreur, retourner une liste vide plutôt que de faire échouer la requête
      return { devices: [] };
    }
  }

  /**
   * Configure le coordinateur Zigbee dans docker-compose.yml et configuration.yaml
   */
  async configureZigbee(dto: ConfigureZigbeeDto): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Mettre à jour docker-compose.yml
      const composePath = this.configService.get<string>(
        'COMPOSE_FILE',
        '/opt/lumy/docker-compose.yml',
      );
      
      // Si le fichier n'existe pas au chemin absolu, essayer un chemin relatif
      let composeFile = composePath;
      if (!existsSync(composeFile)) {
        // Essayer depuis le répertoire du projet
        composeFile = join(process.cwd(), 'docker-compose.yml');
        if (!existsSync(composeFile)) {
          // Essayer depuis le répertoire parent
          composeFile = join(process.cwd(), '..', 'docker-compose.yml');
        }
      }

      if (!existsSync(composeFile)) {
        this.logger.warn(`Fichier docker-compose.yml non trouvé à ${composeFile}`);
        // Continuer quand même, peut-être que le fichier sera créé plus tard
      } else {
        await this.updateDockerCompose(composeFile, dto.port);
      }

      // 2. Mettre à jour configuration.yaml de zigbee2mqtt
      const zigbeeConfigPath = this.configService.get<string>(
        'ZIGBEE_CONFIG_PATH',
        '/opt/lumy/data/zigbee2mqtt/configuration.yaml',
      );

      // Si le fichier n'existe pas au chemin absolu, essayer un chemin relatif
      let configFile = zigbeeConfigPath;
      if (!existsSync(configFile)) {
        // Essayer depuis le répertoire du projet
        configFile = join(process.cwd(), 'data', 'zigbee2mqtt', 'configuration.yaml');
        if (!existsSync(configFile)) {
          // Essayer depuis le répertoire z2mqtt
          configFile = join(process.cwd(), 'z2mqtt', 'data', 'configuration.yaml');
        }
      }

      if (!existsSync(configFile)) {
        this.logger.warn(`Fichier configuration.yaml non trouvé à ${configFile}`);
        // Créer le répertoire si nécessaire
        const configDir = join(configFile, '..');
        if (!existsSync(configDir)) {
          const { mkdir } = require('fs').promises;
          await mkdir(configDir, { recursive: true });
        }
      }

      await this.updateZigbeeConfig(configFile, dto.port, dto.adapter);

      return {
        success: true,
        message: 'Configuration Zigbee mise à jour avec succès',
      };
    } catch (error: any) {
      this.logger.error(`Erreur lors de la configuration Zigbee: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Erreur lors de la configuration: ${error.message}`,
      };
    }
  }

  /**
   * Met à jour le docker-compose.yml pour ajouter/modifier le device USB
   */
  private async updateDockerCompose(composePath: string, usbPort: string): Promise<void> {
    try {
      const content = readFileSync(composePath, 'utf-8');
      
      // Pattern pour trouver la section devices de zigbee2mqtt
      // On cherche: devices: suivi de - /dev/ttyUSB0:/dev/ttyUSB0 ou similaire
      // Le pattern doit gérer les espaces et les retours à la ligne
      const devicesPattern = /(zigbee2mqtt:[\s\S]*?devices:\s*\n\s*-\s*)(\/dev\/[^\s:]+):(\/dev\/[^\s:]+)/;
      
      let updatedContent: string;
      if (devicesPattern.test(content)) {
        // Remplacer le device existant
        updatedContent = content.replace(
          devicesPattern,
          `$1${usbPort}:${usbPort}`,
        );
      } else {
        // Ajouter la section devices si elle n'existe pas
        // Chercher la section zigbee2mqtt et ajouter devices après environment ou volumes
        const zigbeeSectionPattern = /(zigbee2mqtt:[\s\S]*?)(environment:|volumes:|ports:)/;
        if (zigbeeSectionPattern.test(content)) {
          const newDevicesLine = `devices:\n      - ${usbPort}:${usbPort}`;
          updatedContent = content.replace(
            zigbeeSectionPattern,
            `$1${newDevicesLine}\n      $2`,
          );
        } else {
          // Si on ne trouve pas la section, ajouter devices avant networks
          const networksPattern = /(zigbee2mqtt:[\s\S]*?)(networks:)/;
          if (networksPattern.test(content)) {
            const newDevicesLine = `devices:\n      - ${usbPort}:${usbPort}`;
            updatedContent = content.replace(
              networksPattern,
              `$1${newDevicesLine}\n      $2`,
            );
          } else {
            // Dernier recours: chercher la fin de la section zigbee2mqtt
            const endPattern = /(zigbee2mqtt:[\s\S]*?)(\n\s+[a-z]|$)/;
            if (endPattern.test(content)) {
              const newDevicesLine = `devices:\n      - ${usbPort}:${usbPort}`;
              updatedContent = content.replace(
                endPattern,
                `$1${newDevicesLine}\n      $2`,
              );
            } else {
              // Si vraiment rien ne fonctionne, on ne modifie pas le fichier
              this.logger.warn(`Impossible de trouver la section zigbee2mqtt dans docker-compose.yml`);
              return;
            }
          }
        }
      }

      writeFileSync(composePath, updatedContent, 'utf-8');
      this.logger.log(`Docker-compose.yml mis à jour avec le port ${usbPort}`);
    } catch (error: any) {
      this.logger.error(`Erreur lors de la mise à jour de docker-compose.yml: ${error.message}`);
      throw error;
    }
  }

  /**
   * Met à jour le fichier configuration.yaml de zigbee2mqtt
   */
  private async updateZigbeeConfig(
    configPath: string,
    port: string,
    adapter: string,
  ): Promise<void> {
    try {
      let config: any = {};

      // Lire le fichier existant s'il existe
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf-8');
        config = yaml.load(content) || {};
      }

      // Mettre à jour la section serial
      if (!config.serial) {
        config.serial = {};
      }

      config.serial.port = port;
      config.serial.adapter = adapter;

      // S'assurer que baudrate est défini (valeur par défaut)
      if (!config.serial.baudrate) {
        config.serial.baudrate = 115200;
      }

      // S'assurer que rtscts est défini (valeur par défaut)
      if (config.serial.rtscts === undefined) {
        config.serial.rtscts = false;
      }

      // Écrire le fichier mis à jour
      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      writeFileSync(configPath, yamlContent, 'utf-8');
      this.logger.log(`Configuration Zigbee mise à jour: port=${port}, adapter=${adapter}`);
    } catch (error: any) {
      this.logger.error(`Erreur lors de la mise à jour de configuration.yaml: ${error.message}`);
      throw error;
    }
  }
}


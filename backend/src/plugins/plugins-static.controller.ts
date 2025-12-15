import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PluginsService } from './plugins.service';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs-extra';

@Controller('plugins')
@UseGuards(JwtAuthGuard)
export class PluginsStaticController {
  private readonly pluginsDirectory: string;

  constructor(
    private readonly pluginsService: PluginsService,
    private readonly configService: ConfigService,
  ) {
    this.pluginsDirectory = path.join(
      process.cwd(),
      this.configService.get<string>('PLUGINS_DIRECTORY', 'plugins'),
    );
  }

  /**
   * Sert les fichiers statiques d'un plugin
   * GET /api/plugins/:id/static/*
   */
  @Get(':id/static/*')
  async serveStaticFile(
    @Param('id') pluginId: string,
    @Param('0') filePath: string,
    @Res() res: Response,
  ) {
    // Récupérer le plugin
    const plugin = await this.pluginsService.findOne(pluginId);

    if (!plugin.installPath) {
      throw new NotFoundException(
        `Plugin ${pluginId} n'a pas de chemin d'installation`,
      );
    }

    // Construire le chemin complet du fichier
    const requestedPath = path.join(plugin.installPath, filePath);
    const resolvedRequestedPath = path.resolve(requestedPath);
    const resolvedPluginPath = path.resolve(plugin.installPath);

    // Sécurité : Vérifier que le fichier demandé est bien dans le répertoire du plugin
    if (!resolvedRequestedPath.startsWith(resolvedPluginPath)) {
      throw new BadRequestException(
        'Tentative d\'accès à un fichier en dehors du répertoire du plugin',
      );
    }

    // Vérifier que le fichier existe
    if (!(await fs.pathExists(requestedPath))) {
      throw new NotFoundException(`Fichier non trouvé: ${filePath}`);
    }

    const stats = await fs.stat(requestedPath);
    if (!stats.isFile()) {
      throw new BadRequestException(`${filePath} n'est pas un fichier`);
    }

    // Déterminer le type MIME
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.jsx': 'application/javascript',
      '.ts': 'application/typescript',
      '.tsx': 'application/typescript',
      '.json': 'application/json',
      '.css': 'text/css',
      '.html': 'text/html',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Servir le fichier
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache 1 heure

    // Pour les fichiers JavaScript/TypeScript, ajouter les headers CORS si nécessaire
    if (ext === '.js' || ext === '.jsx' || ext === '.ts' || ext === '.tsx') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    const fileContent = await fs.readFile(requestedPath);
    res.send(fileContent);
  }
}


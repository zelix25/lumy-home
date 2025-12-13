import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { StorePluginDto, StoreSearchDto } from './dto/store-plugin.dto';
import { PluginCategory } from './dto/plugin-manifest.dto';

@Injectable()
export class PluginsStoreService {
  // TODO: Remplacer par une vraie API de store
  // Pour l'instant, on simule avec des données en mémoire
  private storePlugins: StorePluginDto[] = [
    {
      id: 'weather-forecast',
      name: 'weather-forecast',
      displayName: 'Weather Forecast',
      version: '1.0.0',
      description: 'Affiche les prévisions météo sur plusieurs jours',
      author: 'Lumy Team',
      category: PluginCategory.WEATHER,
      tags: ['weather', 'forecast', 'meteo'],
      downloads: 150,
      rating: 4.5,
      reviews: 23,
      lumyVersion: '1.0.0',
      icon: 'https://example.com/icons/weather.png',
      repository: 'https://github.com/lumy/weather-forecast-plugin',
      screenshots: ['https://example.com/screenshots/weather1.png'],
      license: 'MIT',
    },
    {
      id: 'google-calendar',
      name: 'google-calendar',
      displayName: 'Google Calendar Integration',
      version: '1.2.0',
      description: 'Intègre Google Calendar pour déclencher des automations',
      author: 'Lumy Community',
      category: PluginCategory.INTEGRATION,
      tags: ['calendar', 'google', 'integration'],
      downloads: 89,
      rating: 4.2,
      reviews: 12,
      lumyVersion: '1.0.0',
      icon: 'https://example.com/icons/calendar.png',
      repository: 'https://github.com/lumy/google-calendar-plugin',
      license: 'MIT',
    },
    {
      id: 'advanced-automations',
      name: 'advanced-automations',
      displayName: 'Advanced Automations',
      version: '2.1.0',
      description: 'Ajoute des triggers et actions avancés pour les automations',
      author: 'Lumy Team',
      category: PluginCategory.AUTOMATION,
      tags: ['automation', 'advanced', 'triggers'],
      downloads: 234,
      rating: 4.8,
      reviews: 45,
      lumyVersion: '1.0.0',
      icon: 'https://example.com/icons/automation.png',
      repository: 'https://github.com/lumy/advanced-automations-plugin',
      license: 'MIT',
    },
  ];

  constructor(private logger: LoggerService) {}

  /**
   * Recherche des plugins dans le store
   */
  async search(searchDto: StoreSearchDto): Promise<{
    plugins: StorePluginDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    let results = [...this.storePlugins];

    // Filtrer par terme de recherche
    if (searchDto.query) {
      const query = searchDto.query.toLowerCase();
      results = results.filter(
        (plugin) =>
          plugin.name.toLowerCase().includes(query) ||
          plugin.displayName.toLowerCase().includes(query) ||
          plugin.description?.toLowerCase().includes(query) ||
          plugin.tags?.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    // Filtrer par catégorie
    if (searchDto.category) {
      results = results.filter((plugin) => plugin.category === searchDto.category);
    }

    // Filtrer par tags
    if (searchDto.tags && searchDto.tags.length > 0) {
      results = results.filter((plugin) =>
        searchDto.tags!.some((tag) => plugin.tags?.includes(tag)),
      );
    }

    // Trier
    const sortBy = searchDto.sortBy || 'name';
    const sortOrder = searchDto.sortOrder || 'asc';
    results.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'downloads':
          aValue = a.downloads || 0;
          bValue = b.downloads || 0;
          break;
        case 'rating':
          aValue = a.rating || 0;
          bValue = b.rating || 0;
          break;
        case 'updated':
          // TODO: Ajouter un champ updatedAt
          aValue = 0;
          bValue = 0;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
      }
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    });

    // Pagination
    const page = searchDto.page || 1;
    const limit = searchDto.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedResults = results.slice(start, end);

    this.logger.log(
      `[PluginsStoreService] Recherche: ${results.length} résultat(s) trouvé(s)`,
      'PluginsStoreService',
    );

    return {
      plugins: paginatedResults,
      total: results.length,
      page,
      limit,
    };
  }

  /**
   * Récupère un plugin du store par son ID
   */
  async findOne(id: string): Promise<StorePluginDto> {
    const plugin = this.storePlugins.find((p) => p.id === id);
    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} non trouvé dans le store`);
    }
    return plugin;
  }

  /**
   * Récupère les catégories disponibles
   */
  async getCategories(): Promise<Array<{ category: PluginCategory; count: number }>> {
    const categories = new Map<PluginCategory, number>();

    this.storePlugins.forEach((plugin) => {
      if (plugin.category) {
        categories.set(plugin.category, (categories.get(plugin.category) || 0) + 1);
      }
    });

    return Array.from(categories.entries()).map(([category, count]) => ({
      category,
      count,
    }));
  }

  /**
   * Récupère les plugins en vedette
   */
  async getFeatured(): Promise<StorePluginDto[]> {
    // Retourner les plugins les plus téléchargés et mieux notés
    return this.storePlugins
      .filter((p) => (p.downloads || 0) > 50 && (p.rating || 0) >= 4.0)
      .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
      .slice(0, 10);
  }

  /**
   * Récupère l'URL de téléchargement d'un plugin
   */
  async getDownloadUrl(pluginId: string, version?: string): Promise<string> {
    const plugin = await this.findOne(pluginId);
    
    // TODO: Générer l'URL de téléchargement depuis le repository
    // Pour l'instant, on retourne une URL simulée
    if (plugin.downloadUrl) {
      return plugin.downloadUrl;
    }

    // Générer une URL depuis le repository GitHub
    if (plugin.repository) {
      const repoUrl = plugin.repository.replace('https://github.com/', '');
      const ver = version || plugin.version;
      return `https://github.com/${repoUrl}/releases/download/v${ver}/${plugin.name}-${ver}.zip`;
    }

    throw new NotFoundException(`URL de téléchargement non disponible pour ${pluginId}`);
  }
}


import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PluginTest,
  TestStatus,
  TestType,
  TestSeverity,
} from './plugin-test.entity';
import {
  PluginTestRun,
  TestRunStatus,
} from './plugin-test-run.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';
import * as fs from 'fs';
import * as path from 'path';

interface TestDefinition {
  name: string;
  description?: string;
  type: TestType;
  severity: TestSeverity;
  required: boolean;
  test: (plugin: Plugin, context: any) => Promise<boolean>;
  expectedResult?: Record<string, any>;
}

@Injectable()
export class PluginTestService {
  private readonly logger: Logger;
  private readonly testDefinitions: Map<string, TestDefinition[]> = new Map();

  constructor(
    @InjectRepository(PluginTest)
    private testRepository: Repository<PluginTest>,
    @InjectRepository(PluginTestRun)
    private testRunRepository: Repository<PluginTestRun>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginTestService.name);
    this.registerDefaultTests();
  }

  /**
   * Enregistre les tests par défaut
   */
  private registerDefaultTests(): void {
    // Test de structure du manifest
    this.registerTest('manifest-structure', {
      name: 'Structure du manifest',
      description: 'Vérifie que le manifest.json est valide et contient tous les champs requis',
      type: TestType.FUNCTIONAL,
      severity: TestSeverity.CRITICAL,
      required: true,
      test: async (plugin: Plugin) => {
        if (!plugin.metadata) return false;
        const required = ['name', 'version', 'displayName', 'description'];
        return required.every((field) => plugin.metadata[field]);
      },
    });

    // Test de permissions
    this.registerTest('permissions-validation', {
      name: 'Validation des permissions',
      description: 'Vérifie que toutes les permissions demandées sont valides',
      type: TestType.SECURITY,
      severity: TestSeverity.HIGH,
      required: true,
      test: async (plugin: Plugin) => {
        if (!plugin.permissions || plugin.permissions.length === 0) return true;
        // Vérifier que les permissions sont dans la liste autorisée
        const validPermissions = [
          'devices:read',
          'devices:write',
          'automations:read',
          'automations:write',
          'storage:read',
          'storage:write',
          'notifications:send',
        ];
        return plugin.permissions.every((p) => validPermissions.includes(p));
      },
    });

    // Test de compatibilité de version
    this.registerTest('version-compatibility', {
      name: 'Compatibilité de version',
      description: 'Vérifie que le plugin est compatible avec la version actuelle de Lumy Home',
      type: TestType.COMPATIBILITY,
      severity: TestSeverity.CRITICAL,
      required: true,
      test: async (plugin: Plugin) => {
        if (!plugin.metadata?.lumyVersion) return false;
        // Vérifier la compatibilité (simplifié)
        return true; // À implémenter avec semver
      },
    });

    // Test de fichiers requis
    this.registerTest('required-files', {
      name: 'Fichiers requis',
      description: 'Vérifie que tous les fichiers requis existent',
      type: TestType.FUNCTIONAL,
      severity: TestSeverity.HIGH,
      required: true,
      test: async (plugin: Plugin) => {
        if (!plugin.installPath) return false;
        const manifestPath = path.join(plugin.installPath, 'manifest.json');
        return fs.existsSync(manifestPath);
      },
    });

    // Test de hooks
    this.registerTest('hooks-validation', {
      name: 'Validation des hooks',
      description: 'Vérifie que les fichiers de hooks existent',
      type: TestType.FUNCTIONAL,
      severity: TestSeverity.MEDIUM,
      required: false,
      test: async (plugin: Plugin) => {
        if (!plugin.metadata?.hooks || !plugin.installPath) return true;
        const hooks = plugin.metadata.hooks as Record<string, string>;
        for (const hookPath of Object.values(hooks)) {
          const fullPath = path.join(plugin.installPath, hookPath);
          if (!fs.existsSync(fullPath)) return false;
        }
        return true;
      },
    });
  }

  /**
   * Enregistre un test personnalisé
   */
  registerTest(category: string, testDefinition: TestDefinition): void {
    if (!this.testDefinitions.has(category)) {
      this.testDefinitions.set(category, []);
    }
    this.testDefinitions.get(category)!.push(testDefinition);
  }

  /**
   * Exécute tous les tests pour un plugin
   */
  async runTests(pluginId: string, testCategories?: string[]): Promise<PluginTestRun> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Créer une nouvelle exécution de tests
    const testRun = this.testRunRepository.create({
      pluginId,
      status: TestRunStatus.RUNNING,
      startedAt: new Date(),
      metadata: {
        pluginVersion: plugin.version,
        testCategories: testCategories || [],
      },
    });

    const savedRun = await this.testRunRepository.save(testRun);

    const startTime = Date.now();
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;

    try {
      // Récupérer les tests à exécuter
      const testsToRun = this.getTestsToRun(testCategories);

      // Exécuter chaque test
      for (const testDef of testsToRun) {
        totalTests++;

        const test = this.testRepository.create({
          pluginId,
          name: testDef.name,
          description: testDef.description,
          type: testDef.type,
          severity: testDef.severity,
          required: testDef.required,
          status: TestStatus.RUNNING,
          expectedResult: testDef.expectedResult,
        });

        const savedTest = await this.testRepository.save(test);

        const testStartTime = Date.now();

        try {
          const result = await testDef.test(plugin, {
            testRunId: savedRun.id,
            testId: savedTest.id,
          });

          const testDuration = Date.now() - testStartTime;

          savedTest.status = result ? TestStatus.PASSED : TestStatus.FAILED;
          savedTest.duration = testDuration;
          savedTest.actualResult = { success: result };
          savedTest.executedAt = new Date();

          if (result) {
            passedTests++;
          } else {
            failedTests++;
            savedTest.errorMessage = 'Le test a échoué';
          }

          await this.testRepository.save(savedTest);
        } catch (error: any) {
          const testDuration = Date.now() - testStartTime;

          savedTest.status = TestStatus.ERROR;
          savedTest.duration = testDuration;
          savedTest.errorMessage = error.message;
          savedTest.stackTrace = error.stack;
          savedTest.executedAt = new Date();

          failedTests++;

          await this.testRepository.save(savedTest);

          this.logger.error(
            `Erreur lors de l'exécution du test ${testDef.name} pour le plugin ${plugin.name}`,
            error.stack,
            'PluginTestService',
          );
        }
      }

      // Mettre à jour le statut de l'exécution
      const duration = Date.now() - startTime;
      savedRun.totalTests = totalTests;
      savedRun.passedTests = passedTests;
      savedRun.failedTests = failedTests;
      savedRun.skippedTests = skippedTests;
      savedRun.duration = duration;
      savedRun.completedAt = new Date();

      if (failedTests === 0) {
        savedRun.status = TestRunStatus.PASSED;
      } else if (passedTests > 0) {
        savedRun.status = TestRunStatus.PARTIAL;
      } else {
        savedRun.status = TestRunStatus.FAILED;
      }

      await this.testRunRepository.save(savedRun);

      this.logger.log(
        `Tests terminés pour le plugin ${plugin.name}: ${passedTests}/${totalTests} réussis`,
        'PluginTestService',
      );
    } catch (error: any) {
      savedRun.status = TestRunStatus.ERROR;
      savedRun.errorMessage = error.message;
      savedRun.completedAt = new Date();
      await this.testRunRepository.save(savedRun);

      throw error;
    }

    return savedRun;
  }

  /**
   * Récupère les tests à exécuter
   */
  private getTestsToRun(categories?: string[]): TestDefinition[] {
    const allTests: TestDefinition[] = [];

    if (categories && categories.length > 0) {
      for (const category of categories) {
        const tests = this.testDefinitions.get(category);
        if (tests) {
          allTests.push(...tests);
        }
      }
    } else {
      // Exécuter tous les tests
      for (const tests of this.testDefinitions.values()) {
        allTests.push(...tests);
      }
    }

    return allTests;
  }

  /**
   * Récupère toutes les exécutions de tests pour un plugin
   */
  async getTestRuns(
    pluginId: string,
    filters?: {
      status?: TestRunStatus;
      limit?: number;
    },
  ): Promise<PluginTestRun[]> {
    const query = this.testRunRepository.createQueryBuilder('run');

    query.where('run.pluginId = :pluginId', { pluginId });

    if (filters?.status) {
      query.andWhere('run.status = :status', { status: filters.status });
    }

    query
      .orderBy('run.createdAt', 'DESC')
      .leftJoinAndSelect('run.plugin', 'plugin');

    if (filters?.limit) {
      query.limit(filters.limit);
    }

    return query.getMany();
  }

  /**
   * Récupère une exécution de tests par son ID
   */
  async getTestRun(id: string): Promise<PluginTestRun> {
    const testRun = await this.testRunRepository.findOne({
      where: { id },
      relations: ['plugin', 'tests'],
    });

    if (!testRun) {
      throw new NotFoundException(`Exécution de tests ${id} non trouvée`);
    }

    return testRun;
  }

  /**
   * Récupère les tests d'une exécution
   */
  async getTests(testRunId: string): Promise<PluginTest[]> {
    return this.testRepository.find({
      where: { testRunId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Vérifie si un plugin peut être publié (tous les tests requis passent)
   */
  async canPublish(pluginId: string): Promise<{
    canPublish: boolean;
    reason?: string;
    failedTests: string[];
  }> {
    // Récupérer la dernière exécution de tests
    const testRuns = await this.getTestRuns(pluginId, { limit: 1 });

    if (testRuns.length === 0) {
      return {
        canPublish: false,
        reason: 'Aucun test exécuté',
        failedTests: [],
      };
    }

    const lastRun = testRuns[0];

    if (lastRun.status !== TestRunStatus.PASSED) {
      // Récupérer les tests requis qui ont échoué
      const failedRequiredTests = await this.testRepository.find({
        where: {
          pluginId,
          required: true,
          status: TestStatus.FAILED,
        },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      return {
        canPublish: false,
        reason: `${lastRun.failedTests} test(s) requis ont échoué`,
        failedTests: failedRequiredTests.map((t) => t.name),
      };
    }

    return {
      canPublish: true,
      failedTests: [],
    };
  }

  /**
   * Récupère les statistiques de tests pour un plugin
   */
  async getTestStats(pluginId: string): Promise<{
    totalRuns: number;
    lastRunStatus: TestRunStatus | null;
    lastRunDate: Date | null;
    averagePassRate: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
  }> {
    const testRuns = await this.getTestRuns(pluginId);

    if (testRuns.length === 0) {
      return {
        totalRuns: 0,
        lastRunStatus: null,
        lastRunDate: null,
        averagePassRate: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
      };
    }

    const lastRun = testRuns[0];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    for (const run of testRuns) {
      totalTests += run.totalTests;
      totalPassed += run.passedTests;
      totalFailed += run.failedTests;
    }

    const averagePassRate =
      totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    return {
      totalRuns: testRuns.length,
      lastRunStatus: lastRun.status,
      lastRunDate: lastRun.completedAt || lastRun.createdAt,
      averagePassRate: Math.round(averagePassRate * 100) / 100,
      totalTests,
      passedTests: totalPassed,
      failedTests: totalFailed,
    };
  }
}


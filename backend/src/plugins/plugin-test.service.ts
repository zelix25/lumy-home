import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginTest, TestType, TestStatus } from './entities/plugin-test.entity';
import { PluginTestRun } from './entities/plugin-test-run.entity';
import { Plugin, PluginStatus } from './entities/plugin.entity';
import { LoggerService } from '../logger/logger.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs-extra';

const execAsync = promisify(exec);

export interface CreateTestDto {
  name: string;
  displayName: string;
  description?: string;
  type: TestType;
  testPath?: string;
  testCommand?: string;
  testConfig?: Record<string, any>;
  enabled?: boolean;
  required?: boolean;
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface TestExecutionResult {
  status: TestStatus;
  duration: number;
  output?: string;
  error?: string;
  results?: Record<string, any>;
  assertionsPassed?: number;
  assertionsFailed?: number;
}

@Injectable()
export class PluginTestService {
  private readonly logger: Logger;

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
  }

  /**
   * Crée un test pour un plugin
   */
  async createTest(pluginId: string, testDto: CreateTestDto): Promise<PluginTest> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} non trouvé`);
    }

    // Vérifier si le test existe déjà
    const existing = await this.testRepository.findOne({
      where: { pluginId, name: testDto.name },
    });

    if (existing) {
      throw new BadRequestException(
        `Un test avec le nom "${testDto.name}" existe déjà pour ce plugin`,
      );
    }

    const test = this.testRepository.create({
      pluginId,
      ...testDto,
    });

    const saved = await this.testRepository.save(test);

    this.logger.log(
      `Test "${testDto.name}" créé pour le plugin ${plugin.name}`,
      'PluginTestService',
    );

    return saved;
  }

  /**
   * Récupère tous les tests d'un plugin
   */
  async getPluginTests(
    pluginId: string,
    type?: TestType,
  ): Promise<PluginTest[]> {
    const where: any = { pluginId };
    if (type) {
      where.type = type;
    }
    return this.testRepository.find({
      where,
      order: { displayName: 'ASC' },
    });
  }

  /**
   * Récupère un test par ID
   */
  async getTest(testId: string): Promise<PluginTest> {
    const test = await this.testRepository.findOne({
      where: { id: testId },
      relations: ['plugin'],
    });

    if (!test) {
      throw new NotFoundException(`Test ${testId} non trouvé`);
    }

    return test;
  }

  /**
   * Exécute un test
   */
  async runTest(testId: string): Promise<PluginTestRun> {
    const test = await this.getTest(testId);

    if (!test.enabled) {
      throw new BadRequestException(`Le test "${test.name}" est désactivé`);
    }

    // Créer une nouvelle exécution
    const testRun = this.testRunRepository.create({
      testId: test.id,
      status: TestStatus.RUNNING,
      startedAt: new Date(),
    });

    const saved = await this.testRunRepository.save(testRun);

    // Exécuter le test de manière asynchrone
    this.executeTest(test, saved).catch((error) => {
      this.logger.error(
        `Erreur lors de l'exécution du test ${test.name}: ${error.message}`,
        'PluginTestService',
      );
    });

    return saved;
  }

  /**
   * Exécute tous les tests d'un plugin
   */
  async runAllTests(pluginId: string): Promise<PluginTestRun[]> {
    const tests = await this.getPluginTests(pluginId);
    const enabledTests = tests.filter((t) => t.enabled);

    const testRuns: PluginTestRun[] = [];

    for (const test of enabledTests) {
      try {
        const testRun = await this.runTest(test.id);
        testRuns.push(testRun);
      } catch (error: any) {
        this.logger.error(
          `Erreur lors de l'exécution du test ${test.name}: ${error.message}`,
          'PluginTestService',
        );
      }
    }

    return testRuns;
  }

  /**
   * Exécute un test de manière asynchrone
   */
  private async executeTest(
    test: PluginTest,
    testRun: PluginTestRun,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      let result: TestExecutionResult;

      if (test.testCommand) {
        // Exécuter une commande personnalisée
        result = await this.executeCommand(test, testRun);
      } else if (test.testPath) {
        // Exécuter un fichier de test
        result = await this.executeTestFile(test, testRun);
      } else {
        throw new BadRequestException(
          'Le test doit avoir soit une commande, soit un chemin de fichier',
        );
      }

      const duration = Date.now() - startTime;

      // Mettre à jour le test run
      testRun.status = result.status;
      testRun.completedAt = new Date();
      testRun.duration = duration;
      testRun.output = result.output ?? null;
      testRun.error = result.error ?? null;
      testRun.results = result.results ?? null;
      testRun.assertionsPassed = result.assertionsPassed || 0;
      testRun.assertionsFailed = result.assertionsFailed || 0;

      await this.testRunRepository.save(testRun);

      this.logger.log(
        `Test "${test.name}" ${result.status === TestStatus.PASSED ? 'réussi' : 'échoué'} en ${duration}ms`,
        'PluginTestService',
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;

      testRun.status = TestStatus.FAILED;
      testRun.completedAt = new Date();
      testRun.duration = duration;
      testRun.error = error.message;
      testRun.output = error.stack;

      await this.testRunRepository.save(testRun);

      this.logger.error(
        `Test "${test.name}" a échoué: ${error.message}`,
        'PluginTestService',
      );
    }
  }

  /**
   * Exécute une commande de test
   */
  private async executeCommand(
    test: PluginTest,
    testRun: PluginTestRun,
  ): Promise<TestExecutionResult> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: test.pluginId },
    });

    if (!plugin || !plugin.installPath) {
      throw new NotFoundException('Plugin ou chemin d\'installation non trouvé');
    }

    const testDir = path.join(plugin.installPath, 'tests');
    const timeout = test.timeout > 0 ? test.timeout * 1000 : undefined;

    try {
      const { stdout, stderr } = await execAsync(test.testCommand!, {
        cwd: testDir,
        timeout,
        env: {
          ...process.env,
          PLUGIN_ID: plugin.id,
          PLUGIN_NAME: plugin.name,
        },
      });

      // Parser la sortie pour déterminer le résultat
      const passed = stdout.includes('PASS') || stdout.includes('✓');
      const failed = stdout.includes('FAIL') || stdout.includes('✗') || stderr.length > 0;

      return {
        status: failed ? TestStatus.FAILED : passed ? TestStatus.PASSED : TestStatus.FAILED,
        duration: 0, // Sera calculé par executeTest
        output: stdout + (stderr ? `\n${stderr}` : ''),
        results: {
          stdout,
          stderr,
        },
        assertionsPassed: (stdout.match(/✓/g) || []).length,
        assertionsFailed: (stdout.match(/✗/g) || []).length,
      };
    } catch (error: any) {
      return {
        status: TestStatus.FAILED,
        duration: 0,
        output: error.stdout || '',
        error: error.message,
        results: {
          stdout: error.stdout || '',
          stderr: error.stderr || '',
        },
        assertionsPassed: 0,
        assertionsFailed: 1,
      };
    }
  }

  /**
   * Exécute un fichier de test
   */
  private async executeTestFile(
    test: PluginTest,
    testRun: PluginTestRun,
  ): Promise<TestExecutionResult> {
    const plugin = await this.pluginRepository.findOne({
      where: { id: test.pluginId },
    });

    if (!plugin || !plugin.installPath) {
      throw new NotFoundException('Plugin ou chemin d\'installation non trouvé');
    }

    const testFilePath = path.join(plugin.installPath, test.testPath!);

    if (!(await fs.pathExists(testFilePath))) {
      throw new NotFoundException(`Fichier de test non trouvé: ${test.testPath}`);
    }

    // Pour l'instant, on suppose que c'est un script Node.js
    // Dans une implémentation complète, on détecterait le type de fichier
    const command = `node "${testFilePath}"`;
    return this.executeCommand({ ...test, testCommand: command }, testRun);
  }

  /**
   * Vérifie si tous les tests requis passent pour un plugin
   */
  async canPublish(pluginId: string): Promise<{
    canPublish: boolean;
    requiredTests: PluginTest[];
    failedTests: PluginTestRun[];
    message: string;
  }> {
    const requiredTests = await this.testRepository.find({
      where: {
        pluginId,
        required: true,
        enabled: true,
      },
    });

    if (requiredTests.length === 0) {
      return {
        canPublish: true,
        requiredTests: [],
        failedTests: [],
        message: 'Aucun test requis pour ce plugin',
      };
    }

    // Récupérer les dernières exécutions de chaque test requis
    const failedTests: PluginTestRun[] = [];

    for (const test of requiredTests) {
      const lastRun = await this.testRunRepository.findOne({
        where: { testId: test.id },
        order: { startedAt: 'DESC' },
      });

      if (
        !lastRun ||
        lastRun.status !== TestStatus.PASSED ||
        !lastRun.completedAt
      ) {
        // Récupérer le dernier run même s'il a échoué pour le rapport
        if (lastRun) {
          failedTests.push(lastRun);
        } else {
          // Créer un run fictif pour indiquer que le test n'a jamais été exécuté
          const fakeRun = this.testRunRepository.create({
            testId: test.id,
            status: TestStatus.PENDING,
            error: 'Test jamais exécuté',
          });
          failedTests.push(fakeRun);
        }
      }
    }

    const canPublish = failedTests.length === 0;

    return {
      canPublish,
      requiredTests,
      failedTests,
      message: canPublish
        ? 'Tous les tests requis ont réussi'
        : `${failedTests.length} test(s) requis ont échoué ou n'ont jamais été exécutés`,
    };
  }

  /**
   * Récupère les statistiques de tests d'un plugin
   */
  async getTestStats(pluginId: string): Promise<{
    total: number;
    enabled: number;
    required: number;
    byType: Record<TestType, number>;
    lastRunStats: {
      passed: number;
      failed: number;
      pending: number;
    };
  }> {
    const tests = await this.getPluginTests(pluginId);

    const byType: Record<TestType, number> = {
      [TestType.UNIT]: 0,
      [TestType.INTEGRATION]: 0,
      [TestType.FUNCTIONAL]: 0,
      [TestType.SECURITY]: 0,
      [TestType.PERFORMANCE]: 0,
    };

    let enabled = 0;
    let required = 0;

    for (const test of tests) {
      byType[test.type]++;
      if (test.enabled) enabled++;
      if (test.required) required++;
    }

    // Récupérer les dernières exécutions
    const lastRuns = await Promise.all(
      tests.map((test) =>
        this.testRunRepository.findOne({
          where: { testId: test.id },
          order: { startedAt: 'DESC' },
        }),
      ),
    );

    const lastRunStats = {
      passed: lastRuns.filter((r) => r?.status === TestStatus.PASSED).length,
      failed: lastRuns.filter((r) => r?.status === TestStatus.FAILED).length,
      pending: lastRuns.filter((r) => !r || r.status === TestStatus.PENDING).length,
    };

    return {
      total: tests.length,
      enabled,
      required,
      byType,
      lastRunStats,
    };
  }

  /**
   * Supprime un test
   */
  async deleteTest(testId: string): Promise<void> {
    const result = await this.testRepository.delete(testId);
    if (result.affected === 0) {
      throw new NotFoundException(`Test ${testId} non trouvé`);
    }
  }

  /**
   * Supprime tous les tests d'un plugin
   */
  async removePluginTests(pluginId: string): Promise<number> {
    const result = await this.testRepository.delete({ pluginId });
    return result.affected || 0;
  }
}


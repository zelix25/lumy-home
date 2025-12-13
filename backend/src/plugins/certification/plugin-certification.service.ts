import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginCertification, CertificationStatus, ReviewPriority } from './plugin-certification.entity';
import { Plugin } from '../entities/plugin.entity';
import { LoggerService } from '../../logger/logger.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface SecurityScanResult {
  vulnerabilities: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    file?: string;
    line?: number;
  }>;
  passed: boolean;
  score: number; // 0-100
}

export interface QualityScore {
  codeQuality: number; // 0-100
  documentation: number; // 0-100
  testCoverage: number; // 0-100
  performance: number; // 0-100
  overall: number; // 0-100
}

export interface ReviewChecklist {
  security: {
    noHardcodedSecrets: boolean;
    permissionsMinimal: boolean;
    inputValidation: boolean;
    errorHandling: boolean;
  };
  code: {
    followsBestPractices: boolean;
    hasComments: boolean;
    noDeprecatedAPIs: boolean;
    properLogging: boolean;
  };
  documentation: {
    hasReadme: boolean;
    apiDocumented: boolean;
    examplesProvided: boolean;
  };
  testing: {
    hasTests: boolean;
    testCoverage: number;
  };
}

@Injectable()
export class PluginCertificationService {
  private readonly logger: Logger;
  private readonly privateKeyPath: string;
  private readonly publicKeyPath: string;

  constructor(
    @InjectRepository(PluginCertification)
    private certificationRepository: Repository<PluginCertification>,
    @InjectRepository(Plugin)
    private pluginRepository: Repository<Plugin>,
    private loggerService: LoggerService,
  ) {
    this.logger = new Logger(PluginCertificationService.name);
    
    // Chemins pour les clés de signature
    const keysDir = path.join(process.cwd(), 'data', 'certificates');
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }
    
    this.privateKeyPath = path.join(keysDir, 'lumy-private.pem');
    this.publicKeyPath = path.join(keysDir, 'lumy-public.pem');
    
    // Générer les clés si elles n'existent pas
    this.ensureKeysExist();
  }

  /**
   * Génère les clés de signature si elles n'existent pas
   */
  private ensureKeysExist(): void {
    if (!fs.existsSync(this.privateKeyPath) || !fs.existsSync(this.publicKeyPath)) {
      this.logger.log('Génération des clés de signature pour la certification', 'PluginCertificationService');
      
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      fs.writeFileSync(this.privateKeyPath, privateKey);
      fs.writeFileSync(this.publicKeyPath, publicKey);
      
      this.logger.log('Clés de signature générées avec succès', 'PluginCertificationService');
    }
  }

  /**
   * Soumet un plugin pour certification
   */
  async submitForCertification(
    pluginName: string,
    pluginVersion: string,
    pluginPath: string,
  ): Promise<PluginCertification> {
    // Vérifier si une certification existe déjà
    const existing = await this.certificationRepository.findOne({
      where: { pluginName, pluginVersion },
    });

    if (existing && existing.status === CertificationStatus.APPROVED) {
      throw new BadRequestException(
        `Le plugin ${pluginName} version ${pluginVersion} est déjà certifié`,
      );
    }

    // Calculer le checksum
    const checksum = this.calculateChecksum(pluginPath);

    // Effectuer un scan de sécurité
    const securityScan = await this.performSecurityScan(pluginPath);

    // Calculer le score de qualité
    const qualityScore = await this.calculateQualityScore(pluginPath);

    // Créer ou mettre à jour la certification
    const certification = existing || new PluginCertification();
    certification.pluginName = pluginName;
    certification.pluginVersion = pluginVersion;
    certification.status = CertificationStatus.PENDING;
    certification.checksum = checksum;
    certification.securityScan = securityScan;
    certification.qualityScore = qualityScore;
    certification.reviewChecklist = await this.generateReviewChecklist(pluginPath);

    const saved = await this.certificationRepository.save(certification);

    this.logger.log(
      `Plugin ${pluginName} v${pluginVersion} soumis pour certification`,
      'PluginCertificationService',
    );

    return saved;
  }

  /**
   * Calcule le checksum SHA-256 d'un plugin
   */
  private calculateChecksum(pluginPath: string): string {
    const files = this.getAllFiles(pluginPath);
    const hash = crypto.createHash('sha256');

    for (const file of files) {
      const content = fs.readFileSync(file);
      hash.update(content);
    }

    return hash.digest('hex');
  }

  /**
   * Récupère tous les fichiers d'un plugin (excluant node_modules, .git, etc.)
   */
  private getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      // Ignorer certains dossiers/fichiers
      if (
        file === 'node_modules' ||
        file === '.git' ||
        file === '.DS_Store' ||
        file.startsWith('.')
      ) {
        return;
      }

      if (stat.isDirectory()) {
        this.getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    });

    return fileList;
  }

  /**
   * Effectue un scan de sécurité basique
   */
  private async performSecurityScan(pluginPath: string): Promise<SecurityScanResult> {
    const vulnerabilities: SecurityScanResult['vulnerabilities'] = [];
    const files = this.getAllFiles(pluginPath);

    // Scanner les fichiers pour des patterns suspects
    const suspiciousPatterns = [
      { pattern: /eval\s*\(/, severity: 'critical' as const, description: 'Utilisation de eval()' },
      { pattern: /exec\s*\(/, severity: 'high' as const, description: 'Utilisation de exec()' },
      { pattern: /require\s*\(['"]\.\.\/\.\./, severity: 'medium' as const, description: 'Require avec chemin relatif suspect' },
      { pattern: /process\.env\.\w+\s*=/, severity: 'medium' as const, description: 'Modification de variables d\'environnement' },
      { pattern: /password\s*[:=]\s*['"][^'"]+['"]/, severity: 'high' as const, description: 'Mot de passe en dur' },
      { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i, severity: 'high' as const, description: 'Clé API en dur' },
    ];

    files.forEach((file) => {
      if (!file.endsWith('.js') && !file.endsWith('.ts')) {
        return;
      }

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        suspiciousPatterns.forEach(({ pattern, severity, description }) => {
          if (pattern.test(line)) {
            vulnerabilities.push({
              severity,
              description,
              file: path.relative(pluginPath, file),
              line: index + 1,
            });
          }
        });
      });
    });

    // Calculer le score (100 - pénalités)
    let score = 100;
    vulnerabilities.forEach((v) => {
      switch (v.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    });

    score = Math.max(0, score);

    return {
      vulnerabilities,
      passed: vulnerabilities.filter((v) => v.severity === 'critical' || v.severity === 'high').length === 0,
      score,
    };
  }

  /**
   * Calcule un score de qualité basique
   */
  private async calculateQualityScore(pluginPath: string): Promise<QualityScore> {
    const files = this.getAllFiles(pluginPath);
    const jsFiles = files.filter((f) => f.endsWith('.js') || f.endsWith('.ts'));
    const hasReadme = fs.existsSync(path.join(pluginPath, 'README.md'));

    // Score de documentation
    let documentationScore = 0;
    if (hasReadme) documentationScore += 50;
    
    const manifestPath = path.join(pluginPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (manifest.description) documentationScore += 25;
      if (manifest.metadata?.documentation) documentationScore += 25;
    }

    // Score de qualité de code (basique)
    let codeQualityScore = 70; // Score par défaut
    let hasComments = false;
    let hasErrorHandling = false;

    jsFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('//') || content.includes('/*')) hasComments = true;
      if (content.includes('try') && content.includes('catch')) hasErrorHandling = true;
    });

    if (hasComments) codeQualityScore += 10;
    if (hasErrorHandling) codeQualityScore += 10;
    if (jsFiles.length > 0) codeQualityScore += 10; // Bonus pour avoir du code

    codeQualityScore = Math.min(100, codeQualityScore);

    // Score de tests (placeholder)
    const testCoverage = 0; // TODO: Implémenter l'analyse de couverture de tests

    // Score de performance (placeholder)
    const performanceScore = 80; // TODO: Implémenter l'analyse de performance

    // Score global
    const overall = Math.round(
      (codeQualityScore + documentationScore + testCoverage + performanceScore) / 4,
    );

    return {
      codeQuality: codeQualityScore,
      documentation: documentationScore,
      testCoverage,
      performance: performanceScore,
      overall,
    };
  }

  /**
   * Génère une checklist de review
   */
  private async generateReviewChecklist(pluginPath: string): Promise<ReviewChecklist> {
    const files = this.getAllFiles(pluginPath);
    const manifestPath = path.join(pluginPath, 'manifest.json');
    const hasReadme = fs.existsSync(path.join(pluginPath, 'README.md'));

    let manifest: any = {};
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }

    // Vérifier les secrets en dur
    const jsFiles = files.filter((f) => f.endsWith('.js') || f.endsWith('.ts'));
    let noHardcodedSecrets = true;
    const secretPatterns = [
      /password\s*[:=]\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
      /secret\s*[:=]\s*['"][^'"]+['"]/i,
    ];

    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (secretPatterns.some((pattern) => pattern.test(content))) {
        noHardcodedSecrets = false;
        break;
      }
    }

    // Vérifier les permissions
    const permissionsMinimal = manifest.permissions && manifest.permissions.length <= 5;

    // Vérifier la validation des entrées
    let inputValidation = false;
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('validate') || content.includes('validation')) {
        inputValidation = true;
        break;
      }
    }

    // Vérifier la gestion des erreurs
    let errorHandling = false;
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('try') && content.includes('catch')) {
        errorHandling = true;
        break;
      }
    }

    // Vérifier les commentaires
    let hasComments = false;
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('//') || content.includes('/*')) {
        hasComments = true;
        break;
      }
    }

    // Vérifier les APIs dépréciées
    const deprecatedAPIs = ['eval', 'exec', 'Function'];
    let noDeprecatedAPIs = true;
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (deprecatedAPIs.some((api) => new RegExp(`\\b${api}\\s*\\(`).test(content))) {
        noDeprecatedAPIs = false;
        break;
      }
    }

    // Vérifier le logging
    let properLogging = false;
    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('logger') || content.includes('log')) {
        properLogging = true;
        break;
      }
    }

    // Vérifier les tests
    const hasTests = files.some((f) => f.includes('test') || f.includes('spec'));

    return {
      security: {
        noHardcodedSecrets,
        permissionsMinimal,
        inputValidation,
        errorHandling,
      },
      code: {
        followsBestPractices: hasComments && errorHandling,
        hasComments,
        noDeprecatedAPIs,
        properLogging,
      },
      documentation: {
        hasReadme,
        apiDocumented: manifest.metadata?.documentation !== undefined,
        examplesProvided: files.some((f) => f.includes('example')),
      },
      testing: {
        hasTests,
        testCoverage: hasTests ? 50 : 0, // Placeholder
      },
    };
  }

  /**
   * Approuve un plugin
   */
  async approveCertification(
    certificationId: string,
    reviewerId: string,
    notes?: string,
  ): Promise<PluginCertification> {
    const certification = await this.certificationRepository.findOne({
      where: { id: certificationId },
    });

    if (!certification) {
      throw new NotFoundException('Certification non trouvée');
    }

    if (certification.status === CertificationStatus.APPROVED) {
      throw new BadRequestException('Le plugin est déjà approuvé');
    }

    // Signer le plugin
    const signature = await this.signPlugin(
      certification.pluginName,
      certification.pluginVersion,
      certification.checksum,
    );

    certification.status = CertificationStatus.APPROVED;
    certification.reviewedBy = reviewerId;
    certification.reviewedAt = new Date();
    certification.reviewerNotes = notes || null;
    certification.isSigned = true;
    certification.signature = signature;
    certification.signatureKey = await this.getPublicKey();
    certification.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 an

    const saved = await this.certificationRepository.save(certification);

    this.logger.log(
      `Plugin ${certification.pluginName} v${certification.pluginVersion} approuvé par ${reviewerId}`,
      'PluginCertificationService',
    );

    return saved;
  }

  /**
   * Rejette un plugin
   */
  async rejectCertification(
    certificationId: string,
    reviewerId: string,
    reason: string,
    notes?: string,
  ): Promise<PluginCertification> {
    const certification = await this.certificationRepository.findOne({
      where: { id: certificationId },
    });

    if (!certification) {
      throw new NotFoundException('Certification non trouvée');
    }

    certification.status = CertificationStatus.REJECTED;
    certification.reviewedBy = reviewerId;
    certification.reviewedAt = new Date();
    certification.rejectionReason = reason;
    certification.reviewerNotes = notes || null;

    const saved = await this.certificationRepository.save(certification);

    this.logger.log(
      `Plugin ${certification.pluginName} v${certification.pluginVersion} rejeté par ${reviewerId}: ${reason}`,
      'PluginCertificationService',
    );

    return saved;
  }

  /**
   * Signe un plugin avec la clé privée
   */
  private async signPlugin(
    pluginName: string,
    pluginVersion: string,
    checksum: string,
  ): Promise<string> {
    const privateKey = fs.readFileSync(this.privateKeyPath, 'utf-8');
    const data = `${pluginName}:${pluginVersion}:${checksum}`;
    
    const signature = crypto.sign('sha256', Buffer.from(data), {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    });

    return signature.toString('base64');
  }

  /**
   * Vérifie la signature d'un plugin
   */
  async verifySignature(
    pluginName: string,
    pluginVersion: string,
    checksum: string,
    signature: string,
  ): Promise<boolean> {
    try {
      const publicKey = fs.readFileSync(this.publicKeyPath, 'utf-8');
      const data = `${pluginName}:${pluginVersion}:${checksum}`;
      
      return crypto.verify(
        'sha256',
        Buffer.from(data),
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(signature, 'base64'),
      );
    } catch (error) {
      this.logger.error('Erreur lors de la vérification de la signature', error);
      return false;
    }
  }

  /**
   * Récupère la clé publique
   */
  private async getPublicKey(): Promise<string> {
    return fs.readFileSync(this.publicKeyPath, 'utf-8');
  }

  /**
   * Récupère toutes les certifications
   */
  async findAll(filters?: {
    status?: CertificationStatus;
    pluginName?: string;
  }): Promise<PluginCertification[]> {
    const query = this.certificationRepository.createQueryBuilder('certification');

    if (filters?.status) {
      query.andWhere('certification.status = :status', { status: filters.status });
    }

    if (filters?.pluginName) {
      query.andWhere('certification.pluginName = :pluginName', {
        pluginName: filters.pluginName,
      });
    }

    return query.orderBy('certification.createdAt', 'DESC').getMany();
  }

  /**
   * Récupère une certification
   */
  async findOne(id: string): Promise<PluginCertification> {
    const certification = await this.certificationRepository.findOne({
      where: { id },
    });

    if (!certification) {
      throw new NotFoundException('Certification non trouvée');
    }

    return certification;
  }

  /**
   * Récupère la certification d'un plugin
   */
  async findByPlugin(pluginName: string, pluginVersion: string): Promise<PluginCertification | null> {
    return this.certificationRepository.findOne({
      where: { pluginName, pluginVersion },
    });
  }

  /**
   * Révoque une certification
   */
  async revokeCertification(certificationId: string, reason: string): Promise<PluginCertification> {
    const certification = await this.findOne(certificationId);

    certification.status = CertificationStatus.REVOKED;
    certification.rejectionReason = reason;
    certification.reviewerNotes = reason;

    return this.certificationRepository.save(certification);
  }

  /**
   * Met à jour la priorité d'une review
   */
  async updatePriority(certificationId: string, priority: ReviewPriority): Promise<PluginCertification> {
    const certification = await this.findOne(certificationId);
    certification.priority = priority;
    return this.certificationRepository.save(certification);
  }
}


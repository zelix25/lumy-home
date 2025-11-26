import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../../logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    // Logger la requête entrante
    const requestInfo = {
      method,
      url,
      body: this.sanitizeBody(body),
      query,
      params,
      ip,
      userAgent,
    };

    this.logger.log(
      `📥 ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent.substring(0, 50)}`,
      'HTTP',
    );

    if (Object.keys(body || {}).length > 0) {
      this.logger.debug(
        `📥 Body: ${JSON.stringify(this.sanitizeBody(body))}`,
        'HTTP',
      );
    }

    if (Object.keys(query || {}).length > 0) {
      this.logger.debug(`📥 Query: ${JSON.stringify(query)}`, 'HTTP');
    }

    if (Object.keys(params || {}).length > 0) {
      this.logger.debug(`📥 Params: ${JSON.stringify(params)}`, 'HTTP');
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          this.logger.log(
            `📤 ${method} ${url} - ${responseTime}ms - Status: 200`,
            'HTTP',
          );
          if (process.env.LOG_LEVEL === 'debug') {
            this.logger.debug(
              `📤 Response: ${JSON.stringify(data).substring(0, 500)}`,
              'HTTP',
            );
          }
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          this.logger.error(
            `❌ ${method} ${url} - ${responseTime}ms - Status: ${error.status || 500} - ${error.message}`,
            error.stack,
            'HTTP',
          );
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    const sanitized = { ...body };
    // Masquer les mots de passe et tokens sensibles
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.token) sanitized.token = '***';
    if (sanitized.accessToken) sanitized.accessToken = '***';
    if (sanitized.refreshToken) sanitized.refreshToken = '***';
    return sanitized;
  }
}


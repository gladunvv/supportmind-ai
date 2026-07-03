import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../api-keys.service';
import { ApiKeyContext } from '../types/api-key-context.type';

type ApiKeyRequest = {
  headers: {
    authorization?: string;
  };
  apiKey?: ApiKeyContext;
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('API key is required');
    }

    const rawKey = authorization.replace('Bearer ', '').trim();

    const apiKey = await this.apiKeysService.validateRawKey(rawKey);

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.apiKey = apiKey;

    return true;
  }
}

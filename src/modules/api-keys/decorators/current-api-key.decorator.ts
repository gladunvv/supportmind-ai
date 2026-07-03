import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyContext } from '../types/api-key-context.type';

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApiKeyContext => {
    const request = context.switchToHttp().getRequest<{
      apiKey: ApiKeyContext;
    }>();

    return request.apiKey;
  },
);

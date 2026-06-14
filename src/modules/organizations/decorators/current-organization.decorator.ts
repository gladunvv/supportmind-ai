import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  RequestOrganization,
  RequestWithOrganization,
} from '../types/request-with-organization.type';

export const CurrentOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestOrganization => {
    const request = ctx.switchToHttp().getRequest<RequestWithOrganization>();

    if (!request.organization) {
      throw new Error('Organization context is missing');
    }

    return request.organization;
  },
);

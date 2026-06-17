import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { ROLE_PERMISSIONS } from '../permissions/role-permissions';
import { Permission } from '../types/permission.type';
import { RequestWithOrganization } from '../../organizations/types/request-with-organization.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithOrganization>();
    const organization = request.organization;

    if (!organization) {
      throw new ForbiddenException('Organization context is missing');
    }

    const rolePermissions = ROLE_PERMISSIONS[organization.role];

    const hasPermission = requiredPermissions.every((permission) =>
      rolePermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

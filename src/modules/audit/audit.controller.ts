import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/types/permission.type';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import { RequestOrganization } from '../organizations/types/request-with-organization.type';
import { AuditService } from './audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@Controller('organizations/:organizationId/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ViewAuditLogs)
  @ApiOkResponse({
    description: 'Get recent organization audit logs.',
  })
  findForOrganization(
    @CurrentOrganization() organization: RequestOrganization,
    @Query() query: PaginationQueryDto,
  ) {
    return this.auditService.findForOrganization(organization.id, query);
  }
}

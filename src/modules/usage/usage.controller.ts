import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/types/permission.type';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import { RequestOrganization } from '../organizations/types/request-with-organization.type';
import { UsageService } from './usage.service';

@ApiTags('Usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@Controller('organizations/:organizationId/usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageBilling)
  @ApiOkResponse({
    description: 'Get current month usage summary.',
  })
  getCurrentMonthSummary(
    @CurrentOrganization() organization: RequestOrganization,
  ) {
    return this.usageService.getCurrentMonthSummary(organization.id);
  }
}

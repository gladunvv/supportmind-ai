import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthUser } from '../auth/types/auth-user.type';
import { Permission } from '../auth/types/permission.type';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import { RequestOrganization } from '../organizations/types/request-with-organization.type';
import { UpdateKnowledgeGapStatusDto } from './dto/update-knowledge-gap-status.dto';
import { KnowledgeGapsService } from './knowledge-gaps.service';
import { WebhookEventType } from '../../generated/prisma/enums';
import { WebhooksService } from '../webhooks/webhooks.service';

@ApiTags('Knowledge Gaps')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@Controller('organizations/:organizationId/knowledge-gaps')
export class KnowledgeGapsController {
  constructor(private readonly knowledgeGapsService: KnowledgeGapsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageOrganization)
  @ApiOkResponse({
    description: 'Get open knowledge gaps for an organization.',
  })
  findOpen(@CurrentOrganization() organization: RequestOrganization) {
    return this.knowledgeGapsService.findOpenForOrganization(organization.id);
  }

  @Patch(':knowledgeGapId/status')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageOrganization)
  @ApiOkResponse({
    description: 'Update knowledge gap status.',
  })
  updateStatus(
    @CurrentOrganization() organization: RequestOrganization,
    @CurrentUser() user: AuthUser,
    @Param('knowledgeGapId') knowledgeGapId: string,
    @Body() dto: UpdateKnowledgeGapStatusDto,
  ) {
    return this.knowledgeGapsService.updateStatus(
      organization.id,
      knowledgeGapId,
      user.id,
      dto.status,
    );
  }
}

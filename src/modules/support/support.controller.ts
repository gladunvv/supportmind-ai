import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { DraftSupportReplyDto } from './dto/draft-support-reply.dto';
import { SupportService } from './support.service';

@ApiTags('Support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@Controller('organizations/:organizationId/support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('draft-reply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.GenerateSupportReply)
  @ApiOkResponse({
    description:
      'Generate a support reply draft using organization knowledge base.',
  })
  draftReply(
    @CurrentOrganization() organization: RequestOrganization,
    @CurrentUser() user: AuthUser,
    @Body() dto: DraftSupportReplyDto,
  ) {
    return this.supportService.draftReply(organization.id, user, dto);
  }
}

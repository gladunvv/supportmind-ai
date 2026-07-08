import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthUser } from '../auth/types/auth-user.type';
import { Permission } from '../auth/types/permission.type';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import { RequestOrganization } from '../organizations/types/request-with-organization.type';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@Controller('organizations/:organizationId/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageApiKeys)
  @ApiCreatedResponse({
    description:
      'Create a webhook endpoint. The webhook secret is returned only once.',
  })
  createEndpoint(
    @CurrentOrganization() organization: RequestOrganization,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateWebhookEndpointDto,
  ) {
    return this.webhooksService.createEndpoint(organization.id, user, dto);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageApiKeys)
  @ApiOkResponse({
    description: 'List webhook endpoints.',
  })
  findEndpoints(@CurrentOrganization() organization: RequestOrganization) {
    return this.webhooksService.findEndpoints(organization.id);
  }

  @Get('deliveries')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageApiKeys)
  @ApiOkResponse({
    description: 'List recent webhook deliveries.',
  })
  findDeliveries(@CurrentOrganization() organization: RequestOrganization) {
    return this.webhooksService.findDeliveries(organization.id);
  }

  @Delete(':webhookEndpointId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageApiKeys)
  @ApiOkResponse({
    description: 'Disable a webhook endpoint.',
  })
  disableEndpoint(
    @CurrentOrganization() organization: RequestOrganization,
    @CurrentUser() user: AuthUser,
    @Param('webhookEndpointId') webhookEndpointId: string,
  ) {
    return this.webhooksService.disableEndpoint(
      organization.id,
      webhookEndpointId,
      user,
    );
  }
}

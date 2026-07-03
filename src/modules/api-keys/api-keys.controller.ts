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
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import { RequestOrganization } from '../organizations/types/request-with-organization.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthUser } from '../auth/types/auth-user.type';
import { Permission } from '../auth/types/permission.type';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@Controller('organizations/:organizationId/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageApiKeys)
  @ApiCreatedResponse({
    description: 'Create an API key. The raw key is returned only once.',
  })
  create(
    @CurrentOrganization() organization: RequestOrganization,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(organization.id, user, dto);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageApiKeys)
  @ApiOkResponse({
    description: 'List organization API keys.',
  })
  findAll(@CurrentOrganization() organization: RequestOrganization) {
    return this.apiKeysService.findAll(organization.id);
  }

  @Delete(':apiKeyId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageApiKeys)
  @ApiOkResponse({
    description: 'Revoke an API key.',
  })
  revoke(
    @CurrentOrganization() organization: RequestOrganization,
    @CurrentUser() user: AuthUser,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    return this.apiKeysService.revoke(organization.id, apiKeyId, user);
  }
}

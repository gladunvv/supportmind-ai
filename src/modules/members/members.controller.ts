import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { type RequestOrganization } from '../organizations/types/request-with-organization.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { type AuthUser } from '../auth/types/auth-user.type';
import { Permission } from '../auth/types/permission.type';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { MembersService } from './members.service';

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@Controller('organizations/:organizationId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageMembers)
  @ApiOkResponse({
    description: 'List organization members.',
  })
  findAll(@CurrentOrganization() organization: RequestOrganization) {
    return this.membersService.findAll(organization.id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageMembers)
  @ApiCreatedResponse({
    description: 'Add registered user to organization.',
  })
  addMember(
    @CurrentOrganization() organization: RequestOrganization,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.membersService.addMember(organization.id, user.id, dto);
  }

  @Patch(':membershipId/role')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageMembers)
  @ApiOkResponse({
    description: 'Update member role.',
  })
  updateRole(
    @CurrentOrganization() organization: RequestOrganization,
    @CurrentUser() user: AuthUser,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.membersService.updateRole(
      organization.id,
      membershipId,
      user.id,
      dto,
    );
  }

  @Delete(':membershipId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.ManageMembers)
  @ApiOkResponse({
    description: 'Remove member from organization.',
  })
  removeMember(
    @CurrentOrganization() organization: RequestOrganization,
    @CurrentUser() user: AuthUser,
    @Param('membershipId') membershipId: string,
  ) {
    return this.membersService.removeMember(
      organization.id,
      membershipId,
      user.id,
    );
  }
}

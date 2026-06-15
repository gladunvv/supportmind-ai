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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { type AuthUser } from '../auth/types/auth-user.type';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationMemberGuard } from './guards/organization-member.guard';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiCreatedResponse({
    description: 'Organization created successfully.',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(user.id, dto);
  }

  @Get()
  @ApiOkResponse({
    description: 'List organizations for current user.',
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.organizationsService.findAllForUser(user.id);
  }

  @Get(':organizationId')
  @UseGuards(OrganizationMemberGuard)
  @ApiOkResponse({
    description: 'Get organization details.',
  })
  findOne(@Param('organizationId') organizationId: string) {
    return this.organizationsService.findOneForMember(organizationId);
  }

  @Patch(':organizationId')
  @UseGuards(OrganizationMemberGuard)
  @ApiOkResponse({
    description: 'Update organization.',
  })
  update(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(organizationId, dto);
  }

  @Delete(':organizationId')
  @UseGuards(OrganizationMemberGuard)
  @ApiOkResponse({
    description: 'Archive organization.',
  })
  archive(@Param('organizationId') organizationId: string) {
    return this.organizationsService.archive(organizationId);
  }
}

import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { type AuthUser } from '../auth/types/auth-user.type';
import { Permission } from '../auth/types/permission.type';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import { type RequestOrganization } from '../organizations/types/request-with-organization.type';
import { DocumentsService } from './documents.service';
import { type UploadedDocumentFile } from './types/uploaded-file.type';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@Controller('organizations/:organizationId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.UploadDocuments)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Document uploaded successfully.',
  })
  upload(
    @CurrentOrganization() organization: RequestOrganization,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: UploadedDocumentFile,
  ) {
    return this.documentsService.upload(organization.id, user.id, file);
  }

  @Get()
  @ApiOkResponse({
    description: 'List organization documents.',
  })
  findAll(@CurrentOrganization() organization: RequestOrganization) {
    return this.documentsService.findAll(organization.id);
  }

  @Get(':documentId')
  @ApiOkResponse({
    description: 'Get document details.',
  })
  findOne(
    @CurrentOrganization() organization: RequestOrganization,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.findOne(organization.id, documentId);
  }

  @Delete(':documentId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.UploadDocuments)
  @ApiOkResponse({
    description: 'Delete document.',
  })
  remove(
    @CurrentOrganization() organization: RequestOrganization,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.remove(organization.id, documentId, user.id);
  }
}

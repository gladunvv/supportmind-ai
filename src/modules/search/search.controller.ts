import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentOrganization } from '../organizations/decorators/current-organization.decorator';
import { OrganizationMemberGuard } from '../organizations/guards/organization-member.guard';
import { RequestOrganization } from '../organizations/types/request-with-organization.type';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@Controller('organizations/:organizationId/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @ApiOkResponse({
    description: 'Search organization knowledge base.',
  })
  search(
    @CurrentOrganization() organization: RequestOrganization,
    @Body() dto: SearchDocumentsDto,
  ) {
    return this.searchService.search(organization.id, dto);
  }
}

import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationMemberGuard } from './guards/organization-member.guard';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule.register({})],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationMemberGuard],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}

import { forwardRef, Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationMemberGuard } from './guards/organization-member.guard';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, forwardRef(() => AuditModule)],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationMemberGuard],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}

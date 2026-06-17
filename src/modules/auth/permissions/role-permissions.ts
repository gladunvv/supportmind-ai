import { MembershipRole } from '../../../generated/prisma/enums';
import { Permission } from '../types/permission.type';

export const ROLE_PERMISSIONS: Record<MembershipRole, Permission[]> = {
  owner: [
    Permission.ManageOrganization,
    Permission.ManageMembers,
    Permission.UploadDocuments,
    Permission.AskAi,
    Permission.GenerateSupportReply,
    Permission.ViewAuditLogs,
    Permission.ManageBilling,
    Permission.ManageApiKeys,
  ],
  admin: [
    Permission.ManageOrganization,
    Permission.ManageMembers,
    Permission.UploadDocuments,
    Permission.AskAi,
    Permission.GenerateSupportReply,
    Permission.ViewAuditLogs,
    Permission.ManageApiKeys,
  ],
  support_agent: [Permission.AskAi, Permission.GenerateSupportReply],
  viewer: [Permission.AskAi],
};

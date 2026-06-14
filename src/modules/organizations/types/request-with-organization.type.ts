import { Request } from 'express';
import { AuthUser } from '../../auth/types/auth-user.type';
import { MembershipRole } from '../../../generated/prisma/enums';

export type RequestOrganization = {
  id: string;
  role: MembershipRole;
};

export type RequestWithOrganization = Request & {
  user?: AuthUser;
  organization?: RequestOrganization;
};

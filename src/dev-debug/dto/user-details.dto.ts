export class UserDetailsDto {
  id?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  accountStatus?: string;
  accountType?: string;
  userId?: string;
  permissions?: string[];
  permissionCount?: number;
  timestamp?: string;
  error?: string;
  [key: string]: any; // Allow additional properties for flexibility during development
}

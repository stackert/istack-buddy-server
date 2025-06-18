export class UserDetailsDto {
  id?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  accountStatus?: string;
  accountType?: string;
  [key: string]: any; // Allow additional properties for flexibility during development
}

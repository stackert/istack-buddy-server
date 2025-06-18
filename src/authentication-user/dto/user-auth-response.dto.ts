export class UserAuthResponseDto {
  success: boolean;
  userId: string;
  email: string;
  permissions: string[];
  message?: string;
}

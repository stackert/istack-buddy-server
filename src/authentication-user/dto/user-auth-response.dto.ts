export class UserAuthResponseDto {
  success: boolean;
  userId: string;
  email: string;
  jwtToken: string;
  permissions: string[];
  message?: string;
}

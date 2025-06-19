export class AuthDto {
  email?: string;
  password?: string;
  username?: string;
  [key: string]: any; // Allow additional properties for flexibility during development
}

export class AuthResponseDto {
  success: boolean;
  message: string;
}

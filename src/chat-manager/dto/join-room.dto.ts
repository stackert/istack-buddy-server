import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { UserRole } from './create-message.dto';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(UserRole)
  userRole: UserRole;
}

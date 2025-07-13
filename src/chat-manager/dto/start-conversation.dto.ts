import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
} from 'class-validator';
import { UserRole } from './create-message.dto';

export class StartConversationDto {
  @IsString()
  @IsNotEmpty()
  createdBy: string;

  @IsEnum(UserRole)
  createdByRole: UserRole;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  initialParticipants?: string[];
}

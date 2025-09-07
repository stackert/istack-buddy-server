import { IsString, IsNotEmpty } from 'class-validator';

export class KnobbySearchTestDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

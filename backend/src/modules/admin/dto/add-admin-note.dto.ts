import { IsNotEmpty, IsString } from 'class-validator';

export class AddAdminNoteDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

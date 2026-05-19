import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateTicketDto {
  @IsString() @IsNotEmpty()
  prestataireId: string;

  @IsString() @IsNotEmpty()
  entrepriseId: string;

  @IsString() @IsNotEmpty()
  specialite: string;

  @IsOptional() @IsNumber()
  clientLatitude?: number;

  @IsOptional() @IsNumber()
  clientLongitude?: number;
}

import { IsString, IsNotEmpty } from 'class-validator';

export class CreerReservationDto {
  @IsString()
  @IsNotEmpty()
  creneauId: string;

  @IsString()
  @IsNotEmpty()
  prestataireId: string;

  @IsString()
  @IsNotEmpty()
  entrepriseId: string;
}

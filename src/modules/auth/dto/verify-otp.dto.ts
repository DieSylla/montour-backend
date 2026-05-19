import { IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString() @IsNotEmpty()
  userId: string;

  @IsString() @Length(6, 6)
  otp: string;
}

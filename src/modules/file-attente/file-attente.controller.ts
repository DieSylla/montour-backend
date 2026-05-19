import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FileAttenteService } from './file-attente.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';

@Controller('file-attente')
@UseGuards(FirebaseAuthGuard)
export class FileAttenteController {
  constructor(private readonly fileAttenteService: FileAttenteService) {}

  @Get(':prestataireId/position')
  getPosition(@Param('prestataireId') prestataireId: string) {
    return this.fileAttenteService.calculerPosition(prestataireId);
  }
}

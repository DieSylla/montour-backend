import { Controller, Post, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { EntrepriseService } from './entreprise.service';
import { CreateEntrepriseDto } from './dto/create-entreprise.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('entreprises')
export class EntrepriseController {
  constructor(private readonly entrepriseService: EntrepriseService) {}

  // ── Public ─────────────────────────────────────────────────────────
  @Post('adhesion')
  demanderAdhesion(@Body() dto: CreateEntrepriseDto) {
    return this.entrepriseService.demanderAdhesion(dto);
  }

  @Get('code/:codeHex/specialites')
  getSpecialites(@Param('codeHex') codeHex: string) {
    return this.entrepriseService.getSpecialitesByCode(codeHex);
  }

  // ── Authentifié ────────────────────────────────────────────────────
  @Get()
  @UseGuards(FirebaseAuthGuard)
  getToutesEntreprises() {
    return this.entrepriseService.getToutesEntreprises();
  }

  @Get(':id/prestataires')
  @UseGuards(FirebaseAuthGuard)
  getPrestataires(@Param('id') id: string) {
    return this.entrepriseService.getPrestataires(id);
  }

  // ── Admin uniquement ───────────────────────────────────────────────
  @Get('admin/pending')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getPending() {
    return this.entrepriseService.getPendingEntreprises();
  }

  @Patch(':id/valider')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  valider(@Param('id') id: string, @CurrentUser() user: any) {
    return this.entrepriseService.validerEntreprise(id, user.sub);
  }

  @Patch(':id/toggle')
@UseGuards(FirebaseAuthGuard)
toggleEntreprise(
  @Param('id') id: string,
  @Body('active') active: boolean
) {
  return this.entrepriseService.toggleEntreprise(id, active);
}

  @Patch(':id/rejeter')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('ADMIN')
  rejeter(@Param('id') id: string, @Body('motif') motif: string) {
    return this.entrepriseService.rejeterEntreprise(id, motif);
  }
}

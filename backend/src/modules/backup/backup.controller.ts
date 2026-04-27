import {
  Controller,
  Post,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

// Define File type for multer uploads
interface File {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BackupService } from './backup.service';
import { BackupRestoreTestService } from './backup-restore-test.service';

// Maximum backup file size: 1GB
const MAX_BACKUP_SIZE = 1024 * 1024 * 1024;

@ApiTags('backup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller({ path: 'backup', version: '1' })
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly restoreTestService: BackupRestoreTestService,
  ) {}

  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger an on-demand backup (admin)' })
  async triggerBackup() {
    const record = await this.backupService.createBackup();
    return {
      backupId: record.id,
      status: record.status,
      sizeBytes: record.sizeBytes,
      durationMs: record.durationMs,
      checksumSha256: record.checksumSha256,
    };
  }

  @Post('restore-test')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger an on-demand restore test (admin)' })
  async triggerRestoreTest() {
    await this.restoreTestService.runMonthlyRestoreTest();
    return { message: 'Restore test initiated' };
  }

  @Post('restore')
  @UseGuards(ThrottlerGuard) // Rate limit restore uploads
  @UseInterceptors(FileInterceptor('backup'))
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Upload and verify a backup file for restoration (admin)',
  })
  async uploadBackupForRestore(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_BACKUP_SIZE })],
        fileIsRequired: true,
      }),
    )
    file: File,
  ) {
    if (!file) {
      throw new BadRequestException('No backup file provided');
    }

    if (!this.isValidBackupFile(file)) {
      throw new BadRequestException(
        'Invalid backup file format. Expected encrypted backup.',
      );
    }

    // Verify the backup integrity
    const filePath = file.path || file.filename || '';
    const verified = await this.backupService.verifyBackupFile(filePath);

    return {
      message: 'Backup file uploaded and verified',
      fileSize: file.size,
      verified,
      nextSteps: verified
        ? 'Backup is ready for restore'
        : 'Backup verification failed',
    };
  }

  @Get('records')
  @ApiOperation({ summary: 'List recent backup records with metrics (admin)' })
  async getRecords() {
    return this.backupService.getRecentBackups(20);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get last successful backup info (admin)' })
  async getStatus() {
    const last = await this.backupService.getLastSuccessful();
    if (!last) return { healthy: false, message: 'No successful backup found' };
    const ageHours = (Date.now() - last.createdAt.getTime()) / 1000 / 3600;
    return {
      healthy: ageHours < 26,
      lastBackupAt: last.createdAt,
      ageHours: +ageHours.toFixed(2),
      sizeBytes: last.sizeBytes,
      durationMs: last.durationMs,
      verified: last.lastVerifiedAt,
    };
  }

  /**
   * Check if the uploaded file is a valid backup
   */
  private isValidBackupFile(file: File): boolean {
    // Check file extension
    const validExtensions = ['.enc', '.dump', '.sql', '.backup'];
    const fileName = file.originalname.toLowerCase();
    return validExtensions.some((ext) => fileName.endsWith(ext));
  }
}

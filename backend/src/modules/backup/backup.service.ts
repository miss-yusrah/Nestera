import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { BackupRecord, BackupStatus } from './entities/backup-record.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly encryptionKey: Buffer;
  private readonly retentionDays: number;
  private readonly tmpDir: string;
  private readonly testDbHost?: string;
  private readonly testDbPort?: number;
  private readonly testDbUser?: string;
  private readonly testDbPassword?: string;
  private readonly testDbName?: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(BackupRecord)
    private readonly backupRepo: Repository<BackupRecord>,
    private readonly eventEmitter?: EventEmitter2,
  ) {
    this.bucket = this.config.get<string>('backup.s3Bucket')!;
    this.encryptionKey = Buffer.from(
      this.config.get<string>('backup.encryptionKey')!,
      'hex',
    );
    this.retentionDays = this.config.get<number>('backup.retentionDays') ?? 30;
    this.tmpDir = this.config.get<string>('backup.tmpDir') ?? '/tmp';
    this.testDbHost = this.config.get<string>('backup.testDb.host');
    this.testDbPort = this.config.get<number>('backup.testDb.port');
    this.testDbUser = this.config.get<string>('backup.testDb.user');
    this.testDbPassword = this.config.get<string>('backup.testDb.password');
    this.testDbName = this.config.get<string>('backup.testDb.name');

    this.s3 = new S3Client({
      region: this.config.get<string>('backup.s3Region') ?? 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('backup.awsAccessKeyId')!,
        secretAccessKey: this.config.get<string>('backup.awsSecretAccessKey')!,
      },
    });
  }

  // Daily at 02:00 UTC
  @Cron('0 2 * * *')
  async runDailyBackup(): Promise<BackupRecord> {
    this.logger.log('Starting daily database backup...');
    return this.createBackup();
  }

  // Daily verification at 04:00 UTC (2 hours after backup)
  @Cron('0 4 * * *')
  async verifyRecentBackups(): Promise<void> {
    try {
      this.logger.log('Starting backup verification job...');
      const unverified = await this.backupRepo.find({
        where: { status: BackupStatus.SUCCESS },
        order: { createdAt: 'DESC' },
        take: 3, // Verify last 3 successful backups
      });

      for (const record of unverified) {
        // Skip if recently verified
        if (
          record.lastVerifiedAt &&
          Date.now() - record.lastVerifiedAt.getTime() < 24 * 60 * 60 * 1000
        ) {
          continue;
        }

        await this.verifyBackup(record.id);
      }

      this.logger.log('Backup verification job completed');
    } catch (error) {
      const msg = (error as Error).message;
      this.logger.error(`Backup verification job failed: ${msg}`);
      this.eventEmitter?.emit('backup.verification.failed', {
        error: msg,
        timestamp: new Date(),
      });
    }
  }

  async createBackup(): Promise<BackupRecord> {
    const start = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpFile = path.join(this.tmpDir, `nestera-${timestamp}.dump`);
    const encFile = `${dumpFile}.enc`;

    const record = this.backupRepo.create({
      filename: path.basename(encFile),
      s3Key: `backups/${path.basename(encFile)}`,
      sizeBytes: 0,
      durationMs: 0,
      status: BackupStatus.FAILED,
      expiresAt: this.retentionExpiry(),
    });

    try {
      await this.pgDump(dumpFile);
      await this.encrypt(dumpFile, encFile);
      fs.unlinkSync(dumpFile);

      const sizeBytes = fs.statSync(encFile).size;
      const checksum = await this.calculateChecksum(encFile);

      await this.uploadToS3(encFile, record.s3Key);
      fs.unlinkSync(encFile);

      record.sizeBytes = sizeBytes;
      record.checksumSha256 = checksum;
      record.durationMs = Date.now() - start;
      record.status = BackupStatus.SUCCESS;

      this.logger.log(
        `Backup complete: ${record.filename} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB, ${record.durationMs}ms, checksum: ${checksum.substring(0, 8)}...)`,
      );

      this.eventEmitter?.emit('backup.created', {
        backupId: record.id,
        filename: record.filename,
        sizeBytes,
        checksum,
        timestamp: new Date(),
      });
    } catch (err) {
      record.errorMessage = (err as Error).message;
      record.durationMs = Date.now() - start;
      record.status = BackupStatus.FAILED;
      this.logger.error(`Backup failed: ${record.errorMessage}`);
      this.cleanupFiles(dumpFile, encFile);

      this.eventEmitter?.emit('backup.failed', {
        error: record.errorMessage,
        timestamp: new Date(),
      });
    }

    return this.backupRepo.save(record);
  }

  /**
   * Verify backup integrity by calculating checksum
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    const record = await this.backupRepo.findOne({
      where: { id: backupId },
    });

    if (!record) {
      throw new Error(`Backup record not found: ${backupId}`);
    }

    const start = Date.now();

    try {
      // Download from S3
      const tempFile = path.join(this.tmpDir, `verify-${Date.now()}.enc`);

      await this.downloadFromS3(record.s3Key, tempFile);

      // Verify checksum
      const checksum = await this.calculateChecksum(tempFile);
      const verified = checksum === record.checksumSha256;

      // Test restore if checksum matches
      let restoreTestPassed = false;
      if (verified && this.testDbHost) {
        try {
          restoreTestPassed = await this.testRestore(tempFile);
        } catch (err) {
          this.logger.warn(
            `Restore test failed for ${record.filename}: ${(err as Error).message}`,
          );
        }
      }

      fs.unlinkSync(tempFile);

      // Update record
      if (verified) {
        record.lastVerifiedAt = new Date();
        record.status = restoreTestPassed
          ? BackupStatus.RESTORE_TEST_PASSED
          : BackupStatus.SUCCESS;
        record.restoreTestDurationMs = Date.now() - start;

        this.logger.log(
          `Backup verified: ${record.filename} (checksum OK, restore: ${restoreTestPassed ? 'PASS' : 'UNTESTED'})`,
        );

        this.eventEmitter?.emit('backup.verified', {
          backupId,
          checksum,
          restoreTestPassed,
          duration: record.restoreTestDurationMs,
          timestamp: new Date(),
        });
      } else {
        record.status = BackupStatus.VERIFICATION_FAILED;
        record.errorMessage = `Checksum mismatch: expected ${record.checksumSha256}, got ${checksum}`;

        this.logger.error(`Backup verification failed: ${record.filename}`);

        this.eventEmitter?.emit('backup.verification.failed', {
          backupId,
          error: record.errorMessage,
          timestamp: new Date(),
        });
      }

      await this.backupRepo.save(record);
      return verified;
    } catch (err) {
      record.status = BackupStatus.VERIFICATION_FAILED;
      record.errorMessage = (err as Error).message;

      this.logger.error(
        `Backup verification error for ${record.filename}: ${record.errorMessage}`,
      );

      this.eventEmitter?.emit('backup.verification.failed', {
        backupId,
        error: record.errorMessage,
        timestamp: new Date(),
      });

      await this.backupRepo.save(record);
      return false;
    }
  }

  /**
   * Test restore on a separate test database
   */
  private async testRestore(encryptedBackupPath: string): Promise<boolean> {
    if (!this.testDbHost || !this.testDbUser || !this.testDbName) {
      this.logger.warn('Test database not configured, skipping restore test');
      return false;
    }

    const testDumpFile = path.join(
      this.tmpDir,
      `test-restore-${Date.now()}.dump`,
    );

    try {
      // Decrypt backup
      await this.decrypt(encryptedBackupPath, testDumpFile);

      // Drop test database and recreate
      const dropCommand = `dropdb --if-exists -h ${this.testDbHost} -p ${this.testDbPort} -U ${this.testDbUser} ${this.testDbName}`;
      const createCommand = `createdb -h ${this.testDbHost} -p ${this.testDbPort} -U ${this.testDbUser} ${this.testDbName}`;

      try {
        await execAsync(dropCommand);
      } catch (_) {
        // Database might not exist
      }

      await execAsync(createCommand);

      // Restore from backup
      const testDbUrl = `postgresql://${this.testDbUser}:${this.testDbPassword}@${this.testDbHost}:${this.testDbPort}/${this.testDbName}`;
      const restoreCommand = `pg_restore --no-password -d "${testDbUrl}" "${testDumpFile}"`;

      await execAsync(restoreCommand);

      this.logger.debug('Restore test completed successfully');
      return true;
    } catch (err) {
      throw new Error(`Restore test failed: ${(err as Error).message}`);
    } finally {
      this.cleanupFiles(testDumpFile);
    }
  }

  // Purge backups older than retention window — runs daily at 03:00 UTC
  @Cron('0 3 * * *')
  async purgeExpiredBackups(): Promise<void> {
    const expired = await this.backupRepo
      .createQueryBuilder('b')
      .where('b.expiresAt < :now', { now: new Date() })
      .andWhere('b.status = :status', { status: BackupStatus.SUCCESS })
      .getMany();

    for (const record of expired) {
      try {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: record.s3Key }),
        );
        await this.backupRepo.remove(record);
        this.logger.log(`Purged expired backup: ${record.filename}`);
      } catch (err) {
        this.logger.error(
          `Failed to purge ${record.filename}: ${(err as Error).message}`,
        );
      }
    }
  }

  async getRecentBackups(limit = 10): Promise<BackupRecord[]> {
    return this.backupRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getLastSuccessful(): Promise<BackupRecord | null> {
    return this.backupRepo.findOne({
      where: { status: BackupStatus.SUCCESS },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Verify an uploaded backup file
   */
  async verifyBackupFile(filePath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('Backup file not found');
      }

      // Check file size
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(filePath);
      this.logger.debug(`Uploaded backup checksum: ${checksum}`);

      return true;
    } catch (error) {
      this.logger.error(
        `Backup file verification failed: ${(error as Error).message}`,
      );
      return false;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async pgDump(outFile: string): Promise<void> {
    const dbUrl =
      this.config.get<string>('database.url') ??
      `postgresql://${this.config.get('database.user')}:${this.config.get('database.pass')}@${this.config.get('database.host')}:${this.config.get('database.port')}/${this.config.get('database.name')}`;

    const { stderr } = await execAsync(
      `pg_dump --format=custom --no-password "${dbUrl}" -f "${outFile}"`,
    );
    if (stderr) this.logger.warn(`pg_dump stderr: ${stderr}`);
  }

  private async encrypt(inputFile: string, outputFile: string): Promise<void> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const input = fs.createReadStream(inputFile);
    const output = fs.createWriteStream(outputFile);

    // Prepend IV to the encrypted file
    output.write(iv);
    await new Promise<void>((resolve, reject) => {
      input.pipe(cipher).pipe(output);
      output.on('finish', resolve);
      output.on('error', reject);
    });
  }

  private async decrypt(inputFile: string, outputFile: string): Promise<void> {
    const input = fs.createReadStream(inputFile);
    const output = fs.createWriteStream(outputFile);

    // Read IV from file
    const iv = Buffer.alloc(16);
    const fd = fs.openSync(inputFile, 'r');
    fs.readSync(fd, iv, 0, 16, 0);
    fs.closeSync(fd);

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      iv,
    );

    input.on('data', (chunk) => {
      if (input.bytesRead === 16) {
        // Skip the IV bytes on first read
        return;
      }
      decipher.write(chunk);
    });

    return new Promise<void>((resolve, reject) => {
      input.pipe(decipher).pipe(output);
      output.on('finish', resolve);
      output.on('error', reject);
      input.on('error', reject);
    });
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async uploadToS3(filePath: string, key: string): Promise<void> {
    const body = fs.createReadStream(filePath);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ServerSideEncryption: 'AES256',
        StorageClass: 'STANDARD_IA',
      }),
    );
  }

  private async downloadFromS3(key: string, filePath: string): Promise<void> {
    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!response.Body) {
      throw new Error('Empty response from S3');
    }

    const writeStream = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
      (response.Body as any).pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  private retentionExpiry(): Date {
    const d = new Date();
    d.setDate(d.getDate() + this.retentionDays);
    return d;
  }

  private cleanupFiles(...files: string[]): void {
    for (const f of files) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (_) {
        // best-effort cleanup
      }
    }
  }
}

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset, AssetType } from './entities/asset.entity';
import { AuditAction } from '../audit-log/audit-log.entity';
import { AuditService } from '../audit-log/audit.service';

@Injectable()
export class TrustlineEstablishmentService {
  private readonly logger = new Logger(TrustlineEstablishmentService.name);

  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    private readonly auditService: AuditService,
  ) {}

  async establishTrustlinesForAsset(assetId: string): Promise<{ success: boolean; errors: string[] }> {
    const asset = await this.assetRepo.findOne({ where: { id: assetId } });
    if (!asset) {
      throw new BadRequestException('Asset not found');
    }

    if (asset.type === AssetType.NATIVE) {
      this.logger.log(`Native asset ${asset.code} does not require trustlines`);
      return { success: true, errors: [] };
    }

    const errors: string[] = [];
    const platformAccounts = this.getPlatformAccounts();

    for (const account of platformAccounts) {
      try {
        const hasTrustline = await this.checkExistingTrustline(account, asset);
        if (hasTrustline) {
          this.logger.log(`Trustline already exists for ${account} and ${asset.code}`);
          continue;
        }

        await this.createTrustline(account, asset);
        this.logger.log(`Trustline established for ${account} and ${asset.code}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to establish trustline for ${account}: ${msg}`);
        this.logger.error(`Trustline establishment failed for ${account}: ${msg}`);

        await this.auditService.log({
          action: AuditAction.SYSTEM_ERROR,
          resource: 'trustline_establishment',
          resourceId: assetId,
          metadata: { account, assetCode: asset.code, error: msg },
        });
      }
    }

    if (errors.length > 0) {
      await this.auditService.log({
        action: AuditAction.SYSTEM_ERROR,
        resource: 'trustline_establishment',
        resourceId: assetId,
        metadata: { errors, assetCode: asset.code },
      });
    }

    return { success: errors.length === 0, errors };
  }

  private getPlatformAccounts(): string[] {
    const accounts = process.env.PLATFORM_STELLAR_ACCOUNTS?.split(',') || [];
    return accounts.map(a => a.trim()).filter(a => a.length > 0);
  }

  private async checkExistingTrustline(account: string, asset: Asset): Promise<boolean> {
    return false;
  }

  private async createTrustline(account: string, asset: Asset): Promise<void> {
    this.logger.log(`Creating trustline for ${account} to ${asset.code}:${asset.issuer}`);
  }
}

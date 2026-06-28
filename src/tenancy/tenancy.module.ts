import { Module, Global } from '@nestjs/common';
import { TenantScopingService } from './tenant-scoping.service';
import { TenantRlsSubscriber } from './tenant-rls.subscriber';
import { TenantDataSourceFactory } from './tenant-connection.factory';
import { TenantConnectionProvider } from './tenant-connection.provider';

@Global()
@Module({
  providers: [
    TenantScopingService,
    TenantRlsSubscriber,
    TenantDataSourceFactory,
    TenantConnectionProvider,
  ],
  exports: [
    TenantScopingService,
    TenantRlsSubscriber,
    TenantDataSourceFactory,
    TenantConnectionProvider,
  ],
})
export class TenancyModule {}

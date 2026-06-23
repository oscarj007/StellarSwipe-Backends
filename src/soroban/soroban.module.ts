import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SorobanService } from './soroban.service';
import { StellarConfigService } from '../config/stellar.service';
import { ContractDeploymentService } from './deployment/contract-deployment.service';
import { SorobanTransactionBuilderService } from './soroban-transaction-builder.service';
import { ContractUpgradeGovernanceService } from './contract-upgrade-governance.service';
import { ContractUpgradeProposal } from './entities/contract-upgrade-proposal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContractUpgradeProposal])],
  providers: [
    SorobanService,
    StellarConfigService,
    ContractDeploymentService,
    SorobanTransactionBuilderService,
    ContractUpgradeGovernanceService,
  ],
  exports: [
    SorobanService,
    ContractDeploymentService,
    SorobanTransactionBuilderService,
    ContractUpgradeGovernanceService,
  ],
})
export class SorobanModule {}

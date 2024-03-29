import { ChainName, HyperlaneCore } from '@hyperlane-xyz/sdk';

import { RemoteGasData, StorageGasOracleConfig } from '../../src/config';
import { deployEnvToSdkEnv } from '../../src/config/environment';
import { RemoteGasDataConfig } from '../../src/config/gas-oracle';
import { getArgs, getCoreEnvironmentConfig, getEnvironment } from '../utils';

import {
  eqRemoteGasData,
  prettyRemoteGasData,
  prettyRemoteGasDataConfig,
} from './utils';

/**
 * Idempotent. Use `--dry-run` to not send any transactions.
 * Updates the currently stored gas data on the StorageGasOracle contract
 * if the configured data differs from the on-chain data.
 * Expects the deployer key to be the owner of the StorageGasOracle contract.
 */
async function main() {
  const args = await getArgs()
    .boolean('dry-run')
    .describe('dry-run', 'If true, will not submit any transactions')
    .default('dry-run', false).argv;

  const environment = await getEnvironment();
  const coreEnvConfig = getCoreEnvironmentConfig(environment);
  const multiProvider = await coreEnvConfig.getMultiProvider();

  const storageGasOracleConfig = coreEnvConfig.storageGasOracleConfig;
  if (!storageGasOracleConfig) {
    throw Error(`No storage gas oracle config for environment ${environment}`);
  }

  const core = HyperlaneCore.fromEnvironment(
    deployEnvToSdkEnv[environment],
    multiProvider,
  );

  for (const chain of core.chains()) {
    await setStorageGasOracleValues(
      core,
      storageGasOracleConfig[chain],
      chain,
      args.dryRun,
    );
    console.log('\n===========');
  }
}

async function setStorageGasOracleValues(
  core: HyperlaneCore,
  localStorageGasOracleConfig: StorageGasOracleConfig,
  local: ChainName,
  dryRun: boolean,
) {
  console.log(`Setting remote gas data on local chain ${local}...`);
  const storageGasOracle = core.getContracts(local).storageGasOracle;

  const configsToSet: RemoteGasDataConfig[] = [];

  for (const remote in localStorageGasOracleConfig) {
    const desiredGasData = localStorageGasOracleConfig[remote]!;
    const remoteId = core.multiProvider.getDomainId(remote);

    const existingGasData: RemoteGasData = await storageGasOracle.remoteGasData(
      remoteId,
    );

    console.log(
      `${local} -> ${remote} existing gas data:\n`,
      prettyRemoteGasData(existingGasData),
    );
    console.log(
      `${local} -> ${remote} desired gas data:\n`,
      prettyRemoteGasData(desiredGasData),
    );

    if (eqRemoteGasData(existingGasData, desiredGasData)) {
      console.log('Existing and desired gas data are the same, doing nothing');
    } else {
      console.log('Existing and desired gas data differ, will update');
      configsToSet.push({
        remoteDomain: remoteId,
        ...desiredGasData,
      });
    }
    console.log('---');
  }

  if (configsToSet.length > 0) {
    console.log(`Updating ${configsToSet.length} configs on local ${local}:`);
    console.log(
      configsToSet
        .map((config) => prettyRemoteGasDataConfig(core.multiProvider, config))
        .join('\n\t--\n'),
    );

    if (dryRun) {
      console.log('Running in dry run mode, not sending tx');
    } else {
      await core.multiProvider.handleTx(
        local,
        storageGasOracle.setRemoteGasDataConfigs(configsToSet),
      );
    }
  }
}

main().catch((err) => console.error('Error', err));

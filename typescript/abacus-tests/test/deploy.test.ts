import { ethers } from 'hardhat';
import { expect } from 'chai';

import { getTestDeploy } from './testChain';
import { Updater } from '../lib/core';
import { Signer } from '../lib/types';
import { CoreContractAddresses } from '@abacus-network/abacus-deploy/dist/src/config/addresses';
import { deployBridges } from '@abacus-network/abacus-deploy/dist/src/bridge';
import { BridgeDeploy } from '@abacus-network/abacus-deploy/dist/src/bridge/BridgeDeploy';
import {
  deployTwoChains,
  deployNChains,
} from '@abacus-network/abacus-deploy/dist/src/core';
import { CoreDeploy } from '@abacus-network/abacus-deploy/dist/src/core/CoreDeploy';
import {
  MockWeth,
  MockWeth__factory,
} from '@abacus-network/ts-interface/dist/abacus-xapps';
import { DeployEnvironment } from '@abacus-network/abacus-deploy/dist/src/deploy';

const domains = [1000, 2000, 3000, 4000];

/*
 * Deploy the full Abacus suite on two chains
 */
describe('core deploy scripts', async () => {
  let signer: Signer, recoveryManager: Signer, updater: Updater;

  before(async () => {
    [signer, recoveryManager] = await ethers.getSigners();
    updater = await Updater.fromSigner(signer, domains[0]);
  });

  describe('deployTwoChains', async () => {
    it('2-chain deploy', async () => {
      let deploys: CoreDeploy[] = [];
      for (var i = 0; i < 2; i++) {
        deploys.push(
          await getTestDeploy(domains[i], updater.address, [
            recoveryManager.address,
          ]),
        );
      }

      // deploy abacus contracts on 2 chains
      // will test inside deploy function
      await deployTwoChains(deploys[0], deploys[1]);
    });
  });

  describe('deployNChains', async () => {
    // tests deploys for up to 4 chains
    for (let i = 1; i <= 4; i++) {
      it(`${i}-chain deploy`, async () => {
        let deploys: CoreDeploy[] = [];
        for (let j = 0; j < i; j++) {
          deploys.push(
            await getTestDeploy(domains[j], updater.address, [
              recoveryManager.address,
            ]),
          );
        }

        // deploy abacus contracts on `i` chains
        // will test inside deploy function
        await deployNChains(deploys);
      });
    }

    it(`asserts there is at least one deploy config`, async () => {
      const deploys: CoreDeploy[] = [];
      const errMsg = 'Must pass at least one deploy config';

      try {
        await deployNChains(deploys);
        // `deployNChains` should error and skip to catch block. If it didn't, we need to make it fail
        // here (same as `expect(true).to.be.false`, but more explicit)
        expect('no error').to.equal(errMsg);
      } catch (e: any) {
        // expect correct error message
        expect(e.message).to.equal(errMsg);
      }
    });
  });
});

describe('bridge deploy scripts', async () => {
  const numChains = 3;

  let signer: Signer,
    recoveryManager: Signer,
    updater: Updater,
    mockWeth: MockWeth,
    deploys: CoreDeploy[] = [],
    coreAddresses: CoreContractAddresses[] = [];

  before(async () => {
    [signer, recoveryManager] = await ethers.getSigners();
    updater = await Updater.fromSigner(signer, domains[0]);
    mockWeth = await new MockWeth__factory(signer).deploy();

    // deploy core contracts on 2 chains
    for (let i = 0; i < numChains; i++) {
      if (i == 0) {
        deploys.push(
          await getTestDeploy(domains[i], updater.address, [
            recoveryManager.address,
          ]),
        );
      } else {
        deploys.push(
          await getTestDeploy(
            domains[i],
            updater.address,
            [recoveryManager.address],
            recoveryManager.address,
            mockWeth.address,
          ),
        );
      }
    }
    await deployNChains(deploys);

    for (let i = 0; i < numChains; i++) {
      coreAddresses.push(deploys[i].contracts.toObject());
    }
  });

  it('2-chain bridge', async () => {
    // instantiate alfajores and kovan bridge deploys
    const alfajoresDeploy = new BridgeDeploy(
      deploys[0].chain,
      DeployEnvironment.test,
      true,
      coreAddresses[0],
    );
    const kovanDeploy = new BridgeDeploy(
      deploys[1].chain,
      DeployEnvironment.test,
      true,
      coreAddresses[1],
    );

    // deploy bridges
    await deployBridges([alfajoresDeploy, kovanDeploy]);
  });

  it('3-chain bridge', async () => {
    // instantiate 3 deploys: alfajores, kovan and rinkeby
    const alfajoresDeploy = new BridgeDeploy(
      deploys[0].chain,
      DeployEnvironment.test,
      true,
      coreAddresses[0],
    );
    const kovanDeploy = new BridgeDeploy(
      deploys[1].chain,
      DeployEnvironment.test,
      true,
      coreAddresses[1],
    );
    const rinkebyDeploy = new BridgeDeploy(
      deploys[2].chain,
      DeployEnvironment.test,
      true,
      coreAddresses[2],
    );

    // deploy 3 bridges
    await deployBridges([alfajoresDeploy, kovanDeploy, rinkebyDeploy]);
  });
});
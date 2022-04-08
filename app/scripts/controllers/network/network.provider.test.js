/**
 * @jest-environment node
 */

import EthQuery from 'eth-query';
import { addHexPrefix, privateToAddress } from 'ethereumjs-util';
import { personalSign } from 'eth-sig-util';
import nock from 'nock';
import NetworkController from './network';

// const infuraProjectId = '591f0dce1c6d4316aad895d1716a47f7';
const infuraProjectId = 'abc123';
const latestBlockNumber = '0x1';
const latestBlockResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: latestBlockNumber,
};

function buildScopeForMockingInfuraRequests({ network = 'mainnet' } = {}) {
  return nock(`https://${network}.infura.io`).filteringRequestBody((body) => {
    const copyOfBody = JSON.parse(body);
    // some ids are random, so remove them entirely from the request to
    // make it possible to mock these requests
    delete copyOfBody.id;
    return JSON.stringify(copyOfBody);
  });
}

/**
 * Mock requests that occur within NetworkController when it is 1) making sure
 * that Infura is available and 2) checking to see whether the network supports
 * EIP-1559 transactions.
 *
 * @param {object} options - The options.
 * @param {string} [options.network] - The name of the Infura network to connect
 * to (default: "mainnet").
 */
function mockInfuraRequestsForProbes({ network = 'mainnet' } = {}) {
  return buildScopeForMockingInfuraRequests({ network })
    .post(`/v3/${infuraProjectId}`, {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
    })
    .times(2)
    .reply(200, latestBlockNumber);
}

function mockInfuraRequestsForPollingBlockTracker({
  network = 'mainnet',
} = {}) {
  return (
    buildScopeForMockingInfuraRequests({ network })
      // We don't know how many times this will be called as we will poll
      // for this occasionally (as well as calling this manually)
      .persist()
      .post(`/v3/${infuraProjectId}`, {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
      })
      .reply(200, latestBlockResponse)
  );
}

function mockInfuraRequestsForProbeAndBlockTracker({
  network = 'mainnet',
} = {}) {
  // mockInfuraRequestsForProbes({ network });
  mockInfuraRequestsForPollingBlockTracker({ network });
  return buildScopeForMockingInfuraRequests({ network });
}

async function withConnectionToInfuraNetwork(...args) {
  const fn = args.pop();
  const opts = args[0] ?? {};
  const network = opts.network ?? 'mainnet';
  const providerParams = opts.providerParams ?? {};
  const controller = new NetworkController();
  controller.setInfuraProjectId(infuraProjectId);
  controller.initializeProvider({
    getAccounts() {
      // intentionally left blank
    },
    ...providerParams,
  });
  controller.setProviderConfig({ type: network });
  const { provider } = controller.getProviderAndBlockTracker();
  const ethQuery = new EthQuery(provider);
  let result;
  try {
    result = await fn({ controller, provider, ethQuery });
  } finally {
    await controller.destroy();
  }
  return result;
}

function mockRpcMethodCallToInfura({
  network = 'mainnet',
  method,
  params = [],
}) {
  const scope = buildScopeForMockingInfuraRequests({ network });
  return scope.post(`/v3/${infuraProjectId}`, {
    jsonrpc: '2.0',
    method,
    params,
  });
}

function mockArbitraryRpcMethodCallToInfura({ network = 'mainnet' } = {}) {
  return mockRpcMethodCallToInfura({ network, method: 'arbitraryRpcMethod' });
}

function callRpcMethod({ ethQuery, method, params = [] }) {
  return new Promise((resolve, reject) => {
    ethQuery.sendAsync({ method, params }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function callArbitraryRpcMethod({ ethQuery }) {
  return callRpcMethod({ ethQuery, method: 'arbitraryRpcMethod' });
}

describe('NetworkController provider tests', () => {
  // let nockCallObjects;

  // beforeEach(() => {
  // nockCallObjects = nock.recorder.rec({
  // dont_print: true,
  // output_objects: true,
  // });
  // });

  afterEach(() => {
    // console.log(nockCallObjects);
    // console.log('checking to make sure all pending requests are satisfied');
    nock.isDone();
    nock.cleanAll();
  });

  describe('if NetworkController is configured with an Infura network', () => {
    beforeEach(() => {
      const originalSetTimeout = global.setTimeout;
      // Stub setTimeout so that request retries occur faster
      jest.spyOn(global, 'setTimeout').mockImplementation((fn, _timeout) => {
        return originalSetTimeout(fn, 100);
      });
    });

    // -----------
    // MetaMask middleware
    // (app/scripts/controllers/network/createMetamaskMiddleware.js)
    // -----------

    // Scaffold middleware

    describe('when the RPC method is "eth_syncing"', () => {
      it('returns a static result', async () => {
        mockInfuraRequestsForProbeAndBlockTracker();

        const result = await withConnectionToInfuraNetwork(({ ethQuery }) => {
          return callRpcMethod({ ethQuery, method: 'eth_syncing' });
        });

        expect(result).toBe(false);
      });
    });

    describe('when the RPC method is "web3_clientVersion"', () => {
      it('returns a static result', async () => {
        mockInfuraRequestsForProbeAndBlockTracker();

        const result = await withConnectionToInfuraNetwork(
          {
            providerParams: {
              version: '1.0.0',
            },
          },
          ({ ethQuery }) => {
            return callRpcMethod({ ethQuery, method: 'web3_clientVersion' });
          },
        );

        expect(result).toStrictEqual('MetaMask/v1.0.0');
      });
    });

    // Wallet middleware
    // (eth-json-rpc-middleware -> createWalletMiddleware)

    describe('when the RPC method is "eth_accounts"', () => {
      it('returns the result of getAccounts', async () => {
        const accounts = ['0x1', '0x2'];
        mockInfuraRequestsForProbeAndBlockTracker();

        const result = await withConnectionToInfuraNetwork(
          {
            providerParams: {
              async getAccounts() {
                return accounts;
              },
            },
          },
          ({ ethQuery }) => {
            return callRpcMethod({ ethQuery, method: 'eth_accounts' });
          },
        );

        expect(result).toStrictEqual(accounts);
      });
    });

    describe('when the RPC method is "eth_coinbase"', () => {
      it('returns the first account obtained via the given getAccounts function', async () => {
        const accounts = ['0x1', '0x2'];
        mockInfuraRequestsForProbeAndBlockTracker();

        const result = await withConnectionToInfuraNetwork(
          {
            providerParams: {
              async getAccounts() {
                return accounts;
              },
            },
          },
          ({ ethQuery }) => {
            return callRpcMethod({ ethQuery, method: 'eth_coinbase' });
          },
        );

        expect(result).toStrictEqual('0x1');
      });
    });

    describe('when the RPC method is "eth_sendTransaction"', () => {
      describe('when configured with a processTransaction function', () => {
        it('returns the result of processTransaction, passing it a normalized version of the RPC params', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                async getAccounts() {
                  return ['0xabc123'];
                },
                async processTransaction(params) {
                  return params;
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'eth_sendTransaction',
                params: [
                  { from: '0xABC123', to: '0xDEF456', value: '0x12345' },
                ],
              });
            },
          );

          expect(result).toStrictEqual({
            from: '0xabc123',
            to: '0xDEF456',
            value: '0x12345',
          });
        });
      });

      describe('when not configured with a processTransaction function', () => {
        it('throws a "method not found" error', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const promise = withConnectionToInfuraNetwork(({ ethQuery }) => {
            return callRpcMethod({
              ethQuery,
              method: 'eth_sendTransaction',
            });
          });

          await expect(promise).rejects.toThrow('Method not supported.');
        });
      });
    });

    describe('when the RPC method is "eth_signTransaction"', () => {
      it('does not support it because it does not pass a processSignTransaction function to createWalletMiddleware, even though createWalletMiddleware supports it', async () => {
        mockInfuraRequestsForProbeAndBlockTracker();

        const promise = withConnectionToInfuraNetwork(
          {
            providerParams: {
              async processSignTransaction(params) {
                return params;
              },
            },
          },
          ({ ethQuery }) => {
            return callRpcMethod({
              ethQuery,
              method: 'eth_signTransaction',
              params: [{ from: '0xABC123', to: '0xDEF456', value: '0x12345' }],
            });
          },
        );

        await expect(promise).rejects.toThrow('Method not supported.');
      });
    });

    describe('when the RPC method is "eth_sign"', () => {
      describe('when configured with a processEthSignMessage function', () => {
        it('delegates to processEthSignMessage, passing a processed version of the RPC params', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                async getAccounts() {
                  return ['0xabc123'];
                },
                async processEthSignMessage(params) {
                  return params;
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'eth_sign',
                params: [
                  '0xABC123',
                  'this is the message',
                  { extra: 'params' },
                ],
              });
            },
          );

          expect(result).toStrictEqual({
            from: '0xabc123',
            data: 'this is the message',
            extra: 'params',
          });
        });
      });

      describe('when not configured with a processTransaction function', () => {
        it('throws a "method not found" error', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const promise = withConnectionToInfuraNetwork(({ ethQuery }) => {
            return callRpcMethod({
              ethQuery,
              method: 'eth_sign',
            });
          });

          await expect(promise).rejects.toThrow('Method not supported.');
        });
      });
    });

    describe('when the RPC method is "eth_signTypedData"', () => {
      describe('when configured with a processTypedMessage function', () => {
        it('delegates to the given processTypedMessage function, passing a processed version of the RPC params and a version', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                async getAccounts() {
                  return ['0xabc123'];
                },
                async processTypedMessage(params, _req, version) {
                  return { params, version };
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'eth_signTypedData',
                params: [
                  'this is the message',
                  '0xABC123',
                  { extra: 'params' },
                ],
              });
            },
          );

          expect(result).toStrictEqual({
            params: {
              from: '0xabc123',
              data: 'this is the message',
              extra: 'params',
            },
            version: 'V1',
          });
        });
      });

      describe('when not configured with a processTypedMessage function', () => {
        it('throws a "method not found" error', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const promise = withConnectionToInfuraNetwork(({ ethQuery }) => {
            return callRpcMethod({
              ethQuery,
              method: 'eth_signTypedData',
            });
          });

          await expect(promise).rejects.toThrow('Method not supported.');
        });
      });
    });

    describe('when the RPC method is "eth_signTypedData_v3"', () => {
      describe('when configured with a processTypedMessageV3 function', () => {
        it('delegates to processTypedMessageV3, passing a processed version of the RPC params and a version', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                async getAccounts() {
                  return ['0xabc123'];
                },
                async processTypedMessageV3(params, _req, version) {
                  return { params, version };
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'eth_signTypedData_v3',
                params: ['0xABC123', 'this is the message'],
              });
            },
          );

          expect(result).toStrictEqual({
            params: {
              from: '0xabc123',
              data: 'this is the message',
              version: 'V3',
            },
            version: 'V3',
          });
        });
      });

      describe('when not configured with a processTypedMessageV3 function', () => {
        it('throws a "method not found" error', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const promise = withConnectionToInfuraNetwork(({ ethQuery }) => {
            return callRpcMethod({
              ethQuery,
              method: 'eth_signTypedData_v3',
            });
          });

          await expect(promise).rejects.toThrow('Method not supported.');
        });
      });
    });

    describe('when the RPC method is "eth_signTypedData_v4"', () => {
      describe('when configured with a processTypedMessageV4 function', () => {
        it('delegates to processTypedMessageV4, passing a processed version of the RPC params and a version', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                async getAccounts() {
                  return ['0xabc123'];
                },
                async processTypedMessageV4(params, _req, version) {
                  return { params, version };
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'eth_signTypedData_v4',
                params: ['0xABC123', 'this is the message'],
              });
            },
          );

          expect(result).toStrictEqual({
            params: {
              from: '0xabc123',
              data: 'this is the message',
              version: 'V4',
            },
            version: 'V4',
          });
        });
      });

      describe('when not configured with a processTypedMessageV4 function', () => {
        it('throws a "method not found" error', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const promise = withConnectionToInfuraNetwork(({ ethQuery }) => {
            return callRpcMethod({
              ethQuery,
              method: 'eth_signTypedData_v4',
            });
          });

          await expect(promise).rejects.toThrow('Method not supported.');
        });
      });
    });

    describe('when the RPC method is "personal_sign"', () => {
      describe('when configured with a processPersonalMessage function', () => {
        it('delegates to the given processPersonalMessage function, passing a processed version of the RPC params', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                async getAccounts() {
                  return ['0xabc123'];
                },
                async processPersonalMessage(params) {
                  return params;
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'personal_sign',
                params: [
                  'this is the message',
                  '0xABC123',
                  { extra: 'params' },
                ],
              });
            },
          );

          expect(result).toStrictEqual({
            from: '0xabc123',
            data: 'this is the message',
            extra: 'params',
          });
        });

        it('also accepts RPC params in the order [address, message] for backward compatibility', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                async getAccounts() {
                  return ['0xabcdef1234567890abcdef1234567890abcdef12'];
                },
                async processPersonalMessage(params) {
                  return params;
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'personal_sign',
                params: [
                  '0XABCDEF1234567890ABCDEF1234567890ABCDEF12',
                  'this is the message',
                  { extra: 'params' },
                ],
              });
            },
          );

          expect(result).toStrictEqual({
            from: '0xabcdef1234567890abcdef1234567890abcdef12',
            data: 'this is the message',
            extra: 'params',
          });
        });
      });

      describe('when not configured with a processPersonalMessage function', () => {
        it('throws a "method not found" error', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const promise = withConnectionToInfuraNetwork(({ ethQuery }) => {
            return callRpcMethod({
              ethQuery,
              method: 'personal_sign',
            });
          });

          await expect(promise).rejects.toThrow('Method not supported.');
        });
      });
    });

    describe('when the RPC method is "eth_getEncryptionPublicKey"', () => {
      describe('when configured with a processEncryptionPublicKey function', () => {
        it('delegates to processEncryptionPublicKey, passing the address in the RPC params', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                async getAccounts() {
                  return ['0xabc123'];
                },
                async processEncryptionPublicKey(address) {
                  return address;
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'eth_getEncryptionPublicKey',
                params: ['0xABC123'],
              });
            },
          );

          expect(result).toStrictEqual('0xabc123');
        });
      });

      describe('when not configured with a processEncryptionPublicKey function', () => {
        it('throws a "method not found" error', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const promise = withConnectionToInfuraNetwork(({ ethQuery }) => {
            return callRpcMethod({
              ethQuery,
              method: 'eth_getEncryptionPublicKey',
            });
          });

          await expect(promise).rejects.toThrow('Method not supported.');
        });
      });
    });

    describe('when the RPC method is "eth_decrypt"', () => {
      describe('when configured with a processDecryptMessage function', () => {
        it('delegates to the given processDecryptMessage function, passing a processed version of the RPC params', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                async getAccounts() {
                  return ['0xabc123'];
                },
                async processDecryptMessage(params) {
                  return params;
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'eth_decrypt',
                params: [
                  'this is the message',
                  '0xABC123',
                  { extra: 'params' },
                ],
              });
            },
          );

          expect(result).toStrictEqual({
            from: '0xabc123',
            data: 'this is the message',
            extra: 'params',
          });
        });
      });

      describe('when not configured with a processDecryptMessage function', () => {
        it('throws a "method not found" error', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const promise = withConnectionToInfuraNetwork(({ ethQuery }) => {
            return callRpcMethod({
              ethQuery,
              method: 'eth_decrypt',
            });
          });

          await expect(promise).rejects.toThrow('Method not supported.');
        });
      });
    });

    describe('when the RPC method is "personal_ecRecover"', () => {
      it("returns the result of eth-sig-util's recoverPersonalSignature function, passing it a processed version of the RPC params", async () => {
        mockInfuraRequestsForProbeAndBlockTracker();
        const privateKey = Buffer.from(
          'ea54bdc52d163f88c93ab0615782cf718a2efb9e51a7989aab1b08067e9c1c5f',
          'hex',
        );
        const message = addHexPrefix(
          Buffer.from('Hello, world!').toString('hex'),
        );
        const signature = personalSign(privateKey, { data: message });
        const address = addHexPrefix(
          privateToAddress(privateKey).toString('hex'),
        );

        const result = await withConnectionToInfuraNetwork(({ ethQuery }) => {
          return callRpcMethod({
            ethQuery,
            method: 'personal_ecRecover',
            params: [message, signature, { extra: 'params' }],
          });
        });

        expect(result).toStrictEqual(address);
      });
    });

    // Pending nonce middleware
    // (app/scripts/controllers/network/middleware/pending.js)

    describe('when the RPC method is "eth_getTransactionCount" and the block param is "pending"', () => {
      it('returns the result of the given getPendingNonce function', async () => {
        mockInfuraRequestsForProbeAndBlockTracker();

        const result = await withConnectionToInfuraNetwork(
          {
            providerParams: {
              async getPendingNonce(param) {
                return { param, blockNumber: '0x2' };
              },
            },
          },
          ({ ethQuery }) => {
            return callRpcMethod({
              ethQuery,
              method: 'eth_getTransactionCount',
              params: ['0xabc123', 'pending'],
            });
          },
        );

        expect(result).toStrictEqual({ param: '0xabc123', blockNumber: '0x2' });
      });
    });

    // Pending transactions middleware
    // (app/scripts/controllers/network/middleware/pending.js)

    describe('when the RPC method is "eth_getTransactionByHash"', () => {
      describe('assuming that the given getPendingTransactionByHash function returns a (pending) EIP-1559 transaction', () => {
        it('delegates to getPendingTransactionByHash, using a standardized version of the transaction as the result', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                getPendingTransactionByHash(_hash) {
                  return {
                    txParams: {
                      maxFeePerGas: '0x174876e800',
                      maxPriorityFeePerGas: '0x3b9aca00',
                    },
                  };
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'eth_getTransactionByHash',
                params: ['0x999'],
              });
            },
          );

          expect(result).toStrictEqual({
            v: undefined,
            r: undefined,
            s: undefined,
            to: undefined,
            gas: undefined,
            from: undefined,
            hash: undefined,
            nonce: undefined,
            input: '0x',
            value: '0x0',
            accessList: null,
            blockHash: null,
            blockNumber: null,
            transactionIndex: null,
            gasPrice: '0x174876e800',
            maxFeePerGas: '0x174876e800',
            maxPriorityFeePerGas: '0x3b9aca00',
            type: '0x2',
          });
        });
      });

      describe('assuming that the given getPendingTransactionByHash function returns a (pending) non-EIP-1559 transaction', () => {
        it('delegates to getPendingTransactionByHash, using a standardized, type-0 version of the transaction as the result', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                getPendingTransactionByHash(_hash) {
                  return {
                    txParams: {
                      gasPrice: '0x174876e800',
                    },
                  };
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'eth_getTransactionByHash',
                params: ['0x999'],
              });
            },
          );

          expect(result).toStrictEqual({
            v: undefined,
            r: undefined,
            s: undefined,
            to: undefined,
            gas: undefined,
            from: undefined,
            hash: undefined,
            nonce: undefined,
            input: '0x',
            value: '0x0',
            accessList: null,
            blockHash: null,
            blockNumber: null,
            transactionIndex: null,
            gasPrice: '0x174876e800',
            type: '0x0',
          });
        });
      });

      describe('if the given getPendingTransactionByHash function returns nothing', () => {
        it('passes the request through to Infura', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockRpcMethodCallToInfura({
            method: 'eth_getTransactionByHash',
            params: ['0x999'],
          }).reply(200, {
            result: 'result from Infura',
          });

          const result = await withConnectionToInfuraNetwork(
            {
              providerParams: {
                getPendingTransactionByHash() {
                  return null;
                },
              },
            },
            ({ ethQuery }) => {
              return callRpcMethod({
                ethQuery,
                method: 'eth_getTransactionByHash',
                params: ['0x999'],
              });
            },
          );

          expect(result).toStrictEqual('result from Infura');
        });
      });
    });

    // -----------
    // Network middleware
    // (app/scripts/controllers/network/createInfuraClient.js)
    // -----------

    // Network and chain id middleware

    describe('when the RPC method is "eth_chainId"', () => {
      it('does not hit Infura, instead returning the chain id that maps to the Infura network', async () => {
        const network = 'ropsten';
        mockInfuraRequestsForProbeAndBlockTracker({ network });

        const chainId = await withConnectionToInfuraNetwork(
          { network },
          ({ ethQuery }) => callRpcMethod({ ethQuery, method: 'eth_chainId' }),
        );

        expect(chainId).toStrictEqual('0x3');
      });
    });

    describe('when the RPC method is "net_version"', () => {
      it('does not hit Infura, instead returning the chain id that maps to the Infura network, as a decimal', async () => {
        const network = 'ropsten';
        mockInfuraRequestsForProbeAndBlockTracker({ network });

        const netVersion = await withConnectionToInfuraNetwork(
          { network },
          ({ ethQuery }) => callRpcMethod({ ethQuery, method: 'net_version' }),
        );

        expect(netVersion).toStrictEqual('3');
      });
    });

    // --- Block cache middleware ---

    /*
    const cacheableMethods = [
      'web3_clientVersion',
      'web3_sha3',
      'eth_protocolVersion',
      'eth_getBlockTransactionCountByHash',
      'eth_getUncleCountByBlockHash',
      'eth_getCode',
      'eth_getBlockByHash',
      'eth_getTransactionByHash',
      'eth_getTransactionByBlockHashAndIndex',
      'eth_getTransactionReceipt',
      'eth_getUncleByBlockHashAndIndex',
      'eth_getCompilers',
      'eth_compileLLL',
      'eth_compileSolidity',
      'eth_compileSerpent',
      'shh_version',
      'test_permaCache',
      'eth_getBlockByNumber',
      'eth_getBlockTransactionCountByNumber',
      'eth_getUncleCountByBlockNumber',
      'eth_getTransactionByBlockNumberAndIndex',
      'eth_getUncleByBlockNumberAndIndex',
      'test_forkCache',
      'eth_gasPrice',
      'eth_blockNumber',
      'eth_getBalance',
      'eth_getStorageAt',
      'eth_getTransactionCount',
      'eth_call',
      'eth_estimateGas',
      'eth_getFilterLogs',
      'eth_getLogs',
      'test_blockCache',
    ];
    */

    // [TODO]

    // Inflight cache middleware

    // [TODO]

    // Block ref middleware

    // [TODO]

    // -----------
    // Infura middleware
    // (eth-json-rpc-infura -> createInfuraMiddleware)
    // -----------

    describe('when the RPC method is anything', () => {
      it('passes the request through to Infura, throwing a specific error message if it responds with 405', async () => {
        mockInfuraRequestsForProbeAndBlockTracker();
        mockArbitraryRpcMethodCallToInfura().reply(405);

        const promiseForResult = withConnectionToInfuraNetwork(({ ethQuery }) =>
          callArbitraryRpcMethod({ ethQuery }),
        );

        await expect(promiseForResult).rejects.toThrow(
          'The method does not exist / is not available.',
        );
      });

      it('passes the request through to Infura, throwing a specific error message if it responds with 429', async () => {
        mockInfuraRequestsForProbeAndBlockTracker();
        mockArbitraryRpcMethodCallToInfura().reply(429);

        const promiseForResult = withConnectionToInfuraNetwork(({ ethQuery }) =>
          callArbitraryRpcMethod({ ethQuery }),
        );

        await expect(promiseForResult).rejects.toThrow(
          'Request is being rate limited',
        );
      });

      describe('if the request to Infura responds with 503', () => {
        it('retries the request up to 5 times until Infura responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCallToInfura().times(4).reply(503);
          mockArbitraryRpcMethodCallToInfura().reply(200, {
            jsonrpc: '2.0',
            id: 1,
            result: 'result from Infura',
          });

          const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
            callArbitraryRpcMethod({ ethQuery }),
          );

          expect(result).toStrictEqual('result from Infura');
        });

        it('throws an error if Infura never responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCallToInfura().times(5).reply(503);

          const promiseForResult = withConnectionToInfuraNetwork(
            ({ ethQuery }) => callArbitraryRpcMethod({ ethQuery }),
          );

          await expect(promiseForResult).rejects.toThrow(
            /^InfuraProvider - cannot complete request\. All retries exhausted\./u,
          );
        });
      });

      describe('if the request to Infura responds with 504', () => {
        it('retries the request up to 5 times until Infura responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCallToInfura(
            mockArbitraryRpcMethodCallToInfura().times(4).reply(504),
          ).reply(200, {
            jsonrpc: '2.0',
            id: 1,
            result: 'result from Infura',
          });

          const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
            callArbitraryRpcMethod({ ethQuery }),
          );

          expect(result).toStrictEqual('result from Infura');
        });

        it('throws an error if Infura never responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCallToInfura().times(5).reply(504);

          const promiseForResult = withConnectionToInfuraNetwork(
            ({ ethQuery }) => callArbitraryRpcMethod({ ethQuery }),
          );

          await expect(promiseForResult).rejects.toThrow(
            /^InfuraProvider - cannot complete request\. All retries exhausted\./u,
          );
        });
      });

      describe('if the request to Infura times out', () => {
        it('retries the request up to 5 times until Infura responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCallToInfura()
            .times(4)
            .replyWithError('ETIMEDOUT: Some error message');
          mockArbitraryRpcMethodCallToInfura().reply(200, {
            jsonrpc: '2.0',
            id: 1,
            result: 'result from Infura',
          });

          const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
            callArbitraryRpcMethod({ ethQuery }),
          );

          expect(result).toStrictEqual('result from Infura');
        });

        it('throws an error if Infura never responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCallToInfura()
            .times(5)
            .replyWithError('ETIMEDOUT: Some error message');

          const promiseForResult = withConnectionToInfuraNetwork(
            ({ ethQuery }) => callArbitraryRpcMethod({ ethQuery }),
          );

          await expect(promiseForResult).rejects.toThrow(
            /^InfuraProvider - cannot complete request\. All retries exhausted\./u,
          );
        });
      });

      describe('if a "connection reset" error is thrown while making the request to Infura', () => {
        it('retries the request up to 5 times until Infura responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCallToInfura()
            .times(4)
            .replyWithError('ECONNRESET: Some error message');
          mockArbitraryRpcMethodCallToInfura().reply(200, {
            jsonrpc: '2.0',
            id: 1,
            result: 'result from Infura',
          });

          const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
            callArbitraryRpcMethod({ ethQuery }),
          );

          expect(result).toStrictEqual('result from Infura');
        });

        it('throws an error if the request never responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCallToInfura()
            .times(5)
            .replyWithError('ECONNRESET: Some error message');

          const promiseForResult = withConnectionToInfuraNetwork(
            ({ ethQuery }) => callArbitraryRpcMethod({ ethQuery }),
          );

          await expect(promiseForResult).rejects.toThrow(
            /^InfuraProvider - cannot complete request\. All retries exhausted\./u,
          );
        });
      });

      describe('if the request to Infura responds with HTML or something else that is non-JSON-parseable', () => {
        it('retries the request up to 5 times until Infura returns something JSON-parseable', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCallToInfura()
            .times(4)
            .reply('<html><p>Some error message</p></html>');
          mockArbitraryRpcMethodCallToInfura().reply(200, {
            jsonrpc: '2.0',
            id: 1,
            result: 'result from Infura',
          });

          const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
            callArbitraryRpcMethod({ ethQuery }),
          );

          expect(result).toStrictEqual('result from Infura');
        });

        it('throws an error if Infura never responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCallToInfura()
            .times(5)
            .reply('<html><p>Some error message</p></html>');

          const promiseForResult = withConnectionToInfuraNetwork(
            ({ ethQuery }) => callArbitraryRpcMethod({ ethQuery }),
          );

          await expect(promiseForResult).rejects.toThrow(
            /^InfuraProvider - cannot complete request\. All retries exhausted\./u,
          );
        });
      });
    });

    describe('when the RPC method is "eth_getBlockByNumber"', () => {
      it('overrides the result with null when the response from Infura is 2xx but the response text is "Not Found"', async () => {
        mockInfuraRequestsForProbeAndBlockTracker();
        mockRpcMethodCallToInfura({
          method: 'eth_getBlockByNumber',
          params: ['latest'],
        }).reply(200, 'Not Found');

        const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
          callRpcMethod({
            ethQuery,
            method: 'eth_getBlockByNumber',
            params: ['latest'],
          }),
        );

        expect(result).toBeNull();
      });
    });
  });
});

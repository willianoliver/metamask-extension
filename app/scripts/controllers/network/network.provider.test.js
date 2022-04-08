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

function mockInfuraRpcMethodCall({ network = 'mainnet', method, params = [] }) {
  const scope = buildScopeForMockingInfuraRequests({ network });
  return scope.post(`/v3/${infuraProjectId}`, {
    jsonrpc: '2.0',
    method,
    params,
  });
}

function mockInfuraArbitraryRpcMethodCall({ network = 'mainnet' } = {}) {
  return mockInfuraRpcMethodCall({ network, method: 'arbitraryRpcMethod' });
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

    // === FIRST LEVEL: MetaMask middleware

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

    describe('when the RPC method is "eth_accounts"', () => {
      it('returns whatever the given getAccounts function returns', async () => {
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
      it('delegates to the given processTransaction function, passing a normalized version of the RPC params', async () => {
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
              params: [{ from: '0xABC123', to: '0xDEF456', value: '0x12345' }],
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
      it('delegates to the given processEthSignMessage function, passing a processed version of the RPC params', async () => {
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
              params: ['0xABC123', 'this is the message', { extra: 'params' }],
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

    describe('when the RPC method is "eth_signTypedData"', () => {
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
              params: ['this is the message', '0xABC123', { extra: 'params' }],
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

    describe('when the RPC method is "eth_signTypedData_v3"', () => {
      it('delegates to the given processTypedMessageV3 function, passing a processed version of the RPC params and a version', async () => {
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

    describe('when the RPC method is "eth_signTypedData_v4"', () => {
      it('delegates to the given processTypedMessageV4 function, passing a processed version of the RPC params and a version', async () => {
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

    describe('when the RPC method is "personal_sign"', () => {
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
              params: ['this is the message', '0xABC123', { extra: 'params' }],
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

    describe('when the RPC method is "eth_getEncryptionPublicKey"', () => {
      it('delegates to the given processEncryptionPublicKey function, passing the address in the RPC params', async () => {
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

    describe('when the RPC method is "eth_decrypt"', () => {
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
              params: ['this is the message', '0xABC123', { extra: 'params' }],
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

    describe('when the RPC method is "personal_ecRecover"', () => {
      it.only("delegates to eth-sig-util's recoverPersonalSignature function, passing a processed version of the RPC params", async () => {
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

    // === SECOND LEVEL: Network middleware (Infura vs. standard)

    // --- Network and chain id middleware ---

    describe('when the RPC method is "eth_chainId"', () => {
      it('does not hit Infura, instead responding with the chain id that maps to the Infura network', async () => {
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
      it('does not hit Infura, instead responding with the chain id that maps to the Infura network, as a decimal', async () => {
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

    // --- Inflight cache middleware ---

    // [TODO]

    // --- Block ref middleware ---

    // [TODO]

    // --- Infura middleware ---

    describe('when the RPC method is anything', () => {
      it('throws a specific error message if the response from Infura is a 405', async () => {
        mockInfuraRequestsForProbeAndBlockTracker();
        mockInfuraArbitraryRpcMethodCall().reply(405);

        const promiseForResult = withConnectionToInfuraNetwork(({ ethQuery }) =>
          callArbitraryRpcMethod({ ethQuery }),
        );

        await expect(promiseForResult).rejects.toThrow(
          'The method does not exist / is not available.',
        );
      });

      it('throws a specific error message if the response from Infura is a 429', async () => {
        mockInfuraRequestsForProbeAndBlockTracker();
        mockInfuraArbitraryRpcMethodCall().reply(429);

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
          mockInfuraArbitraryRpcMethodCall().times(4).reply(503);
          mockInfuraArbitraryRpcMethodCall().reply(200, {
            jsonrpc: '2.0',
            id: 1,
            result: 'it works',
          });

          const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
            callArbitraryRpcMethod({ ethQuery }),
          );

          expect(result).toStrictEqual('it works');
        });

        it('throws an error if Infura never responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockInfuraArbitraryRpcMethodCall().times(5).reply(503);

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
          mockInfuraArbitraryRpcMethodCall(
            mockInfuraArbitraryRpcMethodCall().times(4).reply(504),
          ).reply(200, {
            jsonrpc: '2.0',
            id: 1,
            result: 'it works',
          });

          const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
            callArbitraryRpcMethod({ ethQuery }),
          );

          expect(result).toStrictEqual('it works');
        });

        it('throws an error if Infura never responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockInfuraArbitraryRpcMethodCall().times(5).reply(504);

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
          mockInfuraArbitraryRpcMethodCall()
            .times(4)
            .replyWithError('ETIMEDOUT: Some error message');
          mockInfuraArbitraryRpcMethodCall().reply(200, {
            jsonrpc: '2.0',
            id: 1,
            result: 'it works',
          });

          const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
            callArbitraryRpcMethod({ ethQuery }),
          );

          expect(result).toStrictEqual('it works');
        });

        it('throws an error if Infura never responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockInfuraArbitraryRpcMethodCall()
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
          mockInfuraArbitraryRpcMethodCall()
            .times(4)
            .replyWithError('ECONNRESET: Some error message');
          mockInfuraArbitraryRpcMethodCall().reply(200, {
            jsonrpc: '2.0',
            id: 1,
            result: 'it works',
          });

          const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
            callArbitraryRpcMethod({ ethQuery }),
          );

          expect(result).toStrictEqual('it works');
        });

        it('throws an error if the request never responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockInfuraArbitraryRpcMethodCall()
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
          mockInfuraArbitraryRpcMethodCall()
            .times(4)
            .reply('<html><p>Some error message</p></html>');
          mockInfuraArbitraryRpcMethodCall().reply(200, {
            jsonrpc: '2.0',
            id: 1,
            result: 'it works',
          });

          const result = await withConnectionToInfuraNetwork(({ ethQuery }) =>
            callArbitraryRpcMethod({ ethQuery }),
          );

          expect(result).toStrictEqual('it works');
        });

        it('throws an error if Infura never responds with 2xx', async () => {
          mockInfuraRequestsForProbeAndBlockTracker();
          mockInfuraArbitraryRpcMethodCall()
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
        mockInfuraRpcMethodCall({
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

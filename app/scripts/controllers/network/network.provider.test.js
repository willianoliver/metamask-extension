import EthQuery from 'eth-query';
import nock from 'nock';
import NetworkController from './network';

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
    console.log('checking to make sure all pending requests are satisfied');
    nock.isDone();
    nock.cleanAll();
    nock.restore();
  });

  describe('if NetworkController is configured with an Infura network', () => {
    const infuraProjectId = '591f0dce1c6d4316aad895d1716a47f7';
    const latestBlockNumber = '0x1';

    function buildScopeForMockingInfuraRequests({ network = 'mainnet' } = {}) {
      return nock(`https://${network}.infura.io`).filteringRequestBody(
        (body) => {
          const copyOfBody = JSON.parse(body);
          // some ids are random, so remove them entirely from the request to
          // make it possible to mock these requests
          delete copyOfBody.id;
          return JSON.stringify(copyOfBody);
        },
      );
    }

    function mockInfuraRequestsForProbe({ network = 'mainnet' } = {}) {
      const latestBlockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: latestBlockNumber,
      };
      return buildScopeForMockingInfuraRequests({ network })
        .post(`/v3/${infuraProjectId}`, {
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: [latestBlockNumber, false],
        })
        .reply(200, latestBlockResponse)
        .post(`/v3/${infuraProjectId}`, {
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: ['latest', false],
        })
        .reply(200, latestBlockResponse);
    }

    function mockInfuraRequestsForPollingBlockTracker({
      network = 'mainnet',
    } = {}) {
      const latestBlockResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: latestBlockNumber,
      };
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
      mockInfuraRequestsForProbe({ network });
      mockInfuraRequestsForPollingBlockTracker({ network });
      return buildScopeForMockingInfuraRequests({ network });
    }

    async function withControllerConnectedToInfuraNetwork(...args) {
      const fn = args.pop();
      const opts = args[0] ?? {};
      const network = opts.network ?? 'mainnet';
      const controller = new NetworkController();
      controller.setInfuraProjectId(infuraProjectId);
      controller.initializeProvider({
        getAccounts() {
          // do nothing for now
        },
      });
      controller.setProviderConfig({ type: network });
      let result;
      try {
        result = await fn(controller);
      } finally {
        await controller.destroy();
      }
      return result;
    }

    async function withEthQueryConnectedToInfuraNetwork(...args) {
      const fn = args.pop();
      const opts = args[0] ?? {};
      const network = opts.network ?? 'mainnet';
      return await withControllerConnectedToInfuraNetwork(
        { network },
        async (controller) => {
          const { provider } = controller.getProviderAndBlockTracker();
          return await fn(new EthQuery(provider));
        },
      );
    }

    describe('as long as a middleware that is not our Infura middleware is not intercepting the request', () => {
      function mockRpcMethodCall(scope, rpcMethod, params = []) {
        return scope.post(`/v3/${infuraProjectId}`, {
          jsonrpc: '2.0',
          method: rpcMethod,
          params,
        });
      }

      function mockArbitraryRpcMethodCall(scope) {
        return mockRpcMethodCall(scope, 'arbitraryRpcMethod');
      }

      function callRpcMethod(ethQuery, rpcMethod, params = []) {
        return new Promise((resolve, reject) => {
          ethQuery.sendAsync({ method: rpcMethod, params }, (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          });
        });
      }

      function callArbitraryRpcMethod(ethQuery) {
        return callRpcMethod(ethQuery, 'arbitraryRpcMethod');
      }

      /*
      beforeEach(() => {
        const originalSetTimeout = global.setTimeout;
        // Stub setTimeout so that request retries occur faster
        jest.spyOn(global, 'setTimeout').mockImplementation((fn, _timeout) => {
          return originalSetTimeout(fn, 100);
        });
      });
      */

      describe('when the RPC method is anything', () => {
        it('throws a specific error message if the response from Infura is a 405', async () => {
          const scope = mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCall(scope).reply(405);

          const promiseForResult = withEthQueryConnectedToInfuraNetwork(
            (ethQuery) => callArbitraryRpcMethod(ethQuery),
          );

          await expect(promiseForResult).rejects.toThrow(
            'The method does not exist / is not available.',
          );
        });

        it('throws a specific error message if the response from Infura is a 429', async () => {
          const scope = mockInfuraRequestsForProbeAndBlockTracker();
          mockArbitraryRpcMethodCall(scope).reply(429);

          const promiseForResult = withEthQueryConnectedToInfuraNetwork(
            (ethQuery) => callArbitraryRpcMethod(ethQuery),
          );

          await expect(promiseForResult).rejects.toThrow(
            'Request is being rate limited',
          );
        });

        describe('if the request to Infura responds with 503', () => {
          it('retries the request up to 5 times until Infura responds with 2xx', async () => {
            const scope = mockInfuraRequestsForProbeAndBlockTracker();
            mockArbitraryRpcMethodCall(scope).times(4).reply(503);
            mockArbitraryRpcMethodCall(scope).reply(200, {
              jsonrpc: '2.0',
              id: 1,
              result: 'it works',
            });

            const result = await withEthQueryConnectedToInfuraNetwork(
              (ethQuery) => callArbitraryRpcMethod(ethQuery),
            );

            expect(result).toStrictEqual('it works');
          });

          it('throws an error if Infura never responds with 2xx', async () => {
            const scope = mockInfuraRequestsForProbeAndBlockTracker();
            mockArbitraryRpcMethodCall(scope).times(5).reply(503);

            const promiseForResult = withEthQueryConnectedToInfuraNetwork(
              (ethQuery) => callArbitraryRpcMethod(ethQuery),
            );

            await expect(promiseForResult).rejects.toThrow(
              /^InfuraProvider - cannot complete request\. All retries exhausted\./u,
            );
          });
        });

        describe('if the request to Infura responds with 504', () => {
          it('retries the request up to 5 times until Infura responds with 2xx', async () => {
            const scope = mockInfuraRequestsForProbeAndBlockTracker();
            mockArbitraryRpcMethodCall(
              mockArbitraryRpcMethodCall(scope).times(4).reply(504),
            ).reply(200, {
              jsonrpc: '2.0',
              id: 1,
              result: 'it works',
            });

            const result = await withEthQueryConnectedToInfuraNetwork(
              (ethQuery) => callArbitraryRpcMethod(ethQuery),
            );

            expect(result).toStrictEqual('it works');
          });

          it('throws an error if Infura never responds with 2xx', async () => {
            const scope = mockInfuraRequestsForProbeAndBlockTracker();
            mockArbitraryRpcMethodCall(scope).times(5).reply(504);

            const promiseForResult = withEthQueryConnectedToInfuraNetwork(
              (ethQuery) => callArbitraryRpcMethod(ethQuery),
            );

            await expect(promiseForResult).rejects.toThrow(
              /^InfuraProvider - cannot complete request\. All retries exhausted\./u,
            );
          });
        });

        describe('if the request to Infura times out', () => {
          it('retries the request up to 5 times until Infura responds with 2xx', async () => {
            const scope = mockInfuraRequestsForProbeAndBlockTracker();
            mockArbitraryRpcMethodCall(scope)
              .times(4)
              .replyWithError('ETIMEDOUT: Some error message');
            mockArbitraryRpcMethodCall(scope).reply(200, {
              jsonrpc: '2.0',
              id: 1,
              result: 'it works',
            });

            const result = await withEthQueryConnectedToInfuraNetwork(
              (ethQuery) => callArbitraryRpcMethod(ethQuery),
            );

            expect(result).toStrictEqual('it works');
          });

          it('throws an error if Infura never responds with 2xx', async () => {
            const scope = mockInfuraRequestsForProbeAndBlockTracker();
            mockArbitraryRpcMethodCall(scope)
              .times(5)
              .replyWithError('ETIMEDOUT: Some error message');

            const promiseForResult = withEthQueryConnectedToInfuraNetwork(
              (ethQuery) => callArbitraryRpcMethod(ethQuery),
            );

            await expect(promiseForResult).rejects.toThrow(
              /^InfuraProvider - cannot complete request\. All retries exhausted\./u,
            );
          });
        });

        describe('if a "connection reset" error is thrown while making the request to Infura', () => {
          it('retries the request up to 5 times until Infura responds with 2xx', async () => {
            const scope = mockInfuraRequestsForProbeAndBlockTracker();
            mockArbitraryRpcMethodCall(scope)
              .times(4)
              .replyWithError('ECONNRESET: Some error message');
            mockArbitraryRpcMethodCall(scope).reply(200, {
              jsonrpc: '2.0',
              id: 1,
              result: 'it works',
            });

            const result = await withEthQueryConnectedToInfuraNetwork(
              (ethQuery) => callArbitraryRpcMethod(ethQuery),
            );

            expect(result).toStrictEqual('it works');
          });

          it('throws an error if the request never responds with 2xx', async () => {
            const scope = mockInfuraRequestsForProbeAndBlockTracker();
            mockArbitraryRpcMethodCall(scope)
              .times(5)
              .replyWithError('ECONNRESET: Some error message');

            const promiseForResult = withEthQueryConnectedToInfuraNetwork(
              (ethQuery) => callArbitraryRpcMethod(ethQuery),
            );

            await expect(promiseForResult).rejects.toThrow(
              /^InfuraProvider - cannot complete request\. All retries exhausted\./u,
            );
          });
        });

        describe('if the request to Infura responds with HTML or something else that is non-JSON-parseable', () => {
          it('retries the request up to 5 times until Infura returns something JSON-parseable', async () => {
            const scope = mockInfuraRequestsForProbeAndBlockTracker();
            mockArbitraryRpcMethodCall(scope)
              .times(4)
              .reply('<html><p>Some error message</p></html>');
            mockArbitraryRpcMethodCall(scope).reply(200, {
              jsonrpc: '2.0',
              id: 1,
              result: 'it works',
            });

            const result = await withEthQueryConnectedToInfuraNetwork(
              (ethQuery) => callArbitraryRpcMethod(ethQuery),
            );

            expect(result).toStrictEqual('it works');
          });

          it('throws an error if Infura never responds with 2xx', async () => {
            const scope = mockInfuraRequestsForProbeAndBlockTracker();
            mockArbitraryRpcMethodCall(scope)
              .times(5)
              .reply('<html><p>Some error message</p></html>');

            const promiseForResult = withEthQueryConnectedToInfuraNetwork(
              (ethQuery) => callArbitraryRpcMethod(ethQuery),
            );

            await expect(promiseForResult).rejects.toThrow(
              /^InfuraProvider - cannot complete request\. All retries exhausted\./u,
            );
          });
        });
      });

      describe('when the RPC method is "eth_chainId"', () => {
        it.only('does not hit Infura, instead responding with the chain id that maps to the Infura network', async () => {
          mockInfuraRequestsForProbeAndBlockTracker({ network: 'ropsten' });

          const chainId = await withEthQueryConnectedToInfuraNetwork(
            { network: 'ropsten' },
            (ethQuery) => callRpcMethod(ethQuery, 'eth_chainId'),
          );

          expect(chainId).toStrictEqual('0x3');
        });
      });

      describe('when the RPC method is "net_version"', () => {
        it('does not hit Infura, instead responding with the Infura network', async () => {
          mockInfuraRequestsForProbeAndBlockTracker({ network: 'ropsten' });

          const network = await withEthQueryConnectedToInfuraNetwork(
            { network: 'ropsten' },
            (ethQuery) => callRpcMethod(ethQuery, 'net_version'),
          );

          expect(network).toStrictEqual('ropsten');
        });
      });

      describe('when the RPC method is "eth_getBlockByNumber"', () => {
        it('overrides the result with null when the response from Infura is 2xx but the response text is "Not Found"', async () => {
          const scope = mockInfuraRequestsForProbeAndBlockTracker();
          // Question: Why does this get called twice when we only call it once?
          mockRpcMethodCall(scope, 'eth_getBlockByNumber', [
            latestBlockNumber,
          ]).reply(200, 'Not Found');
          mockRpcMethodCall(scope, 'eth_getBlockByNumber', []).reply(
            200,
            'Not Found',
          );

          const result = await withEthQueryConnectedToInfuraNetwork(
            (ethQuery) => callRpcMethod(ethQuery, 'eth_getBlockByNumber'),
          );

          expect(result).toBeNull();
        });
      });
    });
  });
});

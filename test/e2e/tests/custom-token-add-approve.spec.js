const { convertToHexValue, withFixtures } = require('../helpers');

describe('Approves a custom token from dapp and approves a custom token from dapp when no gas value is specified', function () {
  let windowHandles;
  let extension;
  let popup;
  let dapp;
  const ganacheOptions = {
    accounts: [
      {
        secretKey:
          '0x7C9529A67102755B7E6102D6D950AC5D5863C98713805CEC576B945B15B71EAC',
        balance: convertToHexValue(25000000000000000000),
      },
    ],
  };

  it('should approve tokens from test dapp', async function () {
    await withFixtures(
      {
        dapp: true,
        fixtures: 'imported-account',
        ganacheOptions,
        title: this.test.title,
      },
      async ({ driver }) => {
        await driver.navigate();
        await driver.fill('#password', 'correct horse battery staple');
        await driver.press('#password', driver.Key.ENTER);

        windowHandles = await driver.getAllWindowHandles();
        extension = windowHandles[0];
        await driver.closeAllWindowHandlesExcept([extension]);
        await driver.clickElement('.app-header__logo-container');

        // connects the dapp
        await driver.openNewPage('http://127.0.0.1:8080/');
        await driver.clickElement({ text: 'Connect', tag: 'button' });
        await driver.waitUntilXWindowHandles(3);
        windowHandles = await driver.getAllWindowHandles();
        extension = windowHandles[0];
        dapp = await driver.switchToWindowWithTitle(
          'E2E Test Dapp',
          windowHandles,
        );
        popup = windowHandles.find(
          (handle) => handle !== extension && handle !== dapp,
        );
        await driver.switchToWindow(popup);
        await driver.clickElement({ text: 'Next', tag: 'button' });
        await driver.clickElement({ text: 'Connect', tag: 'button' });
        await driver.waitUntilXWindowHandles(2);
        await driver.switchToWindow(dapp);

        // create token from test dapp
        await driver.clickElement({ text: 'Create Token', tag: 'button' });
        windowHandles = await driver.getAllWindowHandles();
        await driver.waitUntilXWindowHandles(2);
        await driver.switchToWindowWithTitle(
          'MetaMask Notification',
          windowHandles,
        );

        await driver.waitForSelector({ text: 'Confirm', tag: 'button' });
        await driver.clickElement({ text: 'Confirm', tag: 'button' });
        await driver.waitUntilXWindowHandles(2);
        await driver.switchToWindow(dapp);

        await driver.waitForSelector({
          css: '#tokenAddress',
          text: '0x',
        });

        // approve token from test dapp
        await driver.clickElement({ text: 'Approve Tokens', tag: 'button' });
        windowHandles = await driver.getAllWindowHandles();
        await driver.switchToWindowWithTitle(
          'MetaMask Notification',
          windowHandles,
        );
        await driver.waitForSelector({ text: 'Confirm', tag: 'button' });
        await driver.clickElement({ text: 'Confirm', tag: 'button' });

        // check if token is successfully approved
        windowHandles = await driver.getAllWindowHandles();
        extension = windowHandles[0];
        await driver.switchToWindow(extension);
        await driver.waitForSelector({ text: 'Activity', tag: 'button' });
        await driver.clickElement({ text: 'Activity', tag: 'button' });

        await driver.wait(async () => {
          const confirmedTxes = await driver.findElements(
            '.transaction-list__completed-transactions .transaction-list-item',
          );
          return confirmedTxes.length === 2;
        });
      },
    );
  });

  it('should approve tokens without gas from test dapp', async function () {
    await withFixtures(
      {
        dapp: true,
        fixtures: 'imported-account',
        ganacheOptions,
        title: this.test.title,
      },
      async ({ driver }) => {
        await driver.navigate();
        await driver.fill('#password', 'correct horse battery staple');
        await driver.press('#password', driver.Key.ENTER);

        windowHandles = await driver.getAllWindowHandles();
        extension = windowHandles[0];
        await driver.closeAllWindowHandlesExcept([extension]);
        await driver.clickElement('.app-header__logo-container');

        // connects the dapp
        await driver.openNewPage('http://127.0.0.1:8080/');
        await driver.clickElement({ text: 'Connect', tag: 'button' });
        await driver.waitUntilXWindowHandles(3);
        windowHandles = await driver.getAllWindowHandles();
        extension = windowHandles[0];
        dapp = await driver.switchToWindowWithTitle(
          'E2E Test Dapp',
          windowHandles,
        );
        popup = windowHandles.find(
          (handle) => handle !== extension && handle !== dapp,
        );
        await driver.switchToWindow(popup);
        await driver.clickElement({ text: 'Next', tag: 'button' });
        await driver.clickElement({ text: 'Connect', tag: 'button' });
        await driver.waitUntilXWindowHandles(2);
        await driver.switchToWindow(dapp);

        // create token from test dapp
        await driver.clickElement({ text: 'Create Token', tag: 'button' });
        windowHandles = await driver.getAllWindowHandles();
        await driver.waitUntilXWindowHandles(2);
        await driver.switchToWindowWithTitle(
          'MetaMask Notification',
          windowHandles,
        );

        await driver.waitForSelector({ text: 'Confirm', tag: 'button' });
        await driver.clickElement({ text: 'Confirm', tag: 'button' });
        await driver.waitUntilXWindowHandles(2);
        await driver.switchToWindow(dapp);

        await driver.waitForSelector({
          css: '#tokenAddress',
          text: '0x',
        });

        // approve token without gas from test dapp
        await driver.clickElement({
          text: 'Approve Tokens Without Gas',
          tag: 'button',
        });
        windowHandles = await driver.getAllWindowHandles();
        await driver.switchToWindowWithTitle(
          'MetaMask Notification',
          windowHandles,
        );
        await driver.waitForSelector({ text: 'Confirm', tag: 'button' });
        await driver.clickElement({ text: 'Confirm', tag: 'button' });

        // check if token is successfully approved
        windowHandles = await driver.getAllWindowHandles();
        extension = windowHandles[0];
        await driver.switchToWindow(extension);
        await driver.waitForSelector({ text: 'Activity', tag: 'button' });
        await driver.clickElement({ text: 'Activity', tag: 'button' });
        await driver.wait(async () => {
          const confirmedTxes = await driver.findElements(
            '.transaction-list__completed-transactions .transaction-list-item',
          );
          return confirmedTxes.length === 2;
        });
      },
    );
  });
});

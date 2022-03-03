const { strict: assert } = require('assert');

const { convertToHexValue, withFixtures } = require('../helpers');

describe('Add a custom token from a dapp', function () {
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
  it('connects the dapp', async function () {
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

          //connects the dapp
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

  });
});

  it('creates a new token', async function () {
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

          //connects the dapp
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
    await driver.waitForSelector({ text: 'Create Token', tag: 'button' });
    await driver.clickElement({ text: 'Create Token', tag: 'button' });
    windowHandles = await driver.waitUntilXWindowHandles(3);

    popup = windowHandles[2];
    await driver.switchToWindow(popup);
    
    await driver.clickElement({ text: 'Edit', tag: 'button' });

    const inputs = await driver.findElements('input[type="number"]');
    const gasLimitInput = inputs[0];
    const gasPriceInput = inputs[1];
    await gasLimitInput.fill('4700000');
    await gasPriceInput.fill('20');
    await driver.waitForSelector({ text: 'Save', tag: 'button' });
    await driver.clickElement({ text: 'Save', tag: 'button' });
    await driver.clickElement({ text: 'Confirm', tag: 'button' });

    await driver.switchToWindow(dapp);

    const tokenContractAddress = await driver.waitForSelector({
      css: '#tokenAddress',
      text: '0x',
    });
    const tokenAddress = await tokenContractAddress.getText();
  });
  });

  it('clicks on the import tokens button', async function () {
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

    await driver.clickElement(`[data-testid="home__asset-tab"]`);
    await driver.clickElement({ text: 'import tokens', tag: 'a' });
   
  });
});

  it('picks the newly created Test token', async function () {
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

          await driver.clickElement(`[data-testid="home__asset-tab"]`);
    await driver.clickElement({ text: 'import tokens', tag: 'a' });
    await driver.clickElement({
      text: 'Custom Token',
      tag: 'button',
    });
    
    await driver.waitForSelector('#custom-address');
    await driver.fill('#custom-address', tokenAddress);
    await driver.fill('#custom-symbol', 'TST');

    await driver.clickElement({ text: 'Add Custom Token', tag: 'button' });
    await driver.clickElement({ text: 'Import Tokens', tag: 'button' });
  });
});

  it('renders the balance for the new token', async function () {
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

          await driver.clickElement(`[data-testid="home__asset-tab"]`);
    await driver.clickElement({ text: 'import tokens', tag: 'a' });
    await driver.clickElement({
      text: 'Custom Token',
      tag: 'button',
    });
    
    await driver.waitForSelector('#custom-address');
    await driver.fill('#custom-address', tokenAddress);
    await driver.fill('#custom-symbol', 'TST');


    await driver.clickElement({ text: 'Add Custom Token', tag: 'button' });
    await driver.clickElement({ text: 'Import Tokens', tag: 'button' });

    await driver.waitForSelector('.app-header__logo-container');
    await driver.clickElement('.app-header__logo-container');
    const asset = await driver.waitForSelector({
      css: '.asset-list-item__token-value',
      text: '0',
    });

    assert.equal(await asset.getText(), '0');
   
  });
});
});

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
      },
    );
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
        // create token
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

        await driver.waitForSelector({
          css: '#tokenAddress',
          text: '0x',
        });
      },
    );
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

        // imports token from extension
        await driver.clickElement(`[data-testid="home__asset-tab"]`);
        await driver.clickElement({ text: 'import tokens', tag: 'a' });
      },
    );
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
        // create token
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

        // imports custom token from extension
        await driver.switchToWindow(extension);
        await driver.clickElement(`[data-testid="home__asset-tab"]`);
        await driver.clickElement({ text: 'import tokens', tag: 'a' });
        await driver.clickElement({
          text: 'Custom Token',
          tag: 'button',
        });
        await driver.waitForSelector('#custom-address');
        await driver.fill('#custom-address', tokenAddress);
        await driver.clickElement({ text: 'Add Custom Token', tag: 'button' });
        await driver.clickElement({ text: 'Import Tokens', tag: 'button' });
      },
    );
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
        // create token
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

        // imports custom token from extension
        await driver.switchToWindow(extension);
        await driver.clickElement(`[data-testid="home__asset-tab"]`);
        await driver.clickElement({ text: 'import tokens', tag: 'a' });
        await driver.clickElement({
          text: 'Custom Token',
          tag: 'button',
        });

        await driver.waitForSelector('#custom-address');
        await driver.fill('#custom-address', tokenAddress);
        await driver.clickElement({ text: 'Add Custom Token', tag: 'button' });
        await driver.clickElement({ text: 'Import Tokens', tag: 'button' });

        await driver.waitForSelector('.app-header__logo-container');
        await driver.clickElement('.app-header__logo-container');
        await driver.clickElement({ tag: 'button', text: 'Assets' });
        const asset = await driver.waitForSelector({
          css: '.asset-list-item__token-value',
          text: '10',
        });
        assert.equal(await asset.getText(), '10');
      },
    );
  });
});

describe('Approves a custom token from dapp', function () {
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
  it('approves an already created token', async function () {
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

        await driver.waitForSelector({ text: 'Create Token', tag: 'button' });
        await driver.clickElement({ text: 'Create Token', tag: 'button' });
        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];
        await driver.switchToWindow(popup);
        await driver.clickElement({ text: 'Confirm', tag: 'button' });

        await driver.switchToWindow(dapp);

        await driver.waitForSelector({ text: 'Approve Tokens', tag: 'button' });
        await driver.clickElement({ text: 'Approve Tokens', tag: 'button' });

        await driver.switchToWindow(extension);

        await driver.clickElement({ tag: 'button', text: 'Activity' });

        await driver.wait(async () => {
          const pendingTxes = await driver.findElements(
            '.transaction-list-item',
          );
          return pendingTxes.length === 2;
        }, 10000);

        await driver.waitForSelector({
          // Selects only the very first transaction list item immediately following the 'Pending' header
          css:
            '.transaction-list__pending-transactions .transaction-list__header + .transaction-list-item .list-item__heading',
          text: 'Approve Token spend limit',
        });
      },
    );
  });

  it('displays the token approval data', async function () {
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

        await driver.waitForSelector({ text: 'Create Token', tag: 'button' });
        await driver.clickElement({ text: 'Create Token', tag: 'button' });
        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];
        await driver.switchToWindow(popup);
        await driver.clickElement({ text: 'Confirm', tag: 'button' });

        await driver.switchToWindow(dapp);

        await driver.waitForSelector({ text: 'Approve Tokens', tag: 'button' });
        await driver.clickElement({ text: 'Approve Tokens', tag: 'button' });

        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];

        // switch to popup
        await driver.switchToWindow(popup);
        await driver.waitForSelector(
          '.confirm-approve-content__view-full-tx-button',
        );
        await driver.clickElement(
          '.confirm-approve-content__view-full-tx-button',
        );
        // checks view full transaction details
        const functionType = await driver.findElement(
          '.confirm-approve-content__data .confirm-approve-content__small-text',
        );
        await driver.scrollToElement(functionType);
        const functionTypeText = await functionType.getText();
        assert.equal(functionTypeText, 'Function: Approve');
        const confirmDataDiv = await driver.findElement(
          '.confirm-approve-content__data__data-block',
        );
        const confirmDataText = await confirmDataDiv.getText();
        assert(
          confirmDataText.match(
            /0x095ea7b30000000000000000000000009bc5baf874d2da8d216ae9f137804184ee5afef4/u,
          ),
        );
      },
    );
  });

  it('customizes gas', async function () {
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

        await driver.waitForSelector({ text: 'Create Token', tag: 'button' });
        await driver.clickElement({ text: 'Create Token', tag: 'button' });
        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];
        await driver.switchToWindow(popup);
        await driver.clickElement({ text: 'Confirm', tag: 'button' });

        await driver.switchToWindow(dapp);

        await driver.waitForSelector({ text: 'Approve Tokens', tag: 'button' });
        await driver.clickElement({ text: 'Approve Tokens', tag: 'button' });

        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];

        // switch to popup
        await driver.switchToWindow(popup);
        await driver.clickElement('.confirm-approve-content__small-blue-text');
        await driver.clickElement(
          { text: 'Edit suggested gas fee', tag: 'button' },
          10000,
        );
        const [gasLimitInput, gasPriceInput] = await driver.findElements(
          'input[type="number"]',
        );
        await gasPriceInput.fill('10');
        await gasLimitInput.fill('60001');
        await driver.clickElement({ text: 'Save', tag: 'button' });
        const gasFeeInEth = await driver.findElement(
          '.confirm-approve-content__transaction-details-content__secondary-fee',
        );
        assert.equal(await gasFeeInEth.getText(), '0.0006 ETH');
      },
    );
  });

  it('edits the permission', async function () {
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

        await driver.waitForSelector({ text: 'Create Token', tag: 'button' });
        await driver.clickElement({ text: 'Create Token', tag: 'button' });
        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];
        await driver.switchToWindow(popup);
        await driver.clickElement({ text: 'Confirm', tag: 'button' });

        await driver.switchToWindow(dapp);

        await driver.waitForSelector({ text: 'Approve Tokens', tag: 'button' });
        await driver.clickElement({ text: 'Approve Tokens', tag: 'button' });

        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];

        // switch to popup
        await driver.switchToWindow(popup);
        await driver.clickElement({
          css: '.confirm-approve-content__small-blue-text',
          text: 'View full transaction details',
        });
        const editButtons = await driver.findClickableElements(
          '.confirm-approve-content__small-blue-text',
        );
        await editButtons[2].click();

        // wait for permission modal to be visible
        const permissionModal = await driver.findVisibleElement('span .modal');
        const radioButtons = await driver.findClickableElements(
          '.edit-approval-permission__edit-section__radio-button',
        );
        await radioButtons[1].click();
        await driver.fill('input', '5');
        await driver.clickElement({ text: 'Save', tag: 'button' });

        // wait for permission modal to be removed from DOM.
        await permissionModal.waitForElementState('hidden');
        const permissionInfo = await driver.findElements(
          '.confirm-approve-content__medium-text',
        );
        const amountDiv = permissionInfo[0];
        assert.equal(await amountDiv.getText(), '5 TST');
      },
    );
  });

  it('submits the transaction', async function () {
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

        await driver.waitForSelector({ text: 'Create Token', tag: 'button' });
        await driver.clickElement({ text: 'Create Token', tag: 'button' });
        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];
        await driver.switchToWindow(popup);
        await driver.clickElement({ text: 'Confirm', tag: 'button' });

        await driver.switchToWindow(dapp);

        await driver.waitForSelector({ text: 'Approve Tokens', tag: 'button' });
        await driver.clickElement({ text: 'Approve Tokens', tag: 'button' });

        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];

        // switch to popup
        await driver.switchToWindow(popup);
        await driver.clickElement({
          css: '.confirm-approve-content__small-blue-text',
          text: 'View full transaction details',
        });
        const editButtons = await driver.findClickableElements(
          '.confirm-approve-content__small-blue-text',
        );
        await editButtons[2].click();

        // wait for permission modal to be visible
        await driver.findVisibleElement('span .modal');
        const radioButtons = await driver.findClickableElements(
          '.edit-approval-permission__edit-section__radio-button',
        );
        await radioButtons[1].click();
        await driver.fill('input', '5');
        await driver.clickElement({ text: 'Save', tag: 'button' });

        await driver.clickElement({ text: 'Confirm', tag: 'button' });
      },
    );
  });

  it('finds the transaction in the transactions list', async function () {
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

        await driver.waitForSelector({ text: 'Create Token', tag: 'button' });
        await driver.clickElement({ text: 'Create Token', tag: 'button' });
        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];
        await driver.switchToWindow(popup);
        await driver.clickElement({ text: 'Confirm', tag: 'button' });

        await driver.switchToWindow(dapp);

        await driver.waitForSelector({ text: 'Approve Tokens', tag: 'button' });
        await driver.clickElement({ text: 'Approve Tokens', tag: 'button' });

        windowHandles = await driver.waitUntilXWindowHandles(3);
        popup = windowHandles[2];

        // switch to popup
        await driver.switchToWindow(popup);
        await driver.clickElement({
          css: '.confirm-approve-content__small-blue-text',
          text: 'View full transaction details',
        });
        const editButtons = await driver.findClickableElements(
          '.confirm-approve-content__small-blue-text',
        );
        await editButtons[2].click();

        // wait for permission modal to be visible
        await driver.findVisibleElement('span .modal');
        const radioButtons = await driver.findClickableElements(
          '.edit-approval-permission__edit-section__radio-button',
        );
        await radioButtons[1].click();
        await driver.fill('input', '5');
        await driver.clickElement({ text: 'Save', tag: 'button' });

        await driver.clickElement({ text: 'Confirm', tag: 'button' });

        await driver.switchToWindow(extension);
        await driver.clickElement({ tag: 'button', text: 'Activity' });
        await driver.waitForSelector({
          // Select only the heading of the first entry in the transaction list.
          css:
            '.transaction-list__completed-transactions .transaction-list-item:first-child .list-item__heading',
          text: 'Approve TST spend limit',
        });
      },
    );
  });
});

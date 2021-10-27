import { config as envConfig } from "dotenv";
import { writeFile } from "fs/promises";
import path from "path";
import pptr, { Browser, Page } from "puppeteer";
import constants from "./constants";
import type {
  Config,
  PptrElement,
  State,
  Transaction,
  TransactionData,
} from "./hdfc.interface";
import { amountToDecimal, getJson, hash, innerText, wait } from "./utils";

envConfig({ path: path.resolve(__dirname, "../.env") });

/** Setup */
let state: State;
let config: Config;

const setup = async () => {
  state = await getJson<State>("state.json", {});
  config = await getJson<Config>("config.json");
  if (!config) {
    console.error("Config file not present, please create a config.json");
    process.exit();
  }
};

/** Constants */
const HDFC_NETBANKING_URL = "https://netbanking.hdfcbank.com/netbanking/";

const selectors = {
  login: {
    FRAME: "frame",
    CUSTOMER_ID_INPUT: 'input[name="fldLoginUserId"]',
    PASSWORD_INPUT: 'input[name="fldPassword"]',
    CONTINUE_BUTTON: "a.login-btn",
    LOGIN_BUTTON: "a.login-btn",
    SECURE_ACCESS_CHECKBOX: 'input[name="chkrsastu"]',
  },
  logout: {
    FRAME: 'frame[name="common_menu1"]',
    LOGOUT_BUTTON: 'img[alt="Log Out"]',
  },
  statement: {
    LEFT_MENU_FRAME: 'frame[name="left_menu"]',
    ACCT_SUMMARY_BTN: "li.menu-summary.active a",
    MAIN_PART_FRAME: 'frame[name="main_part"]',
    VIEW_STATEMENT_BUTTON: "a.viewbtngrey",
    WAIT_FOR_CHECK: 'form[name="frmTxn"]',
    SAVINGS_ACCT_TABLE_HEADER: "td.PSMSubHeader",
  },
};

async function login(page: Page, retriesLeft: number = 3): Promise<boolean> {
  if (!retriesLeft) return false;
  console.log("Logging in...", `[${4 - retriesLeft} / 3]`);
  try {
    await page.goto(HDFC_NETBANKING_URL, { waitUntil: "networkidle2" });
    const frameElement = await page.waitForSelector(selectors.login.FRAME);
    const frame = await frameElement.contentFrame();
    await frame.type(selectors.login.CUSTOMER_ID_INPUT, config.customerId);
    await frame.click(selectors.login.CONTINUE_BUTTON);
    await frame.waitForSelector(selectors.login.PASSWORD_INPUT);
    await frame.type(selectors.login.PASSWORD_INPUT, config.password);
    if (config.secureAccess)
      await frame.click(selectors.login.SECURE_ACCESS_CHECKBOX);
    await frame.click(selectors.login.LOGIN_BUTTON);
    await page.waitForNavigation({ waitUntil: "networkidle2" });
    return true;
  } catch (err) {
    await wait(1000);
    return await login(page, --retriesLeft);
  }
}

async function logout(page: Page): Promise<void> {
  console.log("\nLogging out...");
  try {
    const frameElement = await page.waitForSelector(selectors.logout.FRAME);
    const frame = await frameElement.contentFrame();
    await frame.click(selectors.logout.LOGOUT_BUTTON);
    await page.waitForNavigation({ waitUntil: "networkidle2" });
  } catch (err) {
    await wait(1000);
    logout(page);
  }
}

async function openStatement(
  page: Page,
  retriesLeft: number,
  index: number
): Promise<PptrElement> {
  if (!retriesLeft) return undefined;
  console.log("Opening statement...", `[${4 - retriesLeft} / 3]`);
  try {
    const mainPartFrameElement = await page.waitForSelector(
      selectors.statement.MAIN_PART_FRAME
    );
    const mainPartFrame = await mainPartFrameElement.contentFrame();
    await mainPartFrame.click(selectors.statement.SAVINGS_ACCT_TABLE_HEADER);
    const viewStatementBtn = (
      await mainPartFrame.$$(selectors.statement.VIEW_STATEMENT_BUTTON)
    )[index];
    await viewStatementBtn.click();
    const form = await mainPartFrame.waitForSelector(
      selectors.statement.WAIT_FOR_CHECK
    );
    return form;
  } catch (err) {
    await wait(1000);
    return openStatement(page, --retriesLeft, index);
  }
}

async function getBalance(balanceTable: PptrElement): Promise<number> {
  const balanceElement = await balanceTable.$("b");
  const balanceText = await innerText(balanceElement);
  const balance = Number(amountToDecimal(balanceText.slice(4)));
  return balance;
}

async function getTransactionsFromTable(transactionsTable: PptrElement) {
  const transactions: Transaction[] = [];
  const rows = (await transactionsTable.$$("tr")).slice(1);
  for (const row of rows) {
    const cells = await Promise.all((await row.$$("td")).map(innerText));
    const now = new Date();
    const date = new Date(cells[0]);
    transactions.push({
      id: cells[2],
      description: cells[1],
      date: now.toDateString() === date.toDateString() ? now : date,
      valueDate: new Date(cells[3]),
      withdrawal: amountToDecimal(cells[4]),
      deposit: amountToDecimal(cells[5]),
      closingBalance: amountToDecimal(cells[6]),
    });
  }
  return transactions;
}

async function parseStatement(form: PptrElement) {
  console.log("Parsing statement...");
  const tables = await form.$$("table");
  const balance = await getBalance(tables[1]);
  const transactions = await getTransactionsFromTable(tables[2]);
  return { balance, transactions };
}

async function launchBrowserAndLogin(): Promise<
  Partial<{
    browser: Browser;
    page: Page;
  }>
> {
  console.log("Launching browser...");
  const browser = await pptr.launch({
    headless: config.headless,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 720 });
  if (!(await login(page))) return {};
  return { browser, page };
}

async function logoutAndCloseBrowser(browser: Browser, page: Page) {
  await logout(page);
  console.log("Closing browser...");
  await page.close();
  await browser.close();
}

async function goBackToAccountSummary(
  page: Page,
  retriesLeft = 3
): Promise<void> {
  if (!retriesLeft) return;
  console.log("Going back to accounts page...", `[${4 - retriesLeft} / 3]`);
  try {
    const leftMenuFrameElement = await page.waitForSelector(
      selectors.statement.LEFT_MENU_FRAME
    );
    const leftMenuFrame = await leftMenuFrameElement.contentFrame();
    const accountSummaryBtn = await leftMenuFrame.$(
      selectors.statement.ACCT_SUMMARY_BTN
    );
    await accountSummaryBtn.click();
  } catch (err) {
    return goBackToAccountSummary(page, --retriesLeft);
  }
}

async function getLatestStatement(
  page: Page,
  index: number
): Promise<Partial<{ balance: number; transactions: Transaction[] }>> {
  const statementForm = await openStatement(page, 3, index);
  if (!statementForm) return {};
  const statement = await parseStatement(statementForm);
  await goBackToAccountSummary(page);
  return statement;
}

export async function getTransactions(): Promise<TransactionData[]> {
  const allTransactions: TransactionData[] = [];

  await setup();
  const { browser, page } = await launchBrowserAndLogin();
  if (!browser || !page) {
    console.log("An error while logging in, try again later or fix the code!");
    return process.exit();
  }
  for (let index = 0; index < config.accounts.length; index++) {
    const account = config.accounts[index];
    console.log("\nRunning on", account);
    console.log("Getting the latest statement...");
    const { balance, transactions } = await getLatestStatement(page, index);
    if (!balance || !transactions) {
      console.log("An error occured somehow, try again later or fix the code!");
      return process.exit();
    }
    console.log("Received statement!");
    const pendingTransactions: Transaction[] = [];
    const lastTransactionHash = state[account];
    if (lastTransactionHash) {
      for (const transaction of transactions) {
        if (lastTransactionHash !== hash(transaction)) {
          pendingTransactions.push(transaction);
        } else break;
      }
    }
    !pendingTransactions.length && console.log("No new transaction");
    allTransactions.push(
      ...pendingTransactions.reverse().map((transaction) => ({
        transaction,
        accountName: account,
        accountId: constants.accountsMap[account],
      }))
    );
    console.log("Updating state file...");
    state[account] = hash(transactions[0]);
    await writeFile(
      path.resolve(__dirname, "../state.json"),
      JSON.stringify(state)
    );
    console.log("Everything done! Cheers :)");
  }
  await logoutAndCloseBrowser(browser, page);

  return allTransactions;
}

import { mkdir, open, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));
const walletFiles = {
  primary: 'testnet-wallet.json',
  recipient: 'plasma-recipient.json',
};
export const walletPath = join(projectDir, '.secrets', walletFiles.primary);

export function getWalletPath(role = 'primary') {
  const file = walletFiles[role];
  if (!file) throw new Error(`Unknown wallet role: ${role}`);
  return join(projectDir, '.secrets', file);
}

export async function readWallet(role = 'primary') {
  const wallet = JSON.parse(await readFile(getWalletPath(role), 'utf8'));
  const address = privateKeyToAccount(wallet.privateKey).address;
  if (address.toLowerCase() !== wallet.address?.toLowerCase()) {
    throw new Error('Wallet file address does not match its private key');
  }
  return { ...wallet, address };
}

export async function createWallet(role = 'primary') {
  const targetPath = getWalletPath(role);
  await mkdir(dirname(targetPath), { recursive: true, mode: 0o700 });
  try {
    return { wallet: await readWallet(role), created: false };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const privateKey = generatePrivateKey();
  const address = privateKeyToAccount(privateKey).address;
  const wallet = { address, privateKey };
  const file = await open(targetPath, 'wx', 0o600);
  try {
    await file.writeFile(`${JSON.stringify(wallet, null, 2)}\n`);
  } finally {
    await file.close();
  }
  return { wallet, created: true };
}

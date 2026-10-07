import { Client } from '@taceo/merces2-client';
import { createPublicClient, createWalletClient, formatUnits, http, parseUnits } from 'viem';
import { plasmaTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { readWallet } from './wallet-store.mjs';

// Node 22's built-in fetch does not automatically honor HTTPS_PROXY.
const proxyUrl = process.env.https_proxy ?? process.env.HTTPS_PROXY;
if (proxyUrl) setGlobalDispatcher(new ProxyAgent(proxyUrl));

const action = process.argv[2] ?? 'status';
const role = process.argv.includes('--recipient') ? 'recipient' : 'primary';
const { privateKey, address } = await readWallet(role);
const account = privateKeyToAccount(privateKey);
const rpcUrl = 'https://testnet-rpc.plasma.to';
const publicClient = createPublicClient({ chain: plasmaTestnet, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: plasmaTestnet, transport: http(rpcUrl) });
const client = new Client({
  idRegistryUrl: 'https://id-registry.merces2.taceo.io',
  gatewayUrl: 'wss://gateway.merces2.taceo.io',
  nodeUrls: [
    'https://node0.merces2.taceo.io',
    'https://node1.merces2.taceo.io',
    'https://node2.merces2.taceo.io',
  ],
  contractAddress: '0xce9dBeD2958Cbe4d79415254bDFCC384C89C8E8e',
  tokenAddress: '0xbd81d64eb5a409cf1d1d2f175897cf102b56ffbe',
  vaultAddress: '0x3D2B3bC89c8D07Bb46C755bd8fde7D4271cf40d7',
  token: 'EIP3009',
  walletClient,
  publicClient,
  gatewayTimeout: 120_000,
  mpcEventTimeout: 120_000,
});

console.log(`Role: ${role}`);
console.log(`Wallet: ${address}`);
const decimals = await client.getDecimals();

if (action === 'status') {
  const publicBalance = await client.getErc20Balance();
  const privateBalance = await client.getPrivateBalance().catch((error) => {
    if (error.name === 'NotFoundError') return null;
    throw error;
  });
  console.log(`Public test USDT0: ${formatUnits(publicBalance, decimals)}`);
  console.log(`Private test USDT0: ${privateBalance === null ? 'not registered' : formatUnits(privateBalance, decimals)}`);
} else if (action === 'register') {
  const index = await client.register();
  console.log(`Registered index: ${index}`);
} else if (action === 'deposit') {
  if (role !== 'primary') throw new Error('Only the primary wallet deposits in this demo');
  const amount = parseUnits(process.argv[3] ?? '1', decimals);
  if (amount <= 0n || amount > parseUnits('1', decimals)) throw new Error('Deposit must be above 0 and at most 1 test USDT0');
  const hash = await client.privateDeposit(amount);
  console.log(`Private deposit confirmed: ${hash}`);
} else if (action === 'transfer') {
  if (role !== 'primary') throw new Error('Only the primary wallet transfers in this demo');
  const recipient = (await readWallet('recipient')).address;
  const amount = parseUnits(process.argv[3] ?? '0.4', decimals);
  if (amount <= 0n || amount > parseUnits('0.4', decimals)) throw new Error('Transfer must be above 0 and at most 0.4 test USDT0');
  const hash = await client.privateTransfer(recipient, amount);
  console.log(`Private transfer confirmed: ${hash}`);
} else if (action === 'withdraw') {
  if (role !== 'recipient') throw new Error('Only the recipient wallet withdraws in this demo');
  const amount = parseUnits(process.argv[3] ?? '0.2', decimals);
  if (amount <= 0n || amount > parseUnits('0.2', decimals)) throw new Error('Withdraw must be above 0 and at most 0.2 test USDT0');
  const hash = await client.privateWithdraw(amount);
  console.log(`Private withdraw confirmed: ${hash}`);
} else {
  throw new Error(`Unknown Plasma action: ${action}`);
}

// Proof generation may leave worker handles open after the confirmed result.
if (['deposit', 'transfer', 'withdraw'].includes(action)) process.exit(0);

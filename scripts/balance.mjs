import { Client } from '@taceo/merces1-client';
import { baseSepolia } from 'viem/chains';
import { createPublicClient, createWalletClient, formatUnits, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readWallet } from './wallet-store.mjs';

const { privateKey, address } = await readWallet();
const account = privateKeyToAccount(privateKey);
const rpcUrl = 'https://sepolia.base.org';
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });
const client = new Client({
  nodeUrls: [
    'https://node0.merces1.taceo.io',
    'https://node1.merces1.taceo.io',
    'https://node2.merces1.taceo.io',
  ],
  contractAddress: '0x2A07183Ec9cFFCED639C9Cb33BE106FD81d59E16',
  token: { type: 'ERC20', address: '0x4Ee80fFA1332525A8Cd100E1edf72Fe066f01c10' },
  walletClient,
  publicClient,
});

const [balance, decimals] = await Promise.all([
  client.getPrivateBalance(),
  client.getDecimals(),
]);
console.log(`Wallet: ${address}`);
console.log(`Private test balance: ${formatUnits(balance, decimals)} USDC`);

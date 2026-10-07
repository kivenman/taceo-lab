import { createWallet, getWalletPath } from './wallet-store.mjs';

const role = process.argv[2] ?? 'primary';
const { wallet, created } = await createWallet(role);
console.log(`${created ? 'Created' : 'Using existing'} TACEO testnet wallet`);
console.log(`Address: ${wallet.address}`);
console.log(`Secret file: ${getWalletPath(role)}`);

import { readWallet } from './wallet-store.mjs';

const { address } = await readWallet();
const response = await fetch(`https://faucet.merces1.taceo.io/claim/${address}`, {
  method: 'POST',
  signal: AbortSignal.timeout(30_000),
});
const body = await response.text();
console.log(`Faucet HTTP status: ${response.status}`);
console.log(`Wallet: ${address}`);
const txHash = body.match(/0x[a-fA-F0-9]{64}/)?.[0];
if (txHash) console.log(`Transaction: ${txHash}`);
if (!response.ok) {
  console.error(`Faucet response: ${body.slice(0, 500)}`);
  process.exitCode = 1;
}

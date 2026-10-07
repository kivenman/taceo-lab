import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { ConfidentialEvmScheme } from '@taceo/confidential-x402/client';
import { privateKeyToAccount } from 'viem/accounts';
import { readWallet } from './wallet-store.mjs';

const url = 'https://x402-server.merces1.taceo.io/api/protected';
const network = 'eip155:84532';
const asset = '0x4Ee80fFA1332525A8Cd100E1edf72Fe066f01c10';
const contract = '0x2A07183Ec9cFFCED639C9Cb33BE106FD81d59E16';
const maximumAmount = 1_000_000n; // 1 test USDC (6 decimals)

function isAllowedPayment(option) {
  return option.scheme === 'confidential' &&
    option.network === network &&
    option.asset?.toLowerCase() === asset.toLowerCase() &&
    option.extra?.confidentialToken?.toLowerCase() === contract.toLowerCase() &&
    BigInt(option.amount) > 0n &&
    BigInt(option.amount) <= maximumAmount;
}

const preflight = await fetch(url, { signal: AbortSignal.timeout(30_000) });
if (preflight.status !== 402) {
  throw new Error(`Expected HTTP 402 before payment, received ${preflight.status}`);
}
const paymentHeader = preflight.headers.get('payment-required');
if (!paymentHeader) throw new Error('The server did not provide PAYMENT-REQUIRED');
const requirements = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'));
const allowed = requirements.accepts?.find(isAllowedPayment);
if (!allowed) throw new Error('Payment terms differ from the expected Base Sepolia test payment');

const { privateKey, address } = await readWallet();
const client = new x402Client();
client.register(network, new ConfidentialEvmScheme(privateKeyToAccount(privateKey)));
client.setSpendControls({
  allowedAssets: [{ network, asset, maxAmountPerPayment: maximumAmount.toString() }],
});
client.registerPolicy((_version, options) => options.filter(isAllowedPayment));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
console.log(`Wallet: ${address}`);
console.log(`Approved amount: ${allowed.amount} base units of test USDC`);
if (process.argv.includes('--dry-run')) {
  console.log('Payment terms checked; no payment sent.');
  process.exit(0);
}
const response = await fetchWithPayment(url, {
  method: 'GET',
  signal: AbortSignal.timeout(120_000),
});
const body = await response.text();
console.log(`Protected resource HTTP status: ${response.status}`);
console.log(`Response: ${body.slice(0, 500)}`);
// The x402 SDK may leave polling handles open after the HTTP request completes.
process.exit(response.ok ? 0 : 1);

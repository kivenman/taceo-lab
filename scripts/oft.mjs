import { Client, erc20Abi, getIndexByAddress } from '@taceo/merces-oft-client';
import { createPublicClient, createWalletClient, formatEther, formatUnits, http, parseUnits } from 'viem';
import { baseSepolia, monadTestnet, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { readWallet } from './wallet-store.mjs';

const proxyUrl = process.env.https_proxy ?? process.env.HTTPS_PROXY;
if (proxyUrl) setGlobalDispatcher(new ProxyAgent(proxyUrl));

const networks = {
  monad: {
    chain: monadTestnet,
    rpc: 'https://testnet-rpc.monad.xyz',
    registry: '0x3cae9f1934b9079212531673cafc070a2e44bdc8',
    merces: '0x654d4c73473e060a1de5888fab34bcb41af073cf',
    token: '0xb1ed36367611392c04d14f80812d86749dc02d9c',
    gateway: 'wss://chain-a-gateway.merces-oft.taceo.io',
    kind: 'adapter',
  },
  sepolia: {
    chain: sepolia,
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    registry: '0x0643ed2c7d94ef1aeedf0b14c9c0905ceaa4ebec',
    merces: '0xa6f5ac12e0996b96a8e748e48040386d852a3c11',
    gateway: 'wss://chain-b-gateway.merces-oft.taceo.io',
    kind: 'oft',
  },
  base: {
    chain: baseSepolia,
    rpc: 'https://sepolia.base.org',
    registry: '0x3824113dbe2f267d791467f6e05530694d66580a',
    merces: '0x1440bbc50a658456ba81019d71dcead4019e34e3',
    gateway: 'wss://chain-c-gateway.merces-oft.taceo.io',
    kind: 'oft',
  },
};

const action = process.argv[2] ?? 'status';
const sourceName = process.argv[3] ?? 'monad';
const source = networks[sourceName];
if (!source) throw new Error('Network must be monad, sepolia, or base');
const { privateKey, address } = await readWallet('primary');
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain: source.chain, transport: http(source.rpc) });
const walletClient = createWalletClient({ account, chain: source.chain, transport: http(source.rpc) });
const tokenAddress = source.token ?? source.merces;
const [nativeBalance, publicBalance, decimals, registryIndex] = await Promise.all([
  publicClient.getBalance({ address }),
  publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
  publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: 'decimals' }),
  getIndexByAddress(publicClient, source.registry, address),
]);

console.log(`Network: ${source.chain.name} (${source.chain.id})`);
console.log(`Wallet: ${address}`);
console.log(`Native gas: ${formatEther(nativeBalance)}`);
console.log(`Public demo token: ${formatUnits(publicBalance, decimals)}`);
console.log(`Registry index: ${registryIndex ?? 'not registered'}`);

if (action === 'status') {
  if (registryIndex !== null && process.argv.includes('--private')) {
    const client = await makeClient();
    const note = await client.myCurrentNote();
    console.log(`Private demo token: ${formatUnits(note?.balance ?? 0n, decimals)}`);
  }
} else if (action === 'register') {
  if (registryIndex !== null) {
    console.log('Already registered');
  } else {
    requireGas();
    const client = await makeClient();
    console.log(`Registered index: ${client.registryIndex()}`);
  }
} else if (action === 'faucet') {
  if (sourceName !== 'monad') throw new Error('TACEO demo faucet only serves Monad Testnet');
  if (registryIndex === null) throw new Error('Register on Monad first');
  const url = `https://crosschain.merces-demo.taceo.io/api/chain-a/faucet/claim/${address}`;
  const response = await fetch(url, { method: 'POST' });
  const body = await response.text();
  if (!response.ok) throw new Error(`TACEO faucet HTTP ${response.status}: ${body.slice(0, 300)}`);
  console.log(`TACEO faucet request accepted (HTTP ${response.status})`);
  if (body) console.log(`Response: ${body.slice(0, 300)}`);
  const balanceAfter = await publicClient.readContract({
    address: tokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address],
  });
  console.log(`Public demo token after request: ${formatUnits(balanceAfter, decimals)}`);
  if (balanceAfter <= publicBalance) {
    console.log('Public balance may stay at zero because the faucet can credit the private account.');
    console.log('Check with: npm run oft -- status monad --private');
  }
} else if (action === 'deposit') {
  if (sourceName !== 'monad') throw new Error('This demo deposits only on Monad');
  if (registryIndex === null) throw new Error('Register on Monad first');
  const amount = boundedAmount(process.argv[4] ?? '0.1', '0.1');
  if (publicBalance < amount) throw new Error('Insufficient public demo token; the TACEO faucet may have funded the private account directly');
  const client = await makeClient();
  console.log('Depositing...');
  console.log(await client.deposit(amount, (step) => console.log(`Step: ${step}`)));
} else if (action === 'send') {
  if (sourceName !== 'monad') throw new Error('This demo sends only from Monad');
  if (registryIndex === null) throw new Error('Register on Monad first');
  const destinationName = process.argv[4] ?? 'base';
  const destination = networks[destinationName];
  if (!destination || destinationName === 'monad') throw new Error('Destination must be base or sepolia');
  const amount = boundedAmount(process.argv[5] ?? '0.05', '0.05');
  const destinationClient = createPublicClient({ chain: destination.chain, transport: http(destination.rpc) });
  const destinationIndex = await getIndexByAddress(destinationClient, destination.registry, address);
  if (destinationIndex === null) throw new Error(`Register this wallet on ${destination.chain.name} first`);
  const client = await makeClient();
  const note = await client.myCurrentNote();
  if ((note?.balance ?? 0n) < amount) throw new Error('Insufficient private demo token');
  console.log(`Sending to own registered wallet on ${destination.chain.name}...`);
  console.log(await client.send(BigInt(destination.chain.id), destination.registry, destinationClient, address, amount,
    (step) => console.log(`Step: ${step}`)));
} else if (action === 'withdraw') {
  if (sourceName !== 'base') throw new Error('This demo withdraws only on Base Sepolia');
  if (registryIndex === null) throw new Error('Register on Base Sepolia first');
  const amount = boundedAmount(process.argv[4] ?? '0.02', '0.02');
  const client = await makeClient();
  const note = await client.myCurrentNote();
  if ((note?.balance ?? 0n) < amount) throw new Error('Insufficient private demo token');
  console.log('Withdrawing on Base Sepolia...');
  console.log(await client.withdraw(amount, (step) => console.log(`Step: ${step}`)));
} else {
  throw new Error('Action must be status, register, faucet, deposit, send, or withdraw');
}

function requireGas() {
  if (nativeBalance === 0n) throw new Error(`Need ${source.chain.nativeCurrency.symbol} testnet gas to register`);
}

function boundedAmount(input, limit) {
  const amount = parseUnits(input, decimals);
  if (amount <= 0n || amount > parseUnits(limit, decimals)) {
    throw new Error(`Amount must be above 0 and at most ${limit} demo token`);
  }
  return amount;
}

function makeClient() {
  return Client.create({
    contractAddress: source.merces,
    contractKind: source.kind,
    idRegistryAddress: source.registry,
    token: source.token,
    gatewayUrl: source.gateway,
    publicClient,
    walletClient,
    txReceiptTimeout: 120_000,
    mpcEventTimeout: 360_000,
  });
}

// Prover workers can otherwise keep the process alive after a confirmed result.
if (['deposit', 'send', 'withdraw'].includes(action)) process.exit(0);

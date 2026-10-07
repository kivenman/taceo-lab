# TACEO testnet integration lab

[中文记录](./README.md)

A small, reproducible Node.js CLI that exercises three TACEO testnet integrations with a locally generated EVM wallet:

1. A confidential x402 payment for an HTTP resource on Base Sepolia.
2. A Merces OMap private deposit, transfer, and withdrawal on Plasma Testnet.
3. A Merces OFT private transfer from Monad Testnet to Base Sepolia, followed by a withdrawal there.

The commands use TACEO's published SDKs and deployments. This is a testnet integration example, not an airdrop claim or a production wallet.

## Requirements and setup

- Node.js 22 and npm.
- A network connection to the RPCs and TACEO services listed in the [deployment documentation](https://docs.taceo.io/docs/start-here/deployments-and-status/).
- Testnet gas for OFT registration: MON on Monad Testnet and ETH on Base Sepolia.

```sh
npm ci
npm run wallet
npm run wallet -- recipient
```

Wallets are created only when missing. Private keys stay in `.secrets/`, which is ignored by Git. The directory uses mode `0700` and wallet files use `0600`. Back up these files privately if you want to retain the test identities. Do not put real assets in them or paste the keys into a website.

## Confidential x402

The [TACEO x402 quickstart](https://docs.taceo.io/docs/finance-solutions/x402/quickstart/) provides a faucet and a protected HTTP endpoint. The payment script checks the network, token, confidential contract, and a one-test-USDC spending cap before paying.

```sh
npm run faucet     # claims test USDC once per eligible wallet
npm run balance    # private Base Sepolia balance
npm run check      # inspect HTTP 402 payment terms; does not pay
npm run pay        # pays one test USDC and fetches the resource
```

`pay` creates a new payment each time. The protected server endpoint and contract addresses are fixed in `scripts/pay.mjs` so the example cannot silently pay another recipient or asset.

## Merces OMap on Plasma Testnet

The two local wallets form a sender and recipient pair. Registration and balance checks are safe to repeat; `deposit`, `transfer`, and `withdraw` each create a new testnet transaction.

```sh
npm run plasma -- register
npm run plasma -- register --recipient
npm run plasma -- status
npm run plasma -- status --recipient
npm run plasma -- deposit 1
npm run plasma -- transfer 0.4
npm run plasma -- withdraw 0.2 --recipient
```

Amounts are in test USDT0. The example caps each mutation at the amount shown. See the [OMap SDK documentation](https://docs.taceo.io/docs/finance-solutions/integrate/client-sdk-omap/).

## Merces OFT across testnets

The OFT commands use the primary wallet on both chains. Registration requires native testnet gas. The observed TACEO Monad demo faucet credited the **private** balance directly, so a zero public ERC-20 balance did not mean the claim failed.

```sh
npm run oft -- status monad
npm run oft -- status base
npm run oft -- register monad
npm run oft -- register base
npm run oft -- faucet monad
npm run oft -- status monad --private
npm run oft -- send monad base 0.05
npm run oft -- status base --private
npm run oft -- withdraw base 0.02
npm run oft -- status base --private
```

The source wallet and the destination wallet must be registered on their respective chains before `send`. The sender's private balance is checked before submitting. A timeout or Gateway error is not proof that an operation failed: check the relevant balances and transaction status before retrying. The [OFT SDK documentation](https://docs.taceo.io/docs/finance-solutions/integrate/client-sdk-oft/) describes the demo's scope.

## Verified run on 2026-10-07

Public wallet address: `0x96CA7733E27B75F39157B8aF2a91A2DcaCb5aeac`.

| Flow | Verification |
| --- | --- |
| Confidential x402 | Protected HTTP resource returned 200; private balance fell from 1,000 to 999 test USDC. |
| Plasma private deposit | [1 test USDT0 deposited](https://testnet.plasmascan.to/tx/0x8c0b1fff78c52829000d241056d32f2c627c12e88416222eaa27d58fe3d40e14). |
| Plasma private transfer | [0.4 test USDT0 sent to the recipient wallet](https://testnet.plasmascan.to/tx/0xa6a1e2940a85b384e96c3815315753ea6e59361b1d131b7123e086474df2e9d5). |
| Plasma private withdrawal | [0.2 test USDT0 withdrawn](https://testnet.plasmascan.to/tx/0xb3f95438c5d00f02517560eca59cb2f3dd3a6fd3a95a9a7333af416fc516e401). |
| OFT cross-chain send | [0.05 demo token sent from Monad](https://testnet.monadexplorer.com/tx/0xc4382af7d2ef3f684447dde4619de3cbb491e3f1d9bf53ac170917c8e9c5531b); Base private balance reached 0.05. |
| OFT destination withdrawal | [0.02 demo token withdrawn on Base Sepolia](https://sepolia.basescan.org/tx/0xe04f2b66b8cb96c68992fcf04c1aeaba62490c848ce5ba14a62f2670cf9cda65); final Base balances: 0.03 private, 0.02 public. |

The OFT demo uses TACEO-operated MPC nodes and a relayer substitute for a DVN, as stated in the [official quickstart](https://docs.taceo.io/docs/finance-solutions/cross-chain/quickstart/). Testnet use does not imply a future reward or token allocation.

## SDK compatibility notes

- `scripts/run-sdk.mjs` runs the TACEO clients through a temporary ASCII path because the Merces1 client currently reads a percent-encoded WASM path from Unicode directories.
- The OMap client needs the `tsx/esm` loader under this Node.js setup.
- The OFT client appends `/ws` to its Gateway URL. The Base and Sepolia configurations in this example omit that suffix even though the published deployment table includes it.
- `HTTPS_PROXY` or `https_proxy`, when present, is applied to SDK network calls via `undici`.

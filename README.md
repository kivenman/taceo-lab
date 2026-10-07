# TACEO 测试网参与脚本

[English documentation](./README.en.md)

本地生成专用 EVM 钱包，领取 TACEO Base Sepolia 测试币，完成 Confidential x402 支付，并查询私密余额。

```sh
npm ci
npm run wallet    # 生成或显示钱包地址，不输出私钥
npm run faucet    # 领取 1,000 测试 USDC；同地址 24 小时内限领一次
npm run balance   # 查询私密余额
npm run check     # 检查支付条款，不付款
npm run pay       # 每次运行支付 1 测试 USDC
npm run balance
```

私钥保存在 `.secrets/testnet-wallet.json`，目录和文件分别只允许本机账户访问，且 `.secrets/` 已加入 `.gitignore`。如需保留这个测试钱包，请私下备份该文件。不要用它存真实资产，也不要把私钥粘贴到网站或发给他人。

支付脚本会核对链 `eip155:84532`、测试币和 Merces 合约地址，并限制每次最多支付 1 测试 USDC。服务地址以 TACEO [网络与合约文档](https://docs.taceo.io/docs/finance-solutions/x402/network-and-contracts/)为准。启动器会绕过 TACEO 当前 SDK 在中文目录加载 WASM 时的路径问题。

## 本次运行记录（2026-10-07）

- 地址：`0x96CA7733E27B75F39157B8aF2a91A2DcaCb5aeac`
- Faucet：HTTP 200，领取 1,000 测试 USDC。
- Confidential x402：HTTP 200，取得受保护内容；支付后私密余额为 999 测试 USDC。

测试币没有真实价值。TACEO 尚未公布这些操作对应的积分或空投规则。

## 第二步：Plasma Merces 私密账户

使用同一个主钱包，并在本地生成第二个收款钱包。以下命令已经执行过；`deposit`、`transfer`、`withdraw` 每次运行都会提交一笔**新的**测试网操作，重试前先用 `status` 核对余额。

```sh
npm run wallet -- recipient
npm run plasma -- register
npm run plasma -- register --recipient
npm run plasma -- status
npm run plasma -- status --recipient

# 已完成的操作；无需为了保留参与记录而重复运行
npm run plasma -- deposit 1
npm run plasma -- transfer 0.4
npm run plasma -- withdraw 0.2 --recipient
```

| 操作 | Plasma 测试网交易哈希 |
| --- | --- |
| 主钱包私密存入 1 USDT0 | [`0x8c0b…0e14`](https://testnet.plasmascan.to/tx/0x8c0b1fff78c52829000d241056d32f2c627c12e88416222eaa27d58fe3d40e14) |
| 主钱包私密转给收款钱包 0.4 USDT0 | [`0xa6a1…e9d5`](https://testnet.plasmascan.to/tx/0xa6a1e2940a85b384e96c3815315753ea6e59361b1d131b7123e086474df2e9d5) |
| 收款钱包私密提取 0.2 USDT0 | [`0xb3f9…e401`](https://testnet.plasmascan.to/tx/0xb3f95438c5d00f02517560eca59cb2f3dd3a6fd3a95a9a7333af416fc516e401) |

收款钱包地址：`0x7B322855cACf11E2DD586182e41277cC7B30C310`。最终余额：主钱包公开 `9999`、私密 `0.6` 测试 USDT0；收款钱包公开 `10000.2`、私密 `0.2` 测试 USDT0。两只钱包的私钥都只在本地 `.secrets/` 中。

Plasma SDK 使用 TACEO 的 [OMap 客户端](https://docs.taceo.io/docs/finance-solutions/integrate/client-sdk-omap/)及[官方部署地址](https://docs.taceo.io/docs/start-here/deployments-and-status/)。当前 SDK 在 Node.js 22 上有 ESM 导入和中文路径兼容问题，`run-sdk.mjs` 使用 `tsx` 和临时英文路径运行；脚本在设置了 `HTTPS_PROXY` 的环境中也会让 SDK 请求经过代理。

## 第三步：Monad → Base Sepolia 跨链 Demo（已完成）

已接入 TACEO [OFT SDK](https://docs.taceo.io/docs/finance-solutions/integrate/client-sdk-oft/) 和[官方测试网部署地址](https://docs.taceo.io/docs/start-here/deployments-and-status/)。`oft` 命令只读取本地**主钱包**，每次写操作都先检查链、账户注册状态与测试币余额。

2026-10-07，主钱包 `0x96CA7733E27B75F39157B8aF2a91A2DcaCb5aeac` 通过[这笔交易](https://testnet.monadexplorer.com/tx/0xd80cbba8c30709a9f1cab98ceb47e265877d514aad254e12a61eb6e234840a93)收到 5 MON 测试币，并在 Monad Testnet 注册为索引 `16`。Base Sepolia 收到 `0.01` 测试 ETH，通过[这笔交易](https://sepolia.basescan.org/tx/0xbdb26c53bac18734ec6286f8fd903b305fa6e1094eb31608d770c95a5ce88307)注册为索引 `9`。

TACEO Demo 水龙头在 Monad 账户注册后直接把 **1,000 测试 Token 记入私密余额**，公开 ERC-20 余额仍为 0。仅看公开余额会误判为未到账；`npm run oft -- status monad --private` 可扫描私密余额。此过程没有公开存入交易。

| 操作 | 测试网交易/结果 |
| --- | --- |
| Monad 私密跨链发送 `0.05` 至同一钱包的 Base Sepolia 账户 | [`0xc438…531b`](https://testnet.monadexplorer.com/tx/0xc4382af7d2ef3f684447dde4619de3cbb491e3f1d9bf53ac170917c8e9c5531b) |
| Base Sepolia 私密提取 `0.02` 到公开余额 | [`0xe04f…da65`](https://sepolia.basescan.org/tx/0xe04f2b66b8cb96c68992fcf04c1aeaba62490c848ce5ba14a62f2670cf9cda65) |

最终已核对：Monad 私密余额 `999.95`；Base Sepolia 私密余额 `0.03`、公开 Demo Token 余额 `0.02`，测试 ETH 约 `0.0099876931`。下列命令只读；`send` 和 `withdraw` 每次运行都会产生新交易，无需重复：

```sh
npm run oft -- status monad --private
npm run oft -- status base --private
```

官方部署页给出的 Base/Sepolia Gateway 地址含 `/ws`，但当前 OFT SDK 会自动追加 `/ws`。脚本只保留域名；首次提取因重复路径连接失败，在确认余额未变化后修正并成功提取。

跨链 Demo 仅是测试部署。[官方说明](https://docs.taceo.io/docs/finance-solutions/cross-chain/quickstart/)目前没有 DVN，且 TACEO 运行所有 MPC 节点。测试 Token 没有真实价值，也没有已宣布的空投资格。

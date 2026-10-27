# Plam 商城

一个按淘宝 PC 端 1:1 结构复刻的电商平台，包含三端：

| 端 | 入口 | 说明 |
| --- | --- | --- |
| 买家版 | `/` | 首页、搜索、商品详情、购物车、结算支付、我的 Plam（订单 / 收藏 / 足迹 / 卡券 / 地址 / 退款 / 评价 / 消息 / 发票） |
| 商家中心 | `/seller` | 工作台、交易（已卖出宝贝 / 退款 / 评价 / 物流数据 / 物流服务）、商品（我的商品 / 发布 / SKU / 仓储库存）、营销工具、推广中心、客服、店铺（真实体验分等）、私域、财务、数据、服务市场 |
| 超级管理后台 | `/admin` | 看板、用户 / 商家、商品审核 / 类目、订单 / 退款纠纷 / 评价、轮播 / 优惠券 / 活动 / 公告、支付渠道 / 商家结算 / 财务报表、角色权限 / 操作日志 / 系统设置 |

线上地址：https://plam.pages.dev （PC 与手机自适应：手机端底部导航 + 堆叠布局，商家 / 管理后台为抽屉菜单）

## 演示账号（登录页一键登录）

| 角色 | 账号 | 说明 |
| --- | --- | --- |
| 买家 | `xiyan` | 默认已登录 |
| 商家 | `seller12` | 店铺「chenjiafeng2008的小店」 |
| 管理员 | `admin` | 超级管理员 |

任意账号 + 任意密码即可登录；注册页可创建新买家（赠 ¥1000 体验金）。

## 技术栈

- 前端：Vite 8 + React 19 + TypeScript + Tailwind CSS 3 + React Router 7 + zustand + recharts + lucide-react
- 后端：Cloudflare Pages Functions + D1（`functions/api/[[path]].ts`）
- 数据层：`src/data/reducers.ts` 为纯函数，前端与 Worker 共用同一份变更逻辑；前端乐观更新 → `POST /api/mutate` 同步到 D1 → 其他端每 8 秒轮询版本号拉取最新数据，买家下单后商家端 / 管理端实时可见。
- 支付：`PaymentProvider` 抽象（微信 / 银联 / Stripe / PayPal / 余额），支付宝预留，后台「支付渠道」可随时启停与配置；`/api/pay/*` 为统一网关占位。

## 本地开发

```bash
npm install
npm run dev            # 纯前端模式（无后端时自动降级为浏览器本地存储）
npm run build
npx wrangler pages dev dist   # 带 D1 的完整模式（本地 SQLite）
```

## 部署

- GitHub `main` 分支推送后由 Cloudflare Pages 自动构建（`npm run build` → `dist`），`wrangler.toml` 提供 D1 绑定 `DB`。
- 手动部署：`npx wrangler pages deploy dist --project-name plam`
- 重置演示数据：后台「系统设置 → 重置为演示数据」或 `POST /api/reset`

## 目录

```
functions/api/[[path]].ts   D1 数据 API
src/data/                   类型、种子数据、reducers、初始状态
src/store/                  zustand 仓库、会话、与后端同步
src/layouts/                买家 / 商家 / 管理三套布局
src/pages/buyer|seller|admin
src/components/             通用 UI（表格、弹窗、Tabs、图表…）
```

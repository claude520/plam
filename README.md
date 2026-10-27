# Plam 商城

一个按淘宝 PC 端 1:1 结构复刻的电商平台，包含三端：

| 端 | 入口 | 说明 |
| --- | --- | --- |
| 买家版 | `/` | 首页、搜索、商品详情、购物车、结算支付、我的 Plam（订单 / 收藏 / 足迹 / 卡券 / 地址 / 退款 / 评价 / 消息 / 发票） |
| 商家中心 | `/seller` | 工作台、交易（已卖出宝贝 / 退款 / 评价 / 物流数据 / 物流服务）、商品（我的商品 / 发布 / SKU / 仓储库存）、营销工具、推广中心、客服、店铺（真实体验分等）、私域、财务、数据、服务市场 |
| Plam直播（买家） | `/live` | 直播广场（发现 / 关注 / 类目 / 种草榜 / 直播超值购）、直播间（实时画面、聊天互动、点赞、关注、讲解商品卡、全部商品面板、限时秒杀 / 主播券、直播专享价下单） |
| Plam直播（主播） | `/seller/live` | 复刻淘宝直播主播中台：首页、直播计划 / 预告、直播讲解、货盘管理、开播工具（公屏管理 / 智能手卡 / 前景贴片 / 直播装修 / 1+N / 试播诊断）、直播互动、直播推广、直播体检、数字人、直播设置、多开直播、成长 / 活动 / 课堂、数据（概览 / 场次 / 交易 / 粉丝 / 商品…）、资金；`/seller/live/studio/:id` 为直播中控台（开播推流、讲解、设价、秒杀、发券、公告、评论置顶 / 禁言） |
| 超级管理后台 | `/admin` | 看板、用户 / 商家、商品审核 / 类目、订单 / 退款纠纷 / 评价、轮播 / 优惠券 / 活动 / 公告、支付渠道 / 商家结算 / 财务报表、角色权限 / 操作日志 / 系统设置 |

线上地址：https://plam.pages.dev （PC 与手机自适应：手机端底部导航 + 堆叠布局，商家 / 管理后台为抽屉菜单）

## 演示账号（登录页一键登录）

| 角色 | 账号 | 说明 |
| --- | --- | --- |
| 买家 | `xiyan` | 默认已登录 |
| 商家 | `seller12` | 店铺「chenjiafeng2008的小店」，可在 `/seller/live` 开播 |
| 管理员 | `admin` | 超级管理员 |

任意账号 + 任意密码即可登录；注册页可创建新买家（赠 ¥1000 体验金）。

## 技术栈

- 前端：Vite 8 + React 19 + TypeScript + Tailwind CSS 3 + React Router 7 + zustand + recharts + lucide-react
- 后端：Cloudflare Pages Functions + D1（`functions/api/[[path]].ts`）
- 数据层：`src/data/reducers.ts` 为纯函数，前端与 Worker 共用同一份变更逻辑；前端乐观更新 → `POST /api/mutate` 同步到 D1 → 其他端每 8 秒轮询版本号拉取最新数据，买家下单后商家端 / 管理端实时可见。
- 直播：主播在中控台用浏览器 `MediaRecorder` 每 2 秒切一段独立 webm（vp8/opus）并附一帧 JPEG，`POST /api/live/:id/media` 写入 D1；观众端 `GET /api/live/:id/poll` 轮询（1.5s），支持 MSE 的浏览器用 `MediaSource` 顺序拼接播放（延迟 3～6 秒），不支持的（iOS Safari）回退为关键帧画面。评论 / 点赞 / 进场 / 讲解 / 秒杀 / 发券 / 公告 / 禁言等走 `live_events` 事件流，在线人数由 `live_viewers` 心跳统计。无摄像头时可用「虚拟画面」（canvas 商品轮播）开播。种子数据中的其他店铺直播间为演示直播间（商品图轮播 + 模拟弹幕）。
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

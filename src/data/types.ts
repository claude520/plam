export type Role = 'buyer' | 'seller' | 'admin'

export interface User {
  id: string
  username: string
  nickname: string
  avatar: string
  role: Role
  phone: string
  email?: string
  vip: boolean
  level: number
  status: 'active' | 'frozen'
  createdAt: string
  shopId?: string
  balance: number
  coins: number
}

export interface Category {
  id: string
  name: string
  icon?: string
  parentId?: string
  sort: number
  status: 'on' | 'off'
}

export interface SkuAttr { name: string; values: string[] }

export interface Sku {
  id: string
  attrs: Record<string, string>
  price: number
  stock: number
}

export type ProductStatus = 'on' | 'off' | 'pending' | 'rejected' | 'draft'

export interface Product {
  id: string
  title: string
  subtitle?: string
  images: string[]
  price: number
  originalPrice?: number
  categoryId: string
  shopId: string
  sales: number
  stock: number
  rating: number
  reviewCount: number
  tags: string[]
  attrs: SkuAttr[]
  skus: Sku[]
  status: ProductStatus
  createdAt: string
  freeShipping: boolean
  detail: string
  views: number
  favorites: number
  /** 商品发布页填写的完整信息（复刻淘宝发布表单） */
  pub?: PublishInfo
}

export interface DetailBlock { id: string; type: 'image' | 'text'; value: string }
export interface PublishInfo {
  catId: string
  catPath: string[]
  brand: string
  props: Record<string, string>
  customProps: { name: string; value: string }[]
  isCustom: boolean
  purchaseFrom: 'cn' | 'abroad'
  guideTitle: string
  buyNotes: string
  sellerCode: string
  multiDiscount: { enabled: boolean; count: number; discount: number }
  stockMode: 'order' | 'pay'
  listing: 'now' | 'timed' | 'warehouse'
  listAt?: string
  shipTime: '24h' | '48h' | 'gt48h'
  shipBySku: boolean
  delivery: boolean
  freightTemplate: string
  regionLimit: 'none' | 'template'
  warranty: boolean
  sevenDays: boolean
  images34: string[]
  video: string
  whiteImage: string
  detailBlocks: DetailBlock[]
  shopCats: string[]
  skuMode: 'custom' | 'standard'
  skuImages: Record<string, string>
  template: string
}

export interface Shop {
  id: string
  name: string
  ownerId: string
  logo: string
  type: 'tmall' | 'taobao'
  level: number
  score: { desc: number; service: number; logistics: number }
  fans: number
  status: 'open' | 'pending' | 'closed'
  deposit: number
  createdAt: string
  description: string
  address: string
}

export type OrderStatus = 'unpaid' | 'paid' | 'shipped' | 'received' | 'done' | 'closed' | 'refunding'

export interface OrderItem {
  productId: string
  title: string
  image: string
  skuText: string
  price: number
  qty: number
}

export interface Order {
  id: string
  userId: string
  shopId: string
  items: OrderItem[]
  total: number
  freight: number
  discount: number
  payAmount: number
  status: OrderStatus
  createdAt: string
  paidAt?: string
  shippedAt?: string
  doneAt?: string
  address: Address
  payment?: { provider: string; tradeNo: string }
  logistics?: { company: string; no: string; traces: { time: string; text: string }[] }
  note?: string
  /** 来源直播间 */
  liveId?: string
}

export interface Address {
  id: string
  userId: string
  name: string
  phone: string
  /** 国家代码（ISO 3166-1，如 CN / VN）；老数据为空时视为中国 */
  country?: string
  /** 城市 / 省州 */
  region: string
  detail: string
  zip?: string
  isDefault: boolean
}

export interface CartItem {
  id: string
  productId: string
  skuId: string
  qty: number
  checked: boolean
  addedAt: string
}

export interface Coupon {
  id: string
  name: string
  shopId?: string
  type: 'full' | 'discount' | 'cash'
  threshold: number
  value: number
  total: number
  used: number
  startAt: string
  endAt: string
  status: 'active' | 'paused' | 'expired'
}

export interface Review {
  id: string
  productId: string
  userId: string
  orderId: string
  rating: number
  content: string
  images: string[]
  createdAt: string
  reply?: string
  skuText?: string
}

export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled'

export interface Refund {
  id: string
  orderId: string
  userId: string
  shopId: string
  amount: number
  reason: string
  type: 'refund' | 'return'
  status: RefundStatus
  createdAt: string
  desc?: string
}

export interface Banner {
  id: string
  title: string
  subtitle: string
  gradient: string
  link: string
  position: 'home-hero' | 'home-side' | 'seller-top'
  status: 'on' | 'off'
  sort: number
}

export interface Announcement {
  id: string
  title: string
  content: string
  audience: 'buyer' | 'seller' | 'all'
  createdAt: string
  pinned: boolean
}

export interface PaymentProvider {
  id: string
  name: string
  code: string
  enabled: boolean
  feeRate: number
  config: Record<string, string>
  logoColor: string
  desc: string
}

export interface Campaign {
  id: string
  name: string
  type: 'flash' | 'subsidy' | 'festival' | 'coupon'
  startAt: string
  endAt: string
  status: 'draft' | 'enrolling' | 'running' | 'ended'
  products: string[]
  discount: number
}

export interface AuditLog {
  id: string
  actor: string
  action: string
  target: string
  time: string
  ip: string
}

export interface Message {
  id: string
  from: string
  to: string
  shopId: string
  content: string
  time: string
  read: boolean
}

export interface AdminRole {
  id: string
  name: string
  permissions: string[]
  members: number
}

// ---------------- 直播 ----------------
export type LiveStatus = 'scheduled' | 'live' | 'ended'

export interface LiveRoom {
  id: string
  shopId: string
  hostId: string
  title: string
  cover: string
  covers?: string[]
  categoryId?: string
  status: LiveStatus
  type: 'vertical' | 'horizontal'
  visibility: 'all' | 'private' | 'trial'
  plannedAt: string
  startedAt?: string
  endedAt?: string
  trailer: boolean
  showLocation: boolean
  demo?: boolean
  productIds: string[]
  /** 讲解中的商品 */
  explainingId?: string
  /** 置顶/公告 */
  notice?: string
  /** 直播间专享价：productId -> price */
  livePrices: Record<string, number>
  stats: { viewers: number; views: number; peak: number; likes: number; comments: number; orders: number; gmv: number; newFans: number; clicks: number; duration: number }
  /** 讲解记录 */
  keypoints: { productId: string; start: string; end?: string; clicks: number; orders: number }[]
}

export interface LiveConfig {
  shopId: string
  nickname: string
  intro: string
  hideNames: boolean
  aiReply: boolean
  aiCard: boolean
  strategy: boolean
  autoReplies: { q: string; a: string }[]
  quickReplies: string[]
  blockWords: string[]
  mutedUsers: string[]
  channels: { search: boolean; feed: boolean; shop: boolean; detail: boolean; outside: boolean }
  goods: { showPrice: boolean; showSales: boolean; autoPush: boolean; pushInterval: number }
  gift: boolean
  publicScreenAI: boolean
  fps: 1 | 2
  quality: 'low' | 'mid' | 'high'
}

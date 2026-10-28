import type {
  AdminRole, Address, Announcement, AuditLog, Banner, Campaign, Category, Coupon, Message,
  Order, PaymentProvider, Product, Refund, Review, Shop, User, LiveRoom, LiveConfig } from './types'

// ---------- helpers ----------
let seedN = 20261028
const rnd = () => { seedN = (seedN * 9301 + 49297) % 233280; return seedN / 233280 }
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
const rint = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString()
export const img = (seed: string | number, w = 400, h = 400) => `https://picsum.photos/seed/${seed}/${w}/${h}`
export const avatar = (seed: string) => `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=ffdfbf,ffd5dc,c0aede,d1d4f9,b6e3f4`

type Role = User['role']

export function buildSeed() {
  seedN = 20261028
  // ---------- categories (真实淘宝一级类目树) ----------
  const topCats: [string, string, string[]][] = [
    ['c1', '电脑办公', ['电脑配件', '办公文具', '笔记本', '显示器', '外设产品', '打印机']],
    ['c2', '家电数码', ['大家电', '手机', '通信', '数码相机', '智能设备', '耳机音响']],
    ['c3', '工业农业', ['工业品', '商业', '农业', '定制']],
    ['c4', '家具家装', ['家具', '家装', '家居', '厨具', '灯具', '卫浴']],
    ['c5', '服饰内衣', ['女装', '男装', '内衣', '配饰', '童装']],
    ['c6', '鞋靴运动', ['女鞋', '男鞋', '运动', '户外', '健身']],
    ['c7', '汽车珠宝', ['汽车用品', '珠宝', '文玩', '箱包']],
    ['c8', '食品鲜花', ['食品', '鲜花', '酒水', '健康', '生鲜']],
    ['c9', '母婴玩具', ['母婴', '童装', '玩具', '宠物']],
    ['c10', '美妆个护', ['彩妆', '护肤', '个护', '香水']],
  ]
  const categories: Category[] = []
  topCats.forEach(([id, name, subs], i) => {
    categories.push({ id, name, sort: i + 1, status: 'on' })
    subs.forEach((s, j) => categories.push({ id: `${id}-${j + 1}`, name: s, parentId: id, sort: j + 1, status: 'on' }))
  })

  // ---------- shops ----------
  const shopNames = [
    ['s1', '华为官方旗舰店', 'tmall'], ['s2', 'Apple 授权专营店', 'tmall'], ['s3', '优衣库官方旗舰店', 'tmall'],
    ['s4', '三只松鼠旗舰店', 'tmall'], ['s5', '小米官方旗舰店', 'tmall'], ['s6', 'Annie bridesmaids', 'taobao'],
    ['s7', '伊卡洛饰品旗舰店', 'tmall'], ['s8', '探险者户外装备', 'taobao'], ['s9', '茉莉雅集高端女装', 'taobao'],
    ['s10', '源氏木语旗舰店', 'tmall'], ['s11', '极客数码配件', 'taobao'], ['s12', 'chenjiafeng2008的小店', 'taobao'],
  ]
  const shops: Shop[] = shopNames.map(([id, name, type], i) => ({
    id, name, type: type as Shop['type'], ownerId: `u-seller-${i + 1}`, logo: avatar(name),
    level: rint(3, 7), score: { desc: 4.6 + rnd() * 0.4, service: 4.6 + rnd() * 0.4, logistics: 4.6 + rnd() * 0.4 },
    fans: rint(1200, 980000), status: i === 11 ? 'open' : (i === 9 ? 'pending' : 'open'), deposit: type === 'tmall' ? 100000 : 2000,
    createdAt: daysAgo(rint(100, 2000)), description: `${name}，正品保障，7天无理由退换，全国包邮。`,
    address: pick(['浙江 杭州', '广东 深圳', '上海', '北京', '江苏 南京', '福建 泉州']),
  }))

  // ---------- users ----------
  const users: User[] = [
    { id: 'u-buyer-1', username: 'xiyan', nickname: '希言', avatar: avatar('xiyan'), role: 'buyer', phone: '138****2008', email: 'xiyan@example.com', vip: true, level: 5, status: 'active', createdAt: daysAgo(900), balance: 1280.5, coins: 182 },
    { id: 'u-admin-1', username: 'admin', nickname: '超级管理员', avatar: avatar('admin'), role: 'admin', phone: '139****0001', vip: false, level: 9, status: 'active', createdAt: daysAgo(1500), balance: 0, coins: 0 },
    ...shops.map((s, i) => ({ id: `u-seller-${i + 1}`, username: `seller${i + 1}`, nickname: s.name.replace(/旗舰店|官方|专营店/g, ''), avatar: s.logo, role: 'seller' as Role, phone: `186****${String(1000 + i).slice(-4)}`, vip: false, level: s.level, status: 'active' as const, createdAt: s.createdAt, shopId: s.id, balance: rint(5000, 200000), coins: 0 })),
    ...Array.from({ length: 28 }, (_, i) => ({
      id: `u-buyer-${i + 2}`, username: `user${i + 2}`, nickname: pick(['小鹿', '阿梨', 'Tomi', '柚子', '阿杰', '晴天', '墨白', '七月', 'Kiki', '大熊', '小满', '一一']) + (i + 2),
      avatar: avatar(`user${i + 2}`), role: 'buyer' as Role, phone: `1${rint(3, 9)}${rint(0, 9)}****${String(rint(1000, 9999))}`, vip: rnd() > 0.7, level: rint(1, 6),
      status: (rnd() > 0.93 ? 'frozen' : 'active') as User['status'], createdAt: daysAgo(rint(1, 800)), balance: Math.round(rnd() * 5000) / 1, coins: rint(0, 500),
    })),
  ]

  // ---------- products ----------
  interface Tpl { cat: string; shop: string; titles: string[]; price: [number, number]; attrs: { name: string; values: string[] }[]; tags?: string[] }
  const tpls: Tpl[] = [
    { cat: 'c2-2', shop: 's1', price: [2999, 7999], attrs: [{ name: '颜色', values: ['曜金黑', '雅川青', '羽砂紫'] }, { name: '版本', values: ['12GB+256GB', '12GB+512GB', '16GB+1TB'] }], titles: ['HUAWEI Mate 70 Pro 超可靠玄武架构 第二代昆仑玻璃 旗舰手机', '华为 Pura 70 Ultra 伸缩镜头 超高速风驰闪拍 鸿蒙智能手机', '华为 nova 13 Pro 前置6000万像素 人像摄影 新款手机'], tags: ['官方立减15%', '国家补贴'] },
    { cat: 'c2-2', shop: 's2', price: [5999, 12999], attrs: [{ name: '颜色', values: ['沙漠色钛金属', '原色钛金属', '黑色钛金属'] }, { name: '容量', values: ['256GB', '512GB', '1TB'] }], titles: ['Apple iPhone 17 Pro Max 支持移动联通电信5G 双卡双待手机', 'Apple iPad Pro 13英寸 M5芯片 超视网膜XDR显示屏', 'Apple MacBook Air 15英寸 M4 芯片 16G 512G 轻薄笔记本'], tags: ['24期免息', '国家补贴'] },
    { cat: 'c2-6', shop: 's5', price: [99, 1299], attrs: [{ name: '颜色', values: ['黑色', '白色', '薄荷绿'] }], titles: ['小米 Buds 5 Pro 降噪耳机 真无线蓝牙 哈曼调音', '小米手环 10 NFC 版 智能运动手环 血氧监测', 'Xiaomi 智能音箱 Pro 小爱同学 家庭智能中枢', '小米 Watch S4 eSIM 独立通话 智能手表'], tags: ['官方立减', '包邮'] },
    { cat: 'c5-1', shop: 's3', price: [79, 499], attrs: [{ name: '颜色', values: ['米白', '黑色', '藏青', '燕麦色'] }, { name: '尺码', values: ['S', 'M', 'L', 'XL'] }], titles: ['优衣库 女装 高级轻型羽绒服 2026秋冬新款 轻薄保暖', '优衣库 摇粒绒拉链开衫 情侣款 秋冬保暖外套', '优衣库 HEATTECH 温暖内衣 女款圆领长袖 发热打底', '优衣库 设计师联名 牛仔宽松阔腿裤 女装新款'], tags: ['官方立减15%', '退货宝'] },
    { cat: 'c5-1', shop: 's9', price: [168, 899], attrs: [{ name: '颜色', values: ['香槟色', '雾霾蓝', '黑色'] }, { name: '尺码', values: ['S', 'M', 'L'] }], titles: ['茉莉雅集 法式温柔风一字肩假两件针织衫 2026秋季新款长袖', '羊毛衫100上衣慵懒风V领针织开衫女冬季宽松设计感交叉毛衣外套', '初恋系温柔气质粉不规则色连衣裙 高级感春秋裙子', '美式复古镶钻一字肩撞色插肩袖T恤女设计感修身显瘦上衣'], tags: ['大促价保', '消费券'] },
    { cat: 'c5-1', shop: 's6', price: [198, 698], attrs: [{ name: '颜色分类', values: ['款式3', '款式14', '款式22'] }, { name: '尺码', values: ['S[建议90斤左右]', 'M[建议100斤左右]', 'L[建议110斤左右]'] }], titles: ['法式伴娘服礼服2026新款高级感夏季淡黄色缎面长裙姐妹团平时可穿', '法式轻婚纱2026新款抹胸露腿小礼服户外旅拍白色拖尾', '一字肩蕾丝鱼尾婚纱新款法式新娘主纱高级质感小众奢华拖尾', '简约轻婚纱短款蝴蝶结拖尾旅拍V领显瘦白纱裙领证登记小礼服'], tags: ['官方立减41元', '3期免息'] },
    { cat: 'c7-2', shop: 's7', price: [88, 1288], attrs: [{ name: '款式', values: ['罗马项链', '锁骨链', '颈链'] }], titles: ['白色锆石罗马项链女款搭配礼服高级感轻奢颈链简约百搭简单锁骨链', '鸽子蛋耳钉海莉女纯银单钻椭圆形人造钻石方糖锆石耳环耳骨钉', '不掉色原创免摘蛇骨链爱心定制字母十字架腰链项链钛钢饰品送礼', 'GARLAND加兰双生幸运兰钻石戒指 18K金 求婚定制'], tags: ['礼金直降', '满2件9.4折'] },
    { cat: 'c6-4', shop: 's8', price: [168, 1288], attrs: [{ name: '规格', values: ['3-4人', '5-8人', '8-10人'] }, { name: '颜色', values: ['军绿', '米白', '卡其'] }], titles: ['探险者帐篷野营过夜便携式折叠天幕二合一露营装备防暴雨自动野外', '帐篷天幕户外野营折叠便携式加厚过夜防雨保暖露营装备全套全自动', '探险者户外露营全套装备折叠便携式野营过夜防雨加厚自动天幕', 'Osprey小鹰魔爪22 男女徒步包登山包旅行骑行双肩包环保限定'], tags: ['退货宝', '包邮'] },
    { cat: 'c8-1', shop: 's4', price: [9.9, 168], attrs: [{ name: '口味', values: ['原味', '奶油味', '椒盐味'] }, { name: '规格', values: ['250g', '500g', '1kg礼盒'] }], titles: ['三只松鼠 每日坚果礼盒 750g/30袋 混合坚果零食大礼包', '三只松鼠 夏威夷果 奶油味 坚果炒货孕妇零食', '三只松鼠 肉松饼 1kg 整箱早餐糕点面包零食', '【李佳琦直播间双11超级零食节】舒适达清新护齿健牙膏任选'], tags: ['直接下单享优惠', '包邮'] },
    { cat: 'c4-1', shop: 's10', price: [399, 6999], attrs: [{ name: '颜色', values: ['原木色', '胡桃色', '黑胡桃'] }, { name: '尺寸', values: ['1.2m', '1.5m', '1.8m'] }], titles: ['源氏木语 实木床 现代简约橡木双人床 1.8米 北欧主卧大床', '源氏木语 实木书桌 家用电脑桌 樱桃木学习桌 办公桌', '源氏木语 实木餐桌椅组合 岩板餐桌 小户型家用饭桌', '源氏木语 实木沙发 北欧小户型客厅 布艺三人位'], tags: ['国补低至6折', '送货上门'] },
    { cat: 'c1-1', shop: 's11', price: [29, 55000], attrs: [{ name: '型号', values: ['标准版', 'OC超频版'] }], titles: ['华硕RTX5090夜神显卡32GB满血 DLSS4 三风扇散热全新正品质保三年', '全新5090显卡RTX5090 32G显卡ROG夜神华硕微星技嘉5080显卡现货', '膜法力适用iPhone折叠屏新款AR增透膜抗指纹秒贴手机贴膜全覆盖', '机械键盘 客制化 Gasket结构 三模热插拔 RGB 办公游戏'], tags: ['官方立减15%', '消费券'] },
    { cat: 'c1-2', shop: 's12', price: [0.88, 55], attrs: [{ name: '时长', values: ['1个月', '3个月', '12个月'] }], titles: ['Wordtune高级版独享内网安全语法同义改写', 'DeepL Pro会员翻译软件文档翻译神器沉浸式翻译', '分装【小厨屋】新品！布丁小厨日记胶带异形便签硫酸纸', '国考行测申论打印近十年B5题本仿考场排版副省级地市级'], tags: ['虚拟商品', '自动发货'] },
    { cat: 'c10-2', shop: 's3', price: [59, 899], attrs: [{ name: '规格', values: ['30ml', '50ml', '100ml'] }], titles: ['兰蔻小黑瓶精华肌底液 修护抗老 紧致淡纹', '雅诗兰黛 小棕瓶眼霜 淡化黑眼圈 抗皱紧致', 'SK-II 神仙水 精华露 230ml 平衡肌肤 焕亮水润', '珂润润浸保湿面霜 敏感肌可用 补水保湿'], tags: ['官方立减15%', '大促价保'] },
    { cat: 'c9-3', shop: 's5', price: [39, 599], attrs: [{ name: '款式', values: ['经典款', '联名款'] }], titles: ['【现货】正版PJSK世界计划六周年感谢祭系列拍立得小卡盲盒', '适用原神星稚梦旅系列蓝色58mm圆形徽章展示架谷美高透亚克力', '乐高积木 城市系列 警察局 儿童益智拼装玩具', '亲子户外拾秋落叶DIY相框拍照道具幼儿园自然主题手工树叶相框'], tags: ['官方立减15%', '包邮'] },
  ]

  const products: Product[] = []
  let pn = 0
  for (const t of tpls) {
    for (const title of t.titles) {
      pn++
      const id = `p${pn}`
      const price = Math.round((t.price[0] + rnd() * (t.price[1] - t.price[0])) * 100) / 100
      const skus: Product['skus'] = []
      const combos = (idx: number, cur: Record<string, string>) => {
        if (idx === t.attrs.length) { skus.push({ id: `${id}-sku${skus.length + 1}`, attrs: { ...cur }, price: Math.round(price * (1 + (skus.length % 3) * 0.08) * 100) / 100, stock: rint(0, 500) }); return }
        for (const v of t.attrs[idx].values) combos(idx + 1, { ...cur, [t.attrs[idx].name]: v })
      }
      combos(0, {})
      const sales = rint(0, 50000)
      const shop = shops.find(s => s.id === t.shop)!
      products.push({
        id, title, subtitle: pick(['官方正品 · 全国联保', '限时特惠 · 先到先得', '新品上市 · 抢先体验', '爆款热销 · 好评如潮', '']),
        images: [img(`${id}-1`, 800, 800), img(`${id}-2`, 800, 800), img(`${id}-3`, 800, 800), img(`${id}-4`, 800, 800), img(`${id}-5`, 800, 800)],
        price, originalPrice: Math.round(price * (1.15 + rnd() * 0.5) * 100) / 100, categoryId: t.cat, shopId: t.shop, sales,
        stock: skus.reduce((a, s) => a + s.stock, 0), rating: 4.5 + rnd() * 0.5, reviewCount: Math.floor(sales * 0.08),
        tags: t.tags ?? [], attrs: t.attrs, skus, status: (pn % 17 === 0 ? 'pending' : pn % 23 === 0 ? 'off' : 'on'),
        createdAt: daysAgo(rint(1, 400)), freeShipping: rnd() > 0.2, views: rint(100, 500000), favorites: rint(10, 50000),
        detail: `<p>${title}</p><p>${shop.name} 出品，品质保障。支持 7 天无理由退换，部分商品支持退货宝。</p>`,
      })
    }
  }

  // ---------- addresses ----------
  const addresses: Address[] = [
    { id: 'a1', userId: 'u-buyer-1', name: '希言', phone: '13800002008', country: 'CN', region: '浙江省 杭州市 余杭区', detail: '文一西路 969 号 淘宝城 3 号楼 12 层', isDefault: true },
    { id: 'a2', userId: 'u-buyer-1', name: '陈先生', phone: '13900001234', country: 'CN', region: '广东省 深圳市 南山区', detail: '科技园南区 深南大道 9988 号', isDefault: false },
  ]

  // ---------- orders ----------
  const statusPool: Order['status'][] = ['unpaid', 'paid', 'shipped', 'received', 'done', 'done', 'done', 'closed', 'refunding']
  const orders: Order[] = []
  const express = ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '京东物流', '极兔速递']
  for (let i = 0; i < 120; i++) {
    const p = pick(products)
    const second = rnd() > 0.7 ? pick(products.filter(x => x.shopId === p.shopId)) : null
    const sku = pick(p.skus)
    const qty = rint(1, 3)
    const items: Order['items'] = [{ productId: p.id, title: p.title, image: p.images[0], skuText: Object.values(sku.attrs).join(' / '), price: sku.price, qty }]
    if (second && second.id !== p.id) { const s2 = pick(second.skus); items.push({ productId: second.id, title: second.title, image: second.images[0], skuText: Object.values(s2.attrs).join(' / '), price: s2.price, qty: 1 }) }
    const total = Math.round(items.reduce((a, it) => a + it.price * it.qty, 0) * 100) / 100
    const freight = p.freeShipping ? 0 : 10
    const discount = rnd() > 0.5 ? Math.min(Math.round(total * 0.1), 50) : 0
    const status = i < 14 ? (['unpaid', 'paid', 'shipped', 'received', 'done', 'done', 'refunding', 'shipped', 'paid', 'done', 'closed', 'done', 'received', 'done'] as Order['status'][])[i] : pick(statusPool)
    const created = daysAgo(i < 14 ? i : rint(2, 180), rint(0, 23))
    const userId = i < 14 ? 'u-buyer-1' : pick(users.filter(u => u.role === 'buyer')).id
    const addr = addresses[0]
    const o: Order = {
      id: `${5127 + rint(100, 999)}${String(1000000000 + i * 7919 + rint(1, 999)).slice(-10)}`, userId, shopId: p.shopId, items, total, freight, discount,
      payAmount: Math.round((total + freight - discount) * 100) / 100, status, createdAt: created, address: { ...addr, userId },
    }
    if (status !== 'unpaid' && status !== 'closed') {
      o.paidAt = new Date(new Date(created).getTime() + 5 * 60000).toISOString()
      o.payment = { provider: pick(['wechat', 'alipay', 'unionpay', 'balance']), tradeNo: `${Date.now().toString().slice(0, 8)}${rint(100000, 999999)}` }
    }
    if (['shipped', 'received', 'done', 'refunding'].includes(status)) {
      const company = pick(express)
      o.shippedAt = new Date(new Date(created).getTime() + 86400000).toISOString()
      o.logistics = {
        company, no: `SF${rint(100000000000, 999999999999)}`,
        traces: [
          { time: new Date(new Date(created).getTime() + 86400000).toISOString(), text: `【杭州市】${company} 已收取快件` },
          { time: new Date(new Date(created).getTime() + 86400000 * 1.3).toISOString(), text: '【杭州市】快件已到达 杭州转运中心' },
          { time: new Date(new Date(created).getTime() + 86400000 * 2).toISOString(), text: '【杭州市】快件离开 杭州转运中心，发往 目的地' },
          ...(status !== 'shipped' ? [{ time: new Date(new Date(created).getTime() + 86400000 * 3).toISOString(), text: '【派送中】快递员 张师傅 18888888888 正在为您派送' }, { time: new Date(new Date(created).getTime() + 86400000 * 3.2).toISOString(), text: '【已签收】您的快件已由本人签收，感谢使用' }] : []),
        ],
      }
    }
    if (status === 'done' || status === 'received') o.doneAt = new Date(new Date(created).getTime() + 86400000 * 4).toISOString()
    orders.push(o)
  }

  // ---------- refunds ----------
  const refunds: Refund[] = orders.filter(o => o.status === 'refunding' || (o.status === 'done' && rnd() > 0.85)).map((o, i) => ({
    id: `R${20261000 + i}`, orderId: o.id, userId: o.userId, shopId: o.shopId, amount: o.payAmount,
    reason: pick(['七天无理由退换货', '质量问题', '商品与描述不符', '拍错/多拍/不想要', '物流问题']), type: rnd() > 0.5 ? 'refund' : 'return',
    status: o.status === 'refunding' ? 'pending' : pick(['approved', 'rejected', 'refunded']), createdAt: daysAgo(rint(0, 30)), desc: '申请退款，请商家尽快处理。',
  }))

  // ---------- reviews ----------
  const reviewTexts = ['质量很好，物流也快，客服态度很好，五星好评！', '包装精美，和描述的一样，很满意的一次购物。', '收到货了，比想象中好，做工精细，推荐购买。', '第二次回购了，一如既往的好，会推荐给朋友。', '性价比很高，发货速度快，好评。', '颜色很正，尺码标准，穿上很合身。', '用了一段时间才来评价，很好用，值得入手。', '一般般，和图片有些色差，但整体还行。']
  const reviews: Review[] = []
  products.forEach((p) => {
    const n = rint(2, 6)
    for (let i = 0; i < n; i++) {
      const u = pick(users.filter(x => x.role === 'buyer'))
      reviews.push({ id: `rv-${p.id}-${i}`, productId: p.id, userId: u.id, orderId: pick(orders).id, rating: rnd() > 0.15 ? 5 : rint(3, 4), content: pick(reviewTexts), images: rnd() > 0.6 ? [img(`rv-${p.id}-${i}`, 300, 300)] : [], createdAt: daysAgo(rint(1, 90)), skuText: Object.values(pick(p.skus).attrs).join(' '), reply: rnd() > 0.7 ? '感谢亲的支持，欢迎再次光临～' : undefined })
    }
  })

  // ---------- coupons ----------
  const coupons: Coupon[] = [
    { id: 'cp1', name: '双11 开门红 平台券', type: 'full', threshold: 300, value: 50, total: 100000, used: 48213, startAt: daysAgo(5), endAt: daysAgo(-10), status: 'active' },
    { id: 'cp2', name: '88VIP 专享 1555 元消费券', type: 'full', threshold: 1000, value: 155, total: 50000, used: 10212, startAt: daysAgo(3), endAt: daysAgo(-14), status: 'active' },
    { id: 'cp3', name: '新人无门槛 10 元', type: 'cash', threshold: 0, value: 10, total: 1000000, used: 530012, startAt: daysAgo(60), endAt: daysAgo(-300), status: 'active' },
    { id: 'cp4', name: '店铺满 200 减 30', shopId: 's6', type: 'full', threshold: 200, value: 30, total: 2000, used: 812, startAt: daysAgo(10), endAt: daysAgo(-5), status: 'active' },
    { id: 'cp5', name: '店铺 9 折券', shopId: 's3', type: 'discount', threshold: 0, value: 0.9, total: 5000, used: 4999, startAt: daysAgo(30), endAt: daysAgo(-2), status: 'active' },
    { id: 'cp6', name: '国补 家电 8.5 折', type: 'discount', threshold: 0, value: 0.85, total: 20000, used: 20000, startAt: daysAgo(40), endAt: daysAgo(1), status: 'expired' },
    { id: 'cp7', name: '店铺满 99 减 10', shopId: 's12', type: 'full', threshold: 99, value: 10, total: 500, used: 12, startAt: daysAgo(1), endAt: daysAgo(-30), status: 'paused' },
  ]

  // ---------- banners ----------
  const banners: Banner[] = [
    { id: 'b1', title: '服饰时尚', subtitle: '叠券低至7.2折起 · 大牌时髦秋冬焕新', gradient: 'linear-gradient(135deg,#ff6a3d 0%,#ff2e63 100%)', link: '/search?q=服饰', position: 'home-hero', status: 'on', sort: 1 },
    { id: 'b2', title: '潮电数码', subtitle: '抢24期免息 · 数码焕新不只5折', gradient: 'linear-gradient(135deg,#3d6dff 0%,#7b3dff 100%)', link: '/search?q=数码', position: 'home-hero', status: 'on', sort: 2 },
    { id: 'b3', title: '抢官方补贴', subtitle: '来领券中心 · 88VIP领1555元消费券', gradient: 'linear-gradient(135deg,#ff9f1c 0%,#ff4d00 100%)', link: '/my/coupons', position: 'home-hero', status: 'on', sort: 3 },
    { id: 'b4', title: '家享生活', subtitle: '叠国补低至6折 · 官方立减商品8.5折起', gradient: 'linear-gradient(135deg,#06b6a4 0%,#0ea5e9 100%)', link: '/search?q=家具', position: 'home-hero', status: 'on', sort: 4 },
    { id: 'b5', title: '爆款美味', subtitle: '食力全开 · 官方立减爆款8.5折起', gradient: 'linear-gradient(135deg,#f43f5e 0%,#fb923c 100%)', link: '/search?q=零食', position: 'home-hero', status: 'on', sort: 5 },
    { id: 'b6', title: '2026年双11全球狂欢季 活动补报进行中', subtitle: '立即报名', gradient: 'linear-gradient(90deg,#ff3b1f,#ff7a00)', link: '/seller/marketing', position: 'seller-top', status: 'on', sort: 1 },
  ]

  const announcements: Announcement[] = [
    { id: 'an1', title: '2026年双11招商规则发布', content: '双11活动报名通道已开启，请商家于11月1日前完成报名与商品提报。', audience: 'seller', createdAt: daysAgo(2), pinned: true },
    { id: 'an2', title: '首发！全新AI生意管家：双11全链路实战案例解读', content: 'AI 生意管家上线，支持智能客服、自动补货建议与营销诊断。', audience: 'seller', createdAt: daysAgo(3), pinned: false },
    { id: 'an3', title: '双11三大福利：生意管家助力商家大促新增长', content: '报名即享流量扶持、佣金减免与运费险补贴。', audience: 'seller', createdAt: daysAgo(4), pinned: false },
    { id: 'an4', title: '平台支付系统升级公告', content: '10月30日凌晨 2:00-4:00 进行支付网关升级，期间部分支付方式短暂不可用。', audience: 'all', createdAt: daysAgo(1), pinned: true },
    { id: 'an5', title: '退货宝服务费下调至 0.01 元', content: '升级生意卡，退货宝服务费低至 0.01 元。', audience: 'seller', createdAt: daysAgo(6), pinned: false },
  ]

  const paymentProviders: PaymentProvider[] = [
    { id: 'pay1', name: '微信支付', code: 'wechat', enabled: true, feeRate: 0.6, config: { appId: 'wx8e2f****', mchId: '1623****' }, logoColor: '#07c160', desc: '微信扫码 / H5 / JSAPI 支付' },
    { id: 'pay2', name: '支付宝', code: 'alipay', enabled: false, feeRate: 0.6, config: { appId: '2021****', gateway: 'openapi.alipay.com' }, logoColor: '#1677ff', desc: '预留接口，可随时接入' },
    { id: 'pay3', name: '银联云闪付', code: 'unionpay', enabled: true, feeRate: 0.5, config: { merId: '8989****' }, logoColor: '#e60012', desc: '银联二维码与网关支付' },
    { id: 'pay4', name: 'Stripe', code: 'stripe', enabled: true, feeRate: 2.9, config: { publishableKey: 'pk_live_****', webhook: 'https://plam.pages.dev/api/pay/stripe' }, logoColor: '#635bff', desc: '海外信用卡 / Apple Pay / Google Pay' },
    { id: 'pay5', name: 'PayPal', code: 'paypal', enabled: false, feeRate: 3.4, config: { clientId: 'AX****' }, logoColor: '#003087', desc: '跨境收款' },
    { id: 'pay6', name: '余额支付', code: 'balance', enabled: true, feeRate: 0, config: {}, logoColor: '#ff5000', desc: '平台账户余额' },
  ]

  const campaigns: Campaign[] = [
    { id: 'cm1', name: '2026 双11 全球狂欢季', type: 'festival', startAt: daysAgo(-3), endAt: daysAgo(-17), status: 'enrolling', products: ['p1', 'p2', 'p5', 'p9', 'p13'], discount: 0.72 },
    { id: 'cm2', name: '双11 开门红 · 叠券 7.2 折', type: 'festival', startAt: daysAgo(2), endAt: daysAgo(-1), status: 'running', products: ['p14', 'p15', 'p18', 'p22'], discount: 0.72 },
    { id: 'cm3', name: '百亿补贴 · 买贵必赔', type: 'subsidy', startAt: daysAgo(100), endAt: daysAgo(-200), status: 'running', products: ['p4', 'p5', 'p6', 'p41'], discount: 0.85 },
    { id: 'cm4', name: '限时秒杀 20:00 场', type: 'flash', startAt: daysAgo(0), endAt: daysAgo(-1), status: 'running', products: ['p30', 'p31', 'p36', 'p49'], discount: 0.5 },
    { id: 'cm5', name: '双12 年终盛典', type: 'festival', startAt: daysAgo(-40), endAt: daysAgo(-50), status: 'draft', products: [], discount: 0.8 },
  ]

  const auditLogs: AuditLog[] = Array.from({ length: 40 }, (_, i) => ({
    id: `log${i}`, actor: pick(['admin', 'ops_lee', 'risk_wang', 'finance_zhou']), action: pick(['审核通过商品', '冻结用户', '修改类目', '下架商品', '处理退款', '更新支付配置', '发布公告', '新增管理员', '导出订单']),
    target: pick(['p12', 'u-buyer-9', 'c5-1', 'R20261003', 'pay2', 'an4', 's10']), time: daysAgo(rint(0, 15), rint(0, 23)), ip: `${rint(10, 220)}.${rint(0, 255)}.${rint(0, 255)}.${rint(1, 254)}`,
  }))

  const messages: Message[] = [
    { id: 'm1', from: 'u-buyer-3', to: 's12', shopId: 's12', content: '亲，这个账号可以多设备登录吗？', time: daysAgo(0, 2), read: false },
    { id: 'm2', from: 's12', to: 'u-buyer-3', shopId: 's12', content: '您好，支持 2 台设备同时在线哦～', time: daysAgo(0, 1.8), read: true },
    { id: 'm3', from: 'u-buyer-5', to: 's12', shopId: 's12', content: '下单后多久发货？', time: daysAgo(0, 1), read: false },
    { id: 'm4', from: 'u-buyer-8', to: 's12', shopId: 's12', content: '可以开发票吗', time: daysAgo(1, 3), read: true },
    { id: 'm5', from: 'u-buyer-1', to: 's6', shopId: 's6', content: '100斤穿M码合适吗？', time: daysAgo(0, 5), read: true },
    { id: 'm6', from: 's6', to: 'u-buyer-1', shopId: 's6', content: '合适的呢亲，M 码建议 95-105 斤～', time: daysAgo(0, 4.9), read: true },
  ]

  const adminRoles: AdminRole[] = [
    { id: 'r1', name: '超级管理员', permissions: ['*'], members: 1 },
    { id: 'r2', name: '运营', permissions: ['product.audit', 'marketing.*', 'content.*', 'category.*'], members: 6 },
    { id: 'r3', name: '风控', permissions: ['user.freeze', 'shop.audit', 'refund.*', 'log.read'], members: 3 },
    { id: 'r4', name: '财务', permissions: ['finance.*', 'payment.read', 'settlement.*'], members: 2 },
    { id: 'r5', name: '客服', permissions: ['order.read', 'refund.read', 'user.read'], members: 12 },
  ]


  // ---------- 直播 ----------
  const liveTitles = ['上新，直接不赚啦～', '正在直播中', '双十一大漏，1折起', '上新', '欢迎光临省钱地标！', '捡漏了', '厂长不在 随便乱卖', '双十一珍珠全场1折送', '新品首发 直播间专享价', '清仓大处理中']
  const lives: LiveRoom[] = []
  const mkStats = (live: boolean): LiveRoom['stats'] => ({ viewers: live ? rint(300, 48000) : 0, views: rint(2000, 480000), peak: rint(800, 60000), likes: rint(5000, 900000), comments: rint(200, 30000), orders: rint(20, 2600), gmv: Math.round(rint(2000, 980000)), newFans: rint(10, 5000), clicks: rint(500, 90000), duration: rint(60, 420) })
  shops.slice(0, 11).forEach((sh, i) => {
    const ps = products.filter(p => p.shopId === sh.id && p.status === 'on').slice(0, 6)
    if (!ps.length) return
    const livePrices: Record<string, number> = {}
    ps.forEach(p => { livePrices[p.id] = Math.round(p.price * (0.7 + rnd() * 0.2) * 10) / 10 })
    lives.push({
      id: `lv-${sh.id}-1`, shopId: sh.id, hostId: sh.ownerId, title: liveTitles[i % liveTitles.length], cover: ps[0].images[0], categoryId: ps[0].categoryId.split('-')[0],
      status: i < 8 ? 'live' : 'scheduled', type: 'vertical', visibility: 'all', plannedAt: i < 8 ? daysAgo(0) : new Date(Date.now() + (i - 7) * 3.6e6 * 5).toISOString(), startedAt: i < 8 ? new Date(Date.now() - rint(20, 240) * 60000).toISOString() : undefined,
      trailer: true, showLocation: false, demo: true, productIds: ps.map(p => p.id), explainingId: i < 8 ? ps[rint(0, ps.length - 1)].id : undefined,
      notice: pick(['关注主播不迷路，整点抽免单', '直播间专享价，拍下立减', '新粉关注领 5 元无门槛券']), livePrices, stats: mkStats(i < 8), keypoints: [],
    })
  })
  // seller12 自己的历史场次 + 预告
  const mine = products.filter(p => p.shopId === 's12' && p.status === 'on').slice(0, 8)
  ;[3, 7, 12].forEach((d, i) => {
    const st = new Date(Date.now() - d * 864e5 - 2 * 3.6e6)
    const dur = rint(45, 180)
    const stats = mkStats(false); stats.views = rint(300, 4000); stats.peak = rint(40, 600); stats.likes = rint(200, 9000); stats.comments = rint(30, 900); stats.orders = rint(3, 60); stats.gmv = rint(300, 26000); stats.newFans = rint(2, 300); stats.clicks = rint(80, 3000); stats.duration = dur
    lives.push({ id: `lv-s12-h${i + 1}`, shopId: 's12', hostId: 'u-seller-12', title: ['周末福利专场', '新品试色', '清仓捡漏'][i], cover: mine[i]?.images[0] ?? img('live-s12'), categoryId: mine[0]?.categoryId.split('-')[0], status: 'ended', type: 'vertical', visibility: 'all', plannedAt: st.toISOString(), startedAt: st.toISOString(), endedAt: new Date(st.getTime() + dur * 60000).toISOString(), trailer: true, showLocation: false, productIds: mine.slice(0, 5).map(p => p.id), livePrices: {}, stats, keypoints: mine.slice(0, 3).map((p, j) => ({ productId: p.id, start: new Date(st.getTime() + j * 15 * 60000).toISOString(), end: new Date(st.getTime() + (j * 15 + 12) * 60000).toISOString(), clicks: rint(10, 400), orders: rint(0, 12) })) })
  })
  lives.push({ id: 'lv-s12-next', shopId: 's12', hostId: 'u-seller-12', title: '双11 预售开抢', cover: mine[3]?.images[0] ?? img('live-s12-next'), categoryId: mine[0]?.categoryId.split('-')[0], status: 'scheduled', type: 'vertical', visibility: 'all', plannedAt: new Date(Date.now() + 26 * 3.6e6).toISOString(), trailer: true, showLocation: false, productIds: mine.slice(0, 6).map(p => p.id), livePrices: {}, stats: mkStats(false), keypoints: [] })
  lives.forEach(l => { if (l.status === 'scheduled') l.stats = { ...l.stats, viewers: 0, views: 0, peak: 0, likes: 0, comments: 0, orders: 0, gmv: 0, newFans: 0, clicks: 0, duration: 0 } })
  const liveConfigs: LiveConfig[] = shops.map(sh => ({
    shopId: sh.id, nickname: sh.name.replace(/旗舰店|官方|专营店/g, '') + '直播间', intro: `欢迎来到${sh.name}直播间，关注主播不迷路，整点有福利～`,
    hideNames: true, aiReply: false, aiCard: true, strategy: true,
    autoReplies: [{ q: '怎么发货', a: '拍下 48 小时内发货，顺丰/中通包邮～' }, { q: '尺码', a: '宝贝详情页有尺码表，不确定可以留言身高体重哦' }, { q: '优惠', a: '直播间专享价已经是最低啦，关注领券再减 5 元' }],
    quickReplies: ['欢迎宝宝们来到直播间～', '关注主播不迷路', '这款直播间专享价，拍下立减', '稍等，马上讲解这款'],
    blockWords: ['广告', '加微信', '刷单'], mutedUsers: [],
    channels: { search: true, feed: true, shop: true, detail: true, outside: false },
    goods: { showPrice: true, showSales: true, autoPush: false, pushInterval: 5 }, gift: false, publicScreenAI: false, fps: 1, quality: 'mid',
  }))

  return { categories, shops, users, products, addresses, orders, refunds, reviews, coupons, banners, announcements, paymentProviders, campaigns, auditLogs, messages, adminRoles, lives, liveConfigs }
}

export const PERMISSIONS = [
  { group: '用户', items: ['user.read', 'user.freeze', 'user.edit'] },
  { group: '商家', items: ['shop.read', 'shop.audit', 'shop.close'] },
  { group: '商品', items: ['product.read', 'product.audit', 'product.off', 'category.*'] },
  { group: '订单', items: ['order.read', 'order.edit', 'refund.*'] },
  { group: '营销', items: ['marketing.*', 'content.*'] },
  { group: '财务', items: ['finance.*', 'payment.read', 'payment.edit', 'settlement.*'] },
  { group: '系统', items: ['role.*', 'log.read', 'setting.*'] },
]

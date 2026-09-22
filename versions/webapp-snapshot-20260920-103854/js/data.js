/* ============================================================
 * 竞品技术情报站 · 数据层
 * 数据来源：
 *  1) 2026年9月《汽车行业竞品车型与零部件新技术月报》—— 新车型(CARS)/新技术(TECHS)/趋势(TRENDS)
 *  2) 用户整理《竞品车数据、卖点、口碑(1).xlsx》—— 竞品库(COMP_CARS)：全参数+用户口碑+分组USP卖点
 * 口径说明：caliber 字段 —— 认证(工信部公告)/官方(企业发布)/媒体(垂直媒体)/竞品Excel(用户整理)
 * 图片：img 字段留空即显示"暂无图片"占位；获取官方授权实拍图后填入 URL 即可自动显示
 * ============================================================ */

// 往期月报池 —— 每个月报一个独立 data 文件，按月追加
// 切换时动态 fetch 对应文件并替换 CARS/TECHS/TRENDS；竞品库(COMP_CARS/PROJECTS)为跨月共享参考库
const MONTHLY_POOL = [
  { month: '2026-09', label: '2026年9月', file: 'js/data.js', isCurrent: true },
  { month: '2026-08', label: '2026年8月', file: 'js/data-202608.js' },
  { month: '2026-07', label: '2026年7月', file: 'js/data-202607.js' },
  { month: '2026-06', label: '2026年6月', file: 'js/data-202606.js' }
];

// 26个功/性能维度（7大板块）
const DOMAINS = [
  // SE1 新车吸引力（2）
  { key: 'styling',      name: '造型美学',   group: 'se1' },
  { key: 'perceived',    name: '感知质量',   group: 'se1' },
  // SE2 使用舒适（5）
  { key: 'hmi',          name: '人机友好性', group: 'se2' },
  { key: 'airquality',   name: '空气质量',   group: 'se2' },
  { key: 'thermal',      name: '热学舒适',   group: 'se2' },
  { key: 'seat',         name: '座椅舒适性', group: 'se2' },
  { key: 'nvh',          name: 'NVH舒适性',  group: 'se2' },
  // SE3 动态行驶（3）
  { key: 'power',        name: '纵向动力性', group: 'se3' },
  { key: 'handling',     name: '动态操稳',   group: 'se3' },
  { key: 'offroad',      name: '越野通过性', group: 'se3' },
  // SE4 整车安全（3）
  { key: 'safeprevent',  name: '监控预防',   group: 'se4' },
  { key: 'crash',        name: '碰撞保护',   group: 'se4' },
  { key: 'antitheft',    name: '防盗防灾',   group: 'se4' },
  // SE5 节能经济（3）
  { key: 'energy',       name: '能耗与续航', group: 'se5' },
  { key: 'charging',     name: '充放电',     group: 'se5' },
  { key: 'cost',         name: '用车成本',   group: 'se5' },
  // SE6 智舱智驾（3）
  { key: 'interaction',  name: '人机交互',   group: 'se6' },
  { key: 'infotainment', name: '娱乐互联',   group: 'se6' },
  { key: 'adas',         name: '智能驾驶',   group: 'se6' },
  // SE7 适应环境（7）
  { key: 'durability',   name: '可靠耐久',   group: 'se7' },
  { key: 'waterproof',   name: '防尘防水',   group: 'se7' },
  { key: 'weathering',   name: '整车耐候性', group: 'se7' },
  { key: 'corrosion',    name: '抗腐蚀老化', group: 'se7' },
  { key: 'emc',          name: '电磁兼容性', group: 'se7' },
  { key: 'emissions',    name: '挥发和排放', group: 'se7' },
  { key: 'recycle',      name: '回收再循环', group: 'se7' },
];
// 板块定义
const DOMAIN_GROUPS = [
  { key: 'se1', name: '新车吸引力', short: 'SE1', color: '#e8b830' },
  { key: 'se2', name: '使用舒适',   short: 'SE2', color: '#35d0e0' },
  { key: 'se3', name: '动态行驶',   short: 'SE3', color: '#ff6b4a' },
  { key: 'se4', name: '整车安全',   short: 'SE4', color: '#e84545' },
  { key: 'se5', name: '节能经济',   short: 'SE5', color: '#52c878' },
  { key: 'se6', name: '智舱智驾',   short: 'SE6', color: '#a878f0' },
  { key: 'se7', name: '适应环境',   short: 'SE7', color: '#c8a878' },
];

// 口径徽章样式映射
const CALIBER = {
  cert:     { label: '认证口径', cls: 'b-cert' },
  official: { label: '官方口径', cls: 'b-official' },
  media:    { label: '媒体口径', cls: 'b-media' },
  excel:    { label: 'AI梳理·汽车之家整理核对', cls: 'b-excel' }
};

// ---------- 竞品库（DH7项目竞品 · AI梳理，来源：官网/汽车之家/懂车帝；近3-6个月同级新车/换代） ----------
// specs 键名与用户整理的 DH7 竞品参数表一致；uspGroups 为分组卖点（AI梳理+核对）
const COMP_CARS = [
  {
    id: 'mona-m03', name: '小鹏MONA M03 2026款 540 长续航 Plus', brand: '小鹏汽车', seg: '紧凑型车',
    img: 'img/mona-m03.jpg', caliber: 'excel',
    src: '汽车之家（DH7竞品参数库·AI搜集梳理）',
    specs: {
      '售价 万': '11.98', '上市时间': '2026-04-02', '厂商': '小鹏汽车', '级别': '紧凑型车', '能源类型': '纯电动',
      '最大功率 kW': '160', '最大扭矩 Nm': '250',
      '车身结构': '5门5座掀背车', '车身形式': '承载式', '长 mm': '4785', '宽 mm': '1896', '高 mm': '1445', '轴距 mm': '2815',
      '前轮距 mm': '1628', '后轮距 mm': '1628', '接近角 °': '12', '离去角 °': '17', '前备箱容积': '—',
      '最小转弯直径 m': '10.6', '零百加速 s': '7.4', '最高车速 km/h': '170', '风阻系数 Cd': '0.194',
      '百公里电耗 kWh/100KM': '—', '纯电续航 km': '540(CLTC)', '整备质量 kg': '1675', '最大满载质量 kg': '2050',
      '前电机功率 Kw': '160', '前电机扭矩 Nm': '250', '后电机功率 Kw': '—', '后电机扭矩 Nm': '—',
      '电池能量 kWh': '51.8', '电池类型': '磷酸铁锂', '充电时间 h': '0.43', '变速箱': '单档变速箱', '四驱形式': '电动前驱',
      '前悬架类型': '麦弗逊', '后悬架类型': '扭力梁', '可变悬架功能': '无', '轮胎': '215/50 R18 235/40 R19可选', '备胎': '无'
    },
    reviews: {
      good: ['续航真实（达成率85%-90%）', '智驾体验好', '掀背大空间实用'],
      bad: ['高速胎噪/风噪偏大', '内饰塑料感较强', '中控杯架数量少']
    },
    uspGroups: [
      { group: '智能驾驶', items: [
        { t: '图灵AI智驾', d: '第二代图灵AI智驾芯片算力1500TOPS；VLA端到端大模型；全场景智驾覆盖' },
        { t: '主动安全', d: '15项主动安全+爆胎稳行+冰雪场景AES' }]},
      { group: '三电', items: [
        { t: '续航能耗', d: '同级领先续航与超低电耗' },
        { t: '超快充', d: '3C快充10分钟补能265km' },
        { t: '智能热管理', d: 'XP-HP3.5智能热管理系统，冬季空调能耗降低50%' }]},
      { group: '空间与装载', items: [{ t: '后备箱', d: '掀背式尾门600L超大后备箱' }]},
      { group: '座舱体验', items: [{ t: '音响系统', d: '20扬声器，7.1.4全景声' }]}
    ]
  },
  {
    id: 'mona-l03', name: '小鹏MONA L03', brand: '小鹏汽车', seg: '紧凑型SUV',
    img: 'img/mona-l03.jpg', caliber: 'excel',
    src: '汽车之家（DH7竞品参数库·AI搜集梳理）',
    specs: {
      '售价 万': '12.38', '上市时间': '2023.8', '厂商': '小鹏汽车', '级别': '紧凑型SUV', '能源类型': '纯电动',
      '最大功率 kW': '183', '最大扭矩 Nm': '280',
      '车身结构': '5门5座SUV', '车身形式': '承载式', '长 mm': '4650', '宽 mm': '1920', '高 mm': '1600', '轴距 mm': '2850',
      '前轮距 mm': '1640', '后轮距 mm': '1658', '接近角 °': '16', '离去角 °': '21', '前备箱容积': '—',
      '最小转弯直径 m': '10.5', '零百加速 s': '7.5', '最高车速 km/h': '180', '风阻系数 Cd': '0.228',
      '百公里电耗 kWh/100KM': '11.5', '纯电续航 km': '550（CLTC）', '整备质量 kg': '1855', '最大满载质量 kg': '2295',
      '前电机功率 Kw': '—', '前电机扭矩 Nm': '—', '后电机功率 Kw': '183', '后电机扭矩 Nm': '280',
      '电池能量 kWh': '56', '电池类型': '磷酸铁锂', '充电时间 h': '0.26', '变速箱': '单档变速箱', '四驱形式': '电动后驱',
      '前悬架类型': '麦弗逊', '后悬架类型': '五连杆', '可变悬架功能': '无', '轮胎': '225/60 R18 / 245/45 R20可选', '备胎': '无'
    },
    reviews: {
      good: ['智驾是杀手锏', '设计颜值高', '储物能力强（539L后备箱+102L前备箱）'],
      bad: ['后排头部空间一般', '400V平台', '入门版后扭力梁', '无框车门隔音有妥协']
    },
    uspGroups: [
      { group: '空气动力学', items: [{ t: '风阻系数', d: 'Cd0.228超低风阻' }]},
      { group: '三电', items: [
        { t: '电池安全', d: '24项新国标电池安全测试' },
        { t: '续航里程', d: '纯电最高650km/增程综合1380km' }]},
      { group: '智能驾驶', items: [
        { t: '算力平台', d: '双图灵芯片，总算力1500TOPS' },
        { t: '显示系统', d: '26.8英寸W-HUD+15.6英寸2.5K中控屏' }]},
      { group: '空间与装载', items: [{ t: '储物空间', d: '102L前备箱+539L后备箱+全车40处储物空间' }]},
      { group: '底盘操控', items: [{ t: '悬架制动', d: '后五连杆独立悬架；DCC动态底盘控制；IPB集成线控制动' }]},
      { group: '舒适体验', items: [{ t: '防晕车', d: '智能防晕车模式，抑制加减速晕眩' }]},
      { group: '安全', items: [{ t: '车身被动安全', d: '2000MPa热成型钢+7安全气囊' }]}
    ]
  },
  {
    id: 'mg-07', name: 'MG 07 2026款 纯电650', brand: '上汽集团', seg: '中型车',
    img: 'img/mg-07.jpg', caliber: 'excel',
    src: '汽车之家（DH7竞品参数库·AI搜集梳理）',
    specs: {
      '售价 万': '11.69', '上市时间': '2026-08-21', '厂商': '上汽集团', '级别': '中型车', '能源类型': '纯电动',
      '最大功率 kW': '176', '最大扭矩 Nm': '300',
      '车身结构': '5门5座掀背车', '车身形式': '承载式', '长 mm': '4886', '宽 mm': '1900', '高 mm': '1478', '轴距 mm': '2825',
      '前轮距 mm': '1640', '后轮距 mm': '1644', '接近角 °': '14', '离去角 °': '19', '前备箱容积': '168L',
      '最小转弯直径 m': '10.72', '零百加速 s': '6.9', '最高车速 km/h': '200', '风阻系数 Cd': '—',
      '百公里电耗 kWh/100KM': '—', '纯电续航 km': '530(CLTC)', '整备质量 kg': '1810', '最大满载质量 kg': '2254',
      '前电机功率 Kw': '176', '前电机扭矩 Nm': '300', '后电机功率 Kw': '—', '后电机扭矩 Nm': '—',
      '电池能量 kWh': '67', '电池类型': '半固态电池', '充电时间 h': '0.33', '变速箱': '单档变速箱', '四驱形式': '电动前驱',
      '前悬架类型': '麦弗逊', '后悬架类型': '多连杆', '可变悬架功能': '软硬调节', '轮胎': '225/50 R18', '备胎': '无'
    },
    reviews: {
      good: ['mCDC电磁悬架是惊喜', '底盘扎实有韧劲', '性价比高'],
      bad: ['高速风噪/胎噪（无框车门）', '后排头部空间一般', '座椅按摩力度偏轻']
    },
    uspGroups: [
      { group: '三电', items: [
        { t: '续航里程', d: '845km超长续航' },
        { t: '高压快充', d: '800V高压平台+5C超充' },
        { t: '电机散热', d: 'HeatMatrix主动散热电机（全球首款）' },
        { t: '集成电驱', d: '18合1集成电驱（全球首个）' }]},
      { group: '底盘操控', items: [
        { t: '电磁悬架', d: 'mCDC电磁悬架每秒200次实时调节' },
        { t: '预瞄系统', d: 'AI魔毯预瞄系统；预瞄距离15-150米' }]},
      { group: '智能驾驶', items: [{ t: '全场景智驾', d: '104项智驾功能；Momenta R7智驾方案；激光雷达' }]},
      { group: '安全', items: [{ t: '车身刚性', d: '高强度钢占比85%；车身扭转刚度43972N·m/deg' }]},
      { group: '空间与装载', items: [{ t: '储物空间', d: '168L前备箱+697L后备箱' }]},
      { group: '座舱体验', items: [
        { t: '车载冰箱', d: '30L双温区车载冰箱' },
        { t: '音响系统', d: '7.1.4声道21扬声器' },
        { t: '天幕', d: '1.33㎡可调光天幕' }]}
    ]
  },
  {
    id: 'seal-06', name: '海豹06 2027款 EV 530', brand: '比亚迪', seg: '中型车',
    img: 'img/seal-06.jpg', caliber: 'excel',
    src: '汽车之家（DH7竞品参数库·AI搜集梳理）',
    specs: {
      '售价 万': '10.99', '上市时间': '2026-08-11', '厂商': '比亚迪', '级别': '中型车', '能源类型': '纯电动',
      '最大功率 kW': '120', '最大扭矩 Nm': '205',
      '车身结构': '4门5座三厢车', '车身形式': '承载式', '长 mm': '4870', '宽 mm': '1890', '高 mm': '1495', '轴距 mm': '2820',
      '前轮距 mm': '1620', '后轮距 mm': '1620', '接近角 °': '13', '离去角 °': '14', '前备箱容积': '115L',
      '最小转弯直径 m': '11.1', '零百加速 s': '9.6', '最高车速 km/h': '170', '风阻系数 Cd': '—',
      '百公里电耗 kWh/100KM': '10.7', '纯电续航 km': '530(CLTC)', '整备质量 kg': '1670', '最大满载质量 kg': '2095',
      '前电机功率 Kw': '—', '前电机扭矩 Nm': '—', '后电机功率 Kw': '120', '后电机扭矩 Nm': '205',
      '电池能量 kWh': '52.868', '电池类型': '磷酸铁锂（第二代刀片电池）', '充电时间 h': '0.15', '变速箱': '单档变速箱', '四驱形式': '电动后驱',
      '前悬架类型': '双球节麦弗逊', '后悬架类型': '五连杆', '可变悬架功能': '软硬调节', '轮胎': '225/55 R17', '备胎': '无'
    },
    reviews: {
      good: ['空间大', '云辇-C底盘舒适', '配置高（W-HUD、无线快充等）'],
      bad: ['120kW高速动力偏弱', '车宽1890mm停车不便', '新车气味大', '无备胎', '智驾包需加1.1万']
    },
    uspGroups: [
      { group: '三电', items: [
        { t: '整车平台', d: 'e平台3.0 Evo' },
        { t: '闪充技术', d: '闪充5分钟充好/9分钟充饱；-30℃低温仅多3分钟' },
        { t: '电池技术', d: '第二代刀片电池' }]},
      { group: '安全', items: [
        { t: '车身结构', d: 'CTB电池车身一体化' },
        { t: '被动安全', d: '7安全气囊' },
        { t: '爆胎稳行', d: '140km/h爆胎稳行' }]},
      { group: '底盘操控', items: [{ t: '智能悬架', d: '云辇-C智能阻尼车身控制系统' }]},
      { group: '智能驾驶', items: [{ t: '智驾方案', d: '天神之眼B激光版/天神之眼C' }]},
      { group: '空间', items: [
        { t: '轴距', d: '2820mm长轴距' },
        { t: '前备箱', d: '115L前备箱' }]},
      { group: '智能座舱', items: [{ t: '车机系统', d: 'DiLink150+DeepSeek大模型' }]}
    ]
  },
  {
    id: 'z7', name: '尚界Z7 2026款 Max', brand: 'SAIC 尚界', seg: '中大型车',
    img: 'img/z7.jpg', caliber: 'excel',
    src: '汽车之家（DH7竞品参数库·AI搜集梳理）',
    specs: {
      '售价 万': '21.98', '上市时间': '2026-04-22', '厂商': 'SAIC 尚界', '级别': '中大型车', '能源类型': '纯电动',
      '最大功率 kW': '264', '最大扭矩 Nm': '460',
      '车身结构': '5门5座掀背车', '车身形式': '承载式', '长 mm': '5036', '宽 mm': '1976', '高 mm': '1465', '轴距 mm': '3000',
      '前轮距 mm': '1715', '后轮距 mm': '1722', '接近角 °': '13', '离去角 °': '17', '前备箱容积': '90L',
      '最小转弯直径 m': '—', '零百加速 s': '5.47', '最高车速 km/h': '220', '风阻系数 Cd': '—',
      '百公里电耗 kWh/100KM': '—', '纯电续航 km': '732(CLTC)', '整备质量 kg': '2260', '最大满载质量 kg': '2700',
      '前电机功率 Kw': '—', '前电机扭矩 Nm': '—', '后电机功率 Kw': '264', '后电机扭矩 Nm': '460',
      '电池能量 kWh': '81', '电池类型': '磷酸铁锂', '充电时间 h': '0.25', '变速箱': '单档变速箱', '四驱形式': '电动后驱',
      '前悬架类型': '双叉臂', '后悬架类型': '多连杆', '可变悬架功能': '软硬调节', '轮胎': '245/50R19 245/45 R20可选', '备胎': '无'
    },
    reviews: {
      good: ['底盘圈粉（过弯侧倾小、指向精准）', '智驾标杆', '入门即满配', '预订量破8万台'],
      bad: ['上市时间短，暂未见集中负面反馈']
    },
    uspGroups: [
      { group: '智能驾驶', items: [{ t: '智驾系统', d: '华为乾崑智驾ADS 4.1，36+感知硬件（896线激光雷达+3×4D毫米波+11摄像头等）' }]},
      { group: '智能座舱', items: [
        { t: '健康座舱', d: '鸿蒙ALPS健康座舱系统' },
        { t: '零重力座椅', d: '零重力座椅' }]},
      { group: '三电', items: [
        { t: '高压平台', d: '华为巨鲸800V平台' },
        { t: '续航里程', d: 'CLTC续航最高905km' }]},
      { group: '性能', items: [{ t: '加速制动', d: '零百3.44s/百公里制动33.1m' }]},
      { group: '底盘操控', items: [
        { t: '操控性能', d: '最小转弯5.5m转弯半径/麋鹿86.2km/h' },
        { t: '底盘平台', d: '华为途灵智能底盘平台' }]},
      { group: '空间', items: [
        { t: '收纳空间', d: '41处收纳空间' },
        { t: '整车尺寸', d: '5036×1976×1465mm/轴距3000mm' }]},
      { group: '安全', items: [{ t: '车身材料', d: '2000MPa热成型钢' }]}
    ]
  },
  {
    id: 'ep-007', name: '奕派007 2026款 007+', brand: '奕派科技', seg: '中大型车',
    img: 'img/ep-007.jpg', caliber: 'excel',
    src: '汽车之家（DH7竞品参数库·AI搜集梳理）',
    specs: {
      '售价 万': '14.49', '上市时间': '2024.9', '厂商': '奕派科技', '级别': '中大型车', '能源类型': '纯电动',
      '最大功率 kW': '200', '最大扭矩 Nm': '310',
      '车身结构': '5门5座掀背车', '车身形式': '承载式', '长 mm': '4880', '宽 mm': '1915', '高 mm': '1476', '轴距 mm': '2915',
      '前轮距 mm': '1625', '后轮距 mm': '1635', '接近角 °': '14', '离去角 °': '15', '前备箱容积': '—',
      '最小转弯直径 m': '11.2', '零百加速 s': '5.7', '最高车速 km/h': '171', '风阻系数 Cd': '0.209',
      '百公里电耗 kWh/100KM': '12.6', '纯电续航 km': '650(CLTC)', '整备质量 kg': '1852', '最大满载质量 kg': '2279',
      '前电机功率 Kw': '—', '前电机扭矩 Nm': '—', '后电机功率 Kw': '200', '后电机扭矩 Nm': '310',
      '电池能量 kWh': '73.5', '电池类型': '磷酸铁锂', '充电时间 h': '0.27', '变速箱': '单档变速箱', '四驱形式': '电动后驱',
      '前悬架类型': '麦弗逊', '后悬架类型': '五连杆', '可变悬架功能': '无', '轮胎': '245/45 R19', '备胎': '无'
    },
    reviews: {
      good: ['懂车帝综合口碑4.56分居热门车系TOP1（外观4.86/性价比4.84/驾驶感受4.79）', '行驶稳定性、续航、后排空间、终身质保受认可'],
      bad: ['暂未见集中负面反馈']
    },
    uspGroups: [
      { group: '智能驾驶', items: [{ t: '智驾硬件', d: '天元T200智驾；华为MDC610芯片200TOPS；禾赛ATX激光雷达全系标配；29个感知硬件' }]},
      { group: '智能座舱', items: [
        { t: '座舱芯片', d: '天元智舱2.0+高通8295P芯片' },
        { t: 'AI语音', d: '文心一言+DeepSeek双AI大模型语音' }]},
      { group: '性能', items: [{ t: '动力性能', d: '纯电四驱400kW/零百3.7s/百公里制动34.5m' }]},
      { group: '三电', items: [
        { t: '超充', d: '800V高压平台；480kW超充功率' },
        { t: '续航里程', d: 'CLTC最高650km/增程综合1308km' }]},
      { group: '底盘操控', items: [{ t: '悬架系统', d: 'FSD可变阻尼悬架；前双叉臂后五连杆；50:50轴荷比' }]},
      { group: '空气动力学', items: [{ t: '风阻系数', d: '0.209超低风阻，红点设计奖' }]},
      { group: '安全', items: [{ t: '碰撞安全', d: 'C-NCAP五星安全；马赫电池通过六不怕测试' }]},
      { group: '配置', items: [{ t: '全系标配', d: '全系标配119项配置' }]}
    ]
  },
  {
    id: 'n7', name: '东风日产N7 2026款 625 PRO黑骑士', brand: '东风日产', seg: '中大型车',
    img: 'img/n7.jpg', caliber: 'excel',
    src: '汽车之家（DH7竞品参数库·AI搜集梳理）',
    specs: {
      '售价 万': '14.89', '上市时间': '2026-04-27', '厂商': '东风日产', '级别': '中大型车', '能源类型': '纯电动',
      '最大功率 kW': '200', '最大扭矩 Nm': '305',
      '车身结构': '4门5座三厢车', '车身形式': '承载式', '长 mm': '4967', '宽 mm': '1895', '高 mm': '1492', '轴距 mm': '2915',
      '前轮距 mm': '1634', '后轮距 mm': '1643', '接近角 °': '13', '离去角 °': '18', '前备箱容积': '—',
      '最小转弯直径 m': '11.6', '零百加速 s': '—', '最高车速 km/h': '160', '风阻系数 Cd': '0.208',
      '百公里电耗 kWh/100KM': '13.2', '纯电续航 km': '635', '整备质量 kg': '1949', '最大满载质量 kg': '2380',
      '前电机功率 Kw': '200', '前电机扭矩 Nm': '305', '后电机功率 Kw': '—', '后电机扭矩 Nm': '—',
      '电池能量 kWh': '73', '电池类型': '磷酸铁锂', '充电时间 h': '0.23', '变速箱': '单档变速箱', '四驱形式': '电动前驱',
      '前悬架类型': '麦弗逊', '后悬架类型': '多连杆', '可变悬架功能': '—', '轮胎': '235/45 R19', '备胎': '无'
    },
    reviews: {
      good: ['零压云毯座椅舒适', '防晕车技术好评', '滤震底盘', '静谧座舱'],
      bad: ['后排座椅不可调节', '车机智能化不高（应用少、语音识别简单）', '后备箱管线裸露', '无框车门高速风噪/路噪']
    },
    uspGroups: [
      { group: '座舱舒适', items: [{ t: 'AI座椅', d: 'AI零压云毯座椅，49柔性体压传感器；AI自适应贴合；主动侧翼支撑' }]},
      { group: '智能座舱', items: [{ t: '座舱系统', d: '高通8295P芯片；NISSAN OS车机；小尼语音（讯飞+DeepSeek）' }]},
      { group: '三电', items: [
        { t: '超快充', d: '天演800V平台+3C超快充' },
        { t: '续航里程', d: '625km续航/73kWh电池' },
        { t: '质保政策', d: '三电终身质保' }]},
      { group: '智能驾驶', items: [{ t: '智驾方案', d: 'Momenta端到端智驾，英伟达Orin芯片' }]},
      { group: '空间', items: [{ t: '尺寸得房率', d: '4967×1492×1487mm/轴距2915mm/83%得房率' }]},
      { group: '外观设计', items: [{ t: '黑骑士造型', d: '骑士锋刃美学+曜石黑黑骑士' }]},
      { group: '底盘操控', items: [{ t: '底盘调校', d: '日产GT-R团队底盘调校' }]},
      { group: '座舱体验', items: [{ t: '音响系统', d: '14扬声器' }]}
    ]
  }
];

// ---------- 对比表结构（行标签与 Excel Sheet1 一致，分组为UI归档） ----------
const COMP_GROUPS = [
  { name: '口碑与价格', rows: [
    ['用户好评',   c => (c.reviews.good || []).join('；')],
    ['用户差评',   c => (c.reviews.bad || []).join('；')],
    ['售价 万',    c => c.specs['售价 万'] ? c.specs['售价 万'] + ' 万' : '—'],
    ['上市时间',   c => c.specs['上市时间']],
    ['厂商',       c => c.specs['厂商']],
    ['级别',       c => c.specs['级别']]
  ]},
  { name: '动力与电驱', rows: [
    ['能源类型',     c => c.specs['能源类型']],
    ['最大功率 kW',  c => c.specs['最大功率 kW']],
    ['最大扭矩 Nm',  c => c.specs['最大扭矩 Nm']],
    ['前电机功率 Kw', c => c.specs['前电机功率 Kw']],
    ['前电机扭矩 Nm', c => c.specs['前电机扭矩 Nm']],
    ['后电机功率 Kw', c => c.specs['后电机功率 Kw']],
    ['后电机扭矩 Nm', c => c.specs['后电机扭矩 Nm']],
    ['变速箱',       c => c.specs['变速箱']],
    ['四驱形式',     c => c.specs['四驱形式']]
  ]},
  { name: '电池与续航', rows: [
    ['电池能量 kWh',          c => c.specs['电池能量 kWh']],
    ['电池类型',              c => c.specs['电池类型']],
    ['充电时间 h',            c => c.specs['充电时间 h']],
    ['纯电续航 km',           c => c.specs['纯电续航 km']],
    ['百公里电耗 kWh/100KM',  c => c.specs['百公里电耗 kWh/100KM']],
    ['风阻系数 Cd',           c => c.specs['风阻系数 Cd']]
  ]},
  { name: '车身与尺寸', rows: [
    ['车身结构',       c => c.specs['车身结构']],
    ['车身形式',       c => c.specs['车身形式']],
    ['长 mm',          c => c.specs['长 mm']],
    ['宽 mm',          c => c.specs['宽 mm']],
    ['高 mm',          c => c.specs['高 mm']],
    ['轴距 mm',        c => c.specs['轴距 mm']],
    ['前轮距 mm',      c => c.specs['前轮距 mm']],
    ['后轮距 mm',      c => c.specs['后轮距 mm']],
    ['接近角 °',       c => c.specs['接近角 °']],
    ['离去角 °',       c => c.specs['离去角 °']],
    ['前备箱容积',     c => c.specs['前备箱容积']],
    ['最小转弯直径 m', c => c.specs['最小转弯直径 m']],
    ['整备质量 kg',    c => c.specs['整备质量 kg']],
    ['最大满载质量 kg', c => c.specs['最大满载质量 kg']],
    ['备胎',           c => c.specs['备胎']]
  ]},
  { name: '性能与操控', rows: [
    ['零百加速 s',   c => c.specs['零百加速 s']],
    ['最高车速 km/h', c => c.specs['最高车速 km/h']]
  ]},
  { name: '底盘与悬架', rows: [
    ['前悬架类型',   c => c.specs['前悬架类型']],
    ['后悬架类型',   c => c.specs['后悬架类型']],
    ['可变悬架功能', c => c.specs['可变悬架功能']],
    ['轮胎',         c => c.specs['轮胎']]
  ]},
  { name: '核心USP卖点', rows: [
    ['USP分组',  c => c.uspGroups.map(g => g.group).join('、')],
    ['数据口径', c => CALIBER[c.caliber].label]
  ]}
];

// ---------- 项目-竞品关联 ----------
// 竞品来源：AI 按规则从官网/垂直媒体搜集梳理 —— 近3-6个月同级（DH7对标10-22万纯电）新车/换代，6/7款
const DH7_LEVEL = { seg: '中大型/中型纯电动（轿车/掀背）', range: '10-22万', note: '近3-6个月同级新车/换代' };
const PROJECTS = [
  {
    id: 'p1', code: 'DH7', name: 'DH7 项目', segment: '10-22万纯电动',
    desc: 'DH7 对标的同级竞品（近3-6个月新车/换代 · AI梳理，来源：官网/汽车之家/懂车帝等）',
    target: { price: '待定', usp: '待定' },
    competitors: ['mona-m03', 'mona-l03', 'mg-07', 'seal-06', 'z7', 'ep-007', 'n7']
  },
  {
    id: 'p2', code: 'DH7 走量版', name: 'DH7 走量版', segment: '10-15万性价比走量',
    desc: 'DH7 走量版对标的 15万以下 竞品（数据源：汽车之家/懂车帝 竞品参数配置库）',
    target: { price: '待定', usp: '待定' },
    competitors: ['mona-m03', 'mg-07', 'seal-06', 'ep-007', 'n7']
  }
];

// ---------- 竞品参数共同来源（汽车之家/懂车帝，2026用户经汽车之家整理核对） ----------
const COMP_SOURCE = '汽车之家（DH7竞品参数库）· 建议关键参数按认证口径复核';

// ---------- 新车型库（2026-09月报；img 为空 = 显示"暂无图片"占位） ----------
// 注：月报池切换时这四个 var 会被动态替换为其他月份的数据
var CARS = [
  {
    id: 'mega', name: '理想 MEGA 新一代', brand: '理想', power: '纯电', seg: '大型MPV',
    price: '50.98万', launchDate: '2026-09-02', range: 'CLTC纯电710km / 108kWh', adas: 'AD Max 800TOPS，4颗激光雷达', cockpit: '29英寸OLED 6K全景屏，高通8797', caliber: 'official',
    usp: ['双电机四驱，CLTC纯电续航710km，5C超充10%-80%约11分钟', '800V主动防倾魔毯底盘，后轮转向转弯半径5.5m，线控转向', 'Home Light客厅主灯+三独立天窗+五组电动遮阳帘，零重力旋转座椅'],
    desc: '理想官方9月2日上市，售价50.98万元，仅Home版单配置。风阻0.215为全球MPV最低水平；标配前后双零重力座椅、三排座椅通风加热；AD Max搭载两颗马赫M100芯片（2560TOPS）+4颗激光雷达。',
    src: '理想汽车官网上市新闻（USP）', srcUrl: 'https://www.lixiang.com/news/186.html',
    specsSrc: '汽车之家参数配置页（性能参数）', specsUrl: 'https://www.autohome.com.cn/config/series/6939.html',
    featured: true, featuredNote: '热销车系改款：理想旗舰MPV换代',
    dims: ['power', 'crash', 'charging', 'handling', 'adas', 'interaction', 'seat'],
    specs: {
      size: '5355×1965×1850mm / 轴距3300mm',
      power: '双电机四驱\n（1）前轴 华为感应异步电机 155kW / 232N·m\n（2）后轴 理想永磁同步电机 258kW / 425N·m\n综合 413kW(562Ps) / 657N·m',
      accel: '0-100km/h 4.9s', topSpeed: '200km/h',
      weight: '整备2925kg / 满载3475kg',
      fastCharge: '10%-80% 约11分钟，峰值520kW（108kWh 5C超充）',
      suspension: '前双叉臂+后H臂多连杆（双腔空悬+双阀CDC+800V主动防倾杆+后轮转向）',
      safety: '11安全气囊 / 2200MPa热成型钢 / 笼式车身'
    },
    img: 'img/mega.jpg'
  },
  {
    id: 'n8l', name: '腾势 N8L 纯电', brand: '腾势', power: '纯电', seg: '大六座SUV',
    price: '29.98万起', launchDate: '2026-09-14', range: 'CLTC纯电960km / 130.2kWh刀片电池', adas: '天神之眼5.0，Orin-X 254TOPS，1激光雷达', cockpit: '六屏联动，50英寸AR-HUD，迪迪虾智能体', caliber: 'media',
    usp: ['2+2+2大六座，定眩智能防晕车系统，副驾零重力座椅', '三排均双层隔音玻璃，迎宾光毯+悬架下降50mm', '全系标配天神之眼5.0 + Orin-X 254TOPS算力'],
    desc: '腾势9月14日上市，29.98万起。大六座豪华SUV，49处收纳空间；纯电版搭载130.2kWh刀片电池，CLTC纯电续航960km；双电机四驱370kW/500N·m。',
    src: '腾势官网产品页（USP）', srcUrl: 'https://www.denza.com/cn/product-detail/n8l.html',
    specsSrc: '汽车之家参数配置页（性能参数）', specsUrl: 'https://www.autohome.com.cn/config/series/8159.html',
    featured: false, featuredNote: '现有N8L车系纯电动力新增版本，非全新车型',
    dims: ['power', 'crash', 'charging', 'adas', 'interaction', 'seat'],
    specs: {
      size: '5200×1999×1820mm / 轴距3075mm',
      power: '双电机四驱\n综合 370kW(503Ps) / 500N·m',
      accel: '0-100km/h 6.4s', topSpeed: '240km/h',
      weight: '—',
      fastCharge: '—（官方未公布纯电版快充时间）',
      suspension: '空气悬架（软硬+高低可调）',
      safety: '标配前/侧/头部气囊+前排中间气囊'
    },
    img: 'img/n8l.jpg'
  },
  {
    id: 'ec6', name: '蔚来 EC6 2026款', brand: '蔚来', power: '纯电', seg: '轿跑SUV',
    price: '35.80万起 / BaaS 25.00万起', launchDate: '2026-09-02', range: 'CLTC 635-655km / 100kWh', adas: '神玑NX9031自研芯片(5nm)，1激光雷达', cockpit: '15.6英寸3K中控+19.4英寸W-HUD，23扬声器', caliber: 'media',
    usp: ['全系100kWh三元锂，CLTC续航635-655km', '双电机四驱360kW/700N·m，零百4.4s；3分钟换电+BaaS 25万起', '鹰尾双模主动升降尾翼（60km/h减阻/130km/h加压），冠军纪念版EP Mode'],
    desc: '蔚来2026款EC6全系标配神玑NX9031自研智驾芯片（5nm），冠军纪念版新增运动化CDC避震+强化防倾杆；风阻系数Cd 0.24。',
    src: '蔚来官网产品页（USP）', srcUrl: 'https://www.nio.cn/ec6',
    specsSrc: '汽车之家参数配置页（性能参数）', specsUrl: 'https://www.autohome.com.cn/config/series/5569.html',
    featured: true, featuredNote: '热销车系改款：蔚来经典轿跑SUV年度改款',
    dims: ['power', 'crash', 'charging', 'thermal', 'adas', 'interaction', 'hmi'],
    specs: {
      size: '4849×1995×1697mm / 轴距2915mm',
      power: '双电机四驱\n综合 360kW(490Ps) / 700N·m',
      accel: '0-100km/h 4.4s', topSpeed: '200km/h',
      weight: '整备2323kg / 满载2826kg',
      fastCharge: '10%-80% 36分钟（180kW）',
      suspension: '前/后五连杆（CDC动态悬架）',
      safety: 'C-NCAP未公布'
    },
    img: 'img/ec6.jpg'
  },
  {
    id: 'i60', name: '埃安 i60 2027款', brand: '广汽埃安', power: '增程+纯电', seg: '家用SUV',
    price: '10.36万起（权益后）', launchDate: '2026-09-15', range: '纯电520/700km ｜ 增程纯电350km/综合1738km', adas: '文远知行L4同源端到端，192线激光雷达', cockpit: '15.6英寸2.5K悬浮屏+8.88英寸仪表', caliber: 'media',
    usp: ['行业首创非晶合金电驱，电机损耗降低75%、效率99%，纯电续航最高700km', '增程版搭华为DriveONE电驱，纯电350km、综合1738km，亏电油耗3.6L', '192线激光雷达+27颗感知硬件，文远知行L4同源端到端大模型', '弹匣电池2.0累计装车超150万台；新增66L前备箱、后置充电口'],
    desc: '广汽埃安9月15日推出2027款i60，官方指导价11.16-14.28万元、权益价10.36万元起；纯电/增程双动力共7款配置，升级集中在电池、电驱、智行"科技三大件"。埃安i60已连续6个月月销破万，累计用户近10万。',
    src: '汽车之家车家号上市通稿（USP）', srcUrl: 'http://chejiahao.autohome.com.cn/info/26462035',
    specsSrc: '汽车之家参数配置页（性能参数）', specsUrl: 'https://www.autohome.com.cn/config/series/8245.html',
    featured: true, featuredNote: '热销车系改款：连续6个月销量破万',
    dims: ['power', 'charging', 'adas', 'interaction'],
    specs: {
      size: '4685×1854×1660mm（激光雷达版高1690mm）/ 轴距2775mm',
      power: '（1）纯电版：前驱单电机 165kW / 240N·m\n（2）增程版：1.5L增程器 + 华为DriveONE电驱系统',
      accel: '—', topSpeed: '—',
      weight: '—',
      fastCharge: '纯电版 30%-80% 22分钟；增程版 30%-80% 15分钟',
      suspension: '—',
      safety: '6安全气囊（激光雷达版）'
    },
    img: 'img/i60.jpg'
  },
  {
    id: 'tt', name: '吉利银河 TT', brand: '吉利银河', power: '纯电', seg: '运动轿车',
    price: '限时先享12.99万起（指导价13.99-19.59万）', launchDate: '2026-09-10', range: 'CLTC 640/725km ｜ 全域800V', adas: '千里浩瀚G-ASD，车顶激光雷达', cockpit: '15.4英寸2.5K中控+10.2英寸仪表+25.6英寸AR-HUD', caliber: 'media',
    usp: ['全域800V+6C超充：11分钟补能近500km；风阻系数0.22', '108颗LED星钻贯穿尾灯，悬浮星钻前大灯超125m近光/超245m远光', '路特斯调校底盘，前全铝双叉臂+后五连杆'],
    desc: '吉利银河TT 9月10日正式上市，官方指导价13.99-19.59万元、上市限时先享价12.99万元起（权益截至10月7日），共5款版型；C级AI纯电运动轿车，CLTC续航640/725km，主打"好看好开好玩"。',
    src: '吉利银河官网产品页（USP）', srcUrl: 'https://www.galaxy-geely.com/YHTT',
    specsSrc: '汽车之家参数配置页（性能参数）', specsUrl: 'https://www.autohome.com.cn/config/series/8658.html',
    featured: true, featuredNote: '全新车型：吉利银河首款C级纯电运动轿车',
    dims: ['power', 'charging', 'handling', 'thermal', 'adas', 'interaction'],
    specs: {
      size: '4999×1919×1479mm / 轴距2920mm',
      power: '（1）后驱版：245kW / 320N·m\n（2）Ultra四驱：425kW(575Ps) / 597N·m',
      accel: '0-100km/h 6.5s（后驱）/ 3.8s（Ultra）', topSpeed: '201km/h（Ultra 210）',
      weight: '整备1895-2090kg / 满载2315-2510kg',
      fastCharge: '6C超充11分钟补能近500km（官方口径），全域800V',
      suspension: '前全铝双叉臂+后五连杆（路特斯调校，FSD可变阻尼）',
      safety: 'C-NCAP未公布'
    },
    img: 'img/tt.jpg'
  },
  {
    id: 'yueyi07', name: '悦意 07（奔腾）', brand: '一汽奔腾', power: '插混', seg: '家用SUV',
    price: '12.49万起', launchDate: '2026-09-15', range: 'CLTC纯电150/235km ｜ 综合1655km', adas: 'L2级辅助驾驶（235km乐享版起）', cockpit: '12.6英寸悬浮中控屏，乐播投屏', caliber: 'media',
    usp: ['逐日动力BMP超级电混（越影平台），CLTC纯电最高235km、综合续航1655km', 'AI"如意座舱"，12.6英寸悬浮中控屏，支持乐播投屏', 'L2级辅助驾驶（235km乐享版起配）'],
    desc: '一汽奔腾9月15日推出2027款悦意07（12.49万元起），悦意P系列超级电混SUV年度改款，提供150km/235km两种纯电续航版本。',
    src: '中国一汽官网2027款上市新闻（USP）', srcUrl: 'https://www.faw.com.cn/fawcn/373694/373706/5963915/index.html',
    specsSrc: '汽车之家参数配置页（性能参数）', specsUrl: 'https://www.autohome.com.cn/config/series/7978.html',
    featured: false, featuredNote: '改款但基础车月销仅约41辆，未达热销标准',
    dims: ['power', 'charging', 'crash', 'adas', 'interaction'],
    specs: {
      size: '4745×1880×1680mm / 轴距2772mm',
      power: '前驱 PHEV\n1.5T 110kW/225N·m + 电机 168kW/340N·m',
      accel: '0-100km/h 6.9s', topSpeed: '180km/h',
      weight: '—',
      fastCharge: '30%-80% 约18-19分钟（0.3-0.32h）',
      suspension: '前麦弗逊+后多连杆',
      safety: '十佳车身架构（C-NCAP未公布）'
    },
    img: 'img/yueyi07.jpg'
  },
  {
    id: 'n70', name: '小米澎程 N70', brand: '小米', power: '纯电', seg: '跨界SUV',
    price: '20.99万起', launchDate: '2026-09（本月）', range: 'Pro纯电351km/综合1351km ｜ Max纯电505km/综合1461km', adas: '小米HAD，激光雷达+英伟达Thor-U 700TOPS', cockpit: '16.1英寸3K中控+8.88英寸仪表+20英寸HUD', caliber: 'media',
    usp: ['昆仑架构首款增程SUV，大五座纯平地板2584mm', '二排座椅后移腿部空间1410mm，后备厢常规1203L', 'Pro版涉水600mm/Max版650mm应急浮水脱困'],
    desc: '小米汽车9月7日上市，Pro 20.99万 / Max 23.99万；增程动力，Max版CLTC纯电续航505km；全系标配激光雷达+英伟达Thor-U智驾芯片。',
    src: '小米汽车官网产品页（USP）', srcUrl: 'https://www.xiaomiev.com/skynomad/n70',
    specsSrc: '汽车之家参数配置页（性能参数）', specsUrl: 'https://www.autohome.com.cn/config/series/8731.html',
    featured: true, featuredNote: '全新车型：小米澎程品牌第二款车型',
    dims: ['power', 'charging', 'crash', 'handling', 'adas', 'interaction', 'waterproof'],
    specs: {
      size: '4960×1998×1785mm（Max版高1765）/ 轴距2950mm',
      power: '（1）Pro增程 单电机后驱 210kW / 330N·m\n（2）Max增程 双电机四驱 310kW / 540N·m\n（全系搭载1.5T增程器）',
      accel: '0-100km/h 7.9s（Pro）/ 5.5s（Max）', topSpeed: '190km/h',
      weight: '整备2453kg(Pro)/2561kg(Max) / 满载2892/3000kg',
      fastCharge: '20%-80% 18分钟（0.3h）',
      suspension: '前双叉臂+后多连杆（Max版空悬+连续阻尼减振）',
      safety: '9安全气囊 / 高强度钢铝占比91.3% / 2200MPa热成型钢'
    },
    img: 'img/n70.jpg'
  },
  {
    id: 'zj700', name: '吉利银河战舰 700', brand: '吉利银河', power: '插混', seg: '高性能SUV',
    price: '预售19.98-38.98万', launchDate: '2026-09-15（预售）', range: 'CLTC纯电270/280/305km ｜ 综合至高1770km', adas: '千里浩瀚H7，192线激光雷达+700TOPS，D2D车位到车位领航', cockpit: 'FlymeAuto2五屏联动，18.5L冷暖冰箱', caliber: 'media',
    usp: ['2.0T三电机四驱插混，综合功率1129马力/830kW，零百3.95s', '47.14kWh宁德电池+6C超充10%-80%仅10分钟，CDC双腔空悬', 'FlymeAuto2五屏联动，18.5L冷暖冰箱'],
    desc: '吉利银河战舰700于9月15日开启预售，预售19.98-38.98万元（含限量陆地方舟版），共三款动力六款版型；AI全地形硬核中大型SUV，全系47.14kWh宁德电池，搭载千里浩瀚H7智驾。',
    src: '吉利银河官网预售页（USP）', srcUrl: 'https://www.galaxy-geely.com/ZJ700',
    specsSrc: '汽车之家参数配置页（性能参数）', specsUrl: 'https://www.autohome.com.cn/config/series/8131.html',
    featured: true, featuredNote: '全新车型：吉利银河首款硬派越野SUV',
    dims: ['power', 'charging', 'crash', 'handling', 'adas', 'interaction'],
    specs: {
      size: '5085×1999×1895/1912/1925mm / 轴距2900mm（接近角30°/离去角31°/离地233mm）',
      power: '雷神EM-T PHEV（三套动力）\n（1）1.5T两驱：CLTC纯电305km\n（2）1.5T三电机四驱：CLTC纯电280km\n（3）2.0T三电机四驱：CLTC纯电270km，综合830kW(1129Ps)',
      accel: '0-100km/h 3.95s（2.0T三电机版）', topSpeed: '220km/h',
      weight: '—',
      fastCharge: '10%-80% 10分钟（6C超充，全系47.14kWh宁德电池）',
      suspension: '前后铝合金双叉臂（双腔空簧+CCD+魔毯预瞄）',
      safety: '6横7纵8环笼式车身+一体式大梁 / 扭转刚度超41000N·m/deg / 车顶抗压16吨 / 11根2200MPa隐藏式防滚架'
    },
    img: 'img/zj700.jpg'
  },
  {
    id: 'at7', name: '极狐阿尔法 T7', brand: '极狐', power: '纯电', seg: '中型SUV',
    price: '13.68万起（上市补贴价13.28万起）', launchDate: '2026-09-16（已上市）', range: '纯电650/715km ｜ 增程纯电320km/综合1315km', adas: '华为乾崑ADS 5 Pro（WEWA 2.0），27颗感知硬件', cockpit: '1.1米P-HUD天际屏+17.3英寸3K中控，4nm芯片，国家大剧院声学', caliber: 'media',
    usp: ['全系标配宁德时代电池，纯电715km/增程综合1315km，馈电油耗5.58L', '800V高压碳化硅平台，15分钟补能370km，兼容国标桩', '华为乾崑ADS 5 Pro下放15万级：高速NCA平均1500km近零接管，AEB 130km/h刹停', '5米级大五座得房率88.8%，200L电动前备箱，预售21天订单破6万'],
    desc: '极狐阿尔法T7 9月16日上市，指导价13.68-17.28万元、上市补贴价13.28万元起；纯电/增程双动力共9款版型，定位智美AI越级大五座SUV，由华为、宁德时代、麦格纳、国家大剧院等联合赋能。',
    src: '极狐官网T7产品页（USP）', srcUrl: 'https://www.arcfox.com.cn/T7/index.html',
    specsSrc: '汽车之家参数配置页（性能参数）', specsUrl: 'https://www.autohome.com.cn/config/series/8702.html',
    featured: true, featuredNote: '全新车型：极狐全新中大型SUV（非阿尔法T改款）',
    dims: ['power', 'charging', 'handling', 'adas', 'interaction'],
    specs: {
      size: '5020×1996×1685mm / 轴距3040mm',
      power: '（1）纯电版：后驱单电机 227kW / 334N·m\n（2）增程版：1.5L增程器(77kW) + 后驱电机 200kW / 334N·m',
      accel: '—', topSpeed: '—',
      weight: '—',
      fastCharge: '30%-80% 15分钟（800V高压平台）',
      suspension: '前麦弗逊+后多连杆（CDC电控阻尼，麦格纳调校）',
      safety: 'C-NCAP未公布'
    },
    img: 'img/at7.jpg'
  },
  {
    id: 'yue7', name: '广汽传祺越 7', brand: '广汽传祺', power: '插混', seg: '方盒子SUV',
    price: '预售17.18万起', launchDate: '2026-09（预售）', range: 'CLTC纯电161/261km ｜ 综合超1200km', adas: 'ADiGO高阶领航，激光雷达+3nm高通8838芯片', cockpit: '1.1米星际联屏（12.3+15.6英寸），20扬声器', caliber: 'media',
    usp: ['1.1米全景贯穿式星际屏+高通QCM8838旗舰芯片，行业首创直瀑式阵列音响', '星灵智行ADiGO GSD 3.0高阶智驾，全场景自动泊车辅助', '插混四驱综合400kW、轮端扭矩10000N·m，三把差速锁+双腔空悬+CDC', '方正硬派造型，车长5045mm/轴距2900mm，定位"超舒适的悦野方盒子"'],
    desc: '广汽传祺越7 9月2日开启预售、9月22日正式上市；官方预售指导价17.98-22.58万元、预售权益价17.18万元起，共两驱Pro/Max、四驱Max/Ultra四款配置，为传祺首款硬派方盒子SUV。',
    src: '广汽传祺官网越7产品页（USP + 预售信息）', srcUrl: 'https://www.gacmotor.com/yue7/',
    specsSrc: '汽车之家参数配置页（性能参数）', specsUrl: 'https://www.autohome.com.cn/config/series/8627.html',
    featured: true, featuredNote: '全新车型：广汽传祺首款硬派方盒子SUV',
    dims: ['power', 'charging', 'crash', 'handling', 'adas', 'interaction'],
    specs: {
      size: '标准4999×2004×1933mm / 宽体5045×2004×1916mm / 轴距2900mm',
      power: 'PHEV 1.5T插混\n（1）两驱版：综合功率200kW\n（2）四驱版：综合功率400kW / 轮端扭矩10000N·m',
      accel: '0-100km/h 4.2s（四驱）/ 7.49s（两驱）', topSpeed: '200km/h',
      weight: '整备2330kg(两驱)/2510kg(四驱) / 满载2810/3030kg',
      fastCharge: '30%-80% 15分钟',
      suspension: '前双叉臂+后五连杆（双腔空悬+CDC）',
      safety: '一体化嵌入式大梁 / 扭转刚度38000N·m/deg / 三把差速锁'
    },
    img: 'img/yue7.jpg'
  }
];

// ---------- 新技术库（2026-09月报） ----------
// metrics: 量化提升数据，label=指标名 value=数值/百分比 compare=对比基准 direction='up'(增益)/'down'(降低)
// point: 月报模板句式——"M月D日，公司在X场合发布/披露技术名（领域）。该技术采用……，量化指标带对比基准。"事实导向，不写定性升华（意义归 impactNote）
var TECHS = [
  { id: 't1', date: '09-14', company: '宁德时代', domain: 'charging', title: '宁德时代全球首发TECTRANS II商用车模块化电池平台',
    point: '9月14日，宁德时代在IAA汉诺威车展全球首发TECTRANS II（天行II）商用车模块化电池平台（充放电领域）。该平台兼容换电与充电两种补能模式，适配电驱桥、中央驱动两种架构；能量密度达170Wh/kg（约高于行业均值13%），顶配车型续航1000km，支持兆瓦级快充、SOC充至80%仅需25分钟，系统往返效率96%；官方测算可帮助整车厂开发周期缩短50%、研发成本降低60-70%。',
    params: '170Wh/kg（约高于行业均值13%）；最高1000km续航；兆瓦级快充25min→80%；往返效率96%',
    caliber: 'official', impact: 'high',
    impactNote: '商用车电动化平台化拐点，乘用车模块化思路可借鉴',
    metrics: [
      { label: '开发周期', value: '缩短50%', compare: 'vs 传统平台', direction: 'down' },
      { label: '研发成本', value: '降低60-70%', direction: 'down' },
      { label: '能量密度', value: '170Wh/kg', compare: '高于行业均值13%', direction: 'up' },
      { label: '系统效率', value: '往返效率96%' },
      { label: '快充性能', value: '25min→80%', compare: '兆瓦级' }
    ],
    src: '宁德时代新闻稿', srcUrl: 'https://m.chinatruck.org/news/16_142316.html' },
  { id: 't2', date: '09-09', company: '松下能源', domain: 'charging', title: '松下能源发布方形全固态电池，耐温极限提升至150℃',
    point: '9月9日，松下能源发布方形全固态电池（充放电/电池材料领域），行业首次将方形全固态电池耐温极限由125℃提升至150℃（提升20%），并可在150℃环境下稳定耐久100小时。首批样品将于今年Q4交付，面向工业设备与车载传感器场景，而非车规动力电池，商业化节奏低于市场此前预期。',
    params: '耐温极限150℃；高温耐久100h @150℃；首批样品Q4交付',
    caliber: 'media', impact: 'medium',
    impactNote: '固态电池商业化从"车规动力"转向"高温小容量"场景先行，修正市场预期',
    metrics: [
      { label: '耐温极限', value: '150℃', compare: '原125℃（+20%）', direction: 'up' },
      { label: '高温耐久', value: '100h @150℃' }
    ],
    src: '盖世汽车/集邦咨询', srcUrl: 'https://www.trendforce.cn/industry-news/green-energy/20260911-7909.html' },
  { id: 't3', date: '09-01', company: '蔚来', domain: 'charging', title: '蔚来披露第五代换电站',
    point: '9月1日，蔚来在2026年Q2财报电话会上披露第五代换电站（充放电领域），兼容蔚来、乐道、萤火虫三品牌全车型。单站建设成本由四代站150万元降至140万元（降低7%，较初代站300万元累计下降53%）；日服务能力由150次提升至200次以上（提升33%）；最快换电时间压缩至2分24秒。',
    params: '单站成本140万；最快换电2分24秒；日服务200次+；品牌兼容蔚来/乐道/萤火虫',
    caliber: 'official', impact: 'high',
    impactNote: '换电开放化、降本化并行',
    metrics: [
      { label: '单站建设成本', value: '140万', compare: 'vs 四代150万(降7%) / 初代300万(降53%)', direction: 'down' },
      { label: '日服务上限', value: '200次+', compare: 'vs 四代150次(增33%)', direction: 'up' },
      { label: '最快换电', value: '2分24秒' },
      { label: '品牌兼容', value: '蔚来+乐道+萤火虫' }
    ],
    src: '蔚来官网/21世纪经济报道', srcUrl: 'https://www.nio.cn/news/20260807001' },
  { id: 't4', date: '09-08', company: '宝马', domain: 'power', title: '宝马第六代eDrive电驱随新世代i3 40L申报，CLTC续航906km',
    point: '9月8日，宝马在工信部第411批公告申报新世代i3 40L（第八代3系纯电，动力经济性领域），首次搭载800V高压架构与第六代eDrive电驱系统，单电机功率235kW，CLTC续航达906km，计划2027年1月投产。',
    params: '235kW单电机；CLTC续航906km；800V架构；第六代eDrive',
    caliber: 'cert', impact: 'high',
    impactNote: '2027年1月投产，豪华纯电轿车标杆',
    metrics: [
      { label: 'CLTC续航', value: '906km' },
      { label: '电机功率', value: '235kW' },
      { label: '高压架构', value: '800V' },
      { label: '电驱代际', value: '第六代eDrive' }
    ],
    src: '工信部411批公示', srcUrl: 'https://www.miit.gov.cn/jgsj/zbys/qcgy/art/2026/art_c285f020e14b403aba322526ad70d3e9.html' },
  { id: 't5', date: '09-16', company: '大众', domain: 'energy', title: '大众发布Mission Efficiency能效展示车，宣称三项能效世界纪录',
    point: '9月16日，大众发布Mission Efficiency能效展示车官图（动力经济性领域），宣称创下三项电动车能效世界纪录；具体纪录指标官方尚未公布，待后续技术文件验证。',
    params: '3项能效世界纪录（具体指标待官方文件）',
    caliber: 'media', impact: 'medium',
    impactNote: '能效营销战升级，关注其官方后继技术文件',
    metrics: [
      { label: '宣称纪录', value: '3项能效世界纪录' }
    ],
    src: '汽车之家', srcUrl: 'https://www.autohome.com.cn/article?id=8Q5HLOoFRQ4=' },
  { id: 't7', date: '09-02', company: '蔚来', domain: 'thermal', title: '蔚来发布"鹰尾"双模主动升降尾翼，2026款EC6首发',
    point: '9月2日，蔚来发布"鹰尾"双模主动升降尾翼（空气动力学领域），由2026款EC6首发搭载。尾翼在车速60km/h以上自动开启减阻模式，可降低风阻系数10%；130km/h以上切换下压力模式，提供580N下压力；整车风阻系数低至Cd 0.24。',
    params: '风阻降低10%；下压力580N@130km/h；Cd 0.24',
    caliber: 'media', impact: 'medium',
    impactNote: '主动空动部件家用化趋势观察点',
    metrics: [
      { label: '减阻效果', value: '降低10%', compare: '车速>60km/h', direction: 'down' },
      { label: '高速下压力', value: '580N', compare: '车速>130km/h' },
      { label: '风阻系数', value: 'Cd 0.24' }
    ],
    src: '汽车之家车家号', srcUrl: 'https://chejiahao.m.autohome.com.cn/360/chejiahao/detailinfo/26365551' },
  { id: 't8', date: '09-16', company: '奕境', domain: 'crash', title: '奕境发布"天穹智盾"全时空安全架构，X9首发',
    point: '9月16日，奕境发布"天穹智盾"全时空安全架构（碰撞安全领域），由首款车型奕境X9首发搭载。该架构B柱采用2400MPa热成型钢（行业主流1500-2000MPa，高出20%-60%），车身高强度钢铝占比92%，通过16吨极限压顶测试；完成105km/h超高速OMDB偏置碰撞（碰撞能量达美标的136%）；感知层搭载896线双光路激光雷达，120m距离识别精度达14cm。',
    params: 'B柱2400MPa；钢铝占比92%；16吨压顶；105km/h OMDB；896线双光路激光雷达',
    caliber: 'media', impact: 'medium',
    impactNote: '安全正从单项配置竞争转向体系化能力竞争',
    metrics: [
      { label: 'B柱强度', value: '2400MPa', compare: '行业主流1500-2000MPa(+20-60%)', direction: 'up' },
      { label: '钢铝占比', value: '92%' },
      { label: '极限压顶', value: '16吨通过' },
      { label: '超高速碰撞', value: '105km/h OMDB', compare: '能量达美标136%', direction: 'up' },
      { label: '激光雷达', value: '896线双光路', compare: '120m@14cm识别' }
    ],
    src: '新浪汽车', srcUrl: 'https://k.sina.com.cn/article_2298836177_890574d102001lyt0.html' },
  { id: 't9', date: '09-01', company: '蔚来', domain: 'safeprevent', title: '蔚来电池监控平台通过国标检测，宣称行业首家',
    point: '9月1日，蔚来宣布其电池监控平台通过国家标准检测（电池安全领域），官方宣称为行业首家；电池安全监控由此前的企业自证走向国标符合性验证。',
    params: '通过国标检测（行业首家宣称）',
    caliber: 'official', impact: 'medium',
    impactNote: '电池安全国标符合性或成新门槛',
    metrics: [
      { label: '认证状态', value: '通过国标检测', compare: '宣称行业首家' }
    ],
    src: '蔚来官网', srcUrl: 'https://www.nio.cn/smart-technology/20260901003' },
  { id: 't10', date: '09-08', company: '蔚来', domain: 'handling', title: '蔚来官方详解SkyRide·天行智能底盘',
    point: '9月8日，蔚来官方详解SkyRide·天行智能底盘（操纵与稳定性领域），搭载于品牌旗舰车型。该底盘扭矩调节频率达1000次/秒，响应频率达40Hz、车身调节速度达600mm/s（均为传统空气弹簧的60倍），响应延时小于6ms（较分布式方案缩短67%），实测不同工况下振动降低20.8%-50.6%。',
    params: '扭矩调节1000次/秒；响应40Hz；调节600mm/s；延时<6ms；振动降20.8-50.6%',
    caliber: 'official', impact: 'medium',
    impactNote: '底盘域智能化跟踪点',
    metrics: [
      { label: '扭矩调节', value: '1000次/秒', direction: 'up' },
      { label: '响应频率', value: '40Hz', compare: '空气弹簧的60倍', direction: 'up' },
      { label: '车身调节速度', value: '600mm/s', compare: '空气弹簧的60倍', direction: 'up' },
      { label: '响应延时', value: '<6ms', compare: '较分布式方案缩短67%', direction: 'down' },
      { label: '振动降低', value: '20.8-50.6%', compare: '不同工况实测', direction: 'down' }
    ],
    src: '蔚来官网', srcUrl: 'https://www.nio.cn/smart-technology/20260415001' },
  { id: 't11', date: '09-15', company: '小鹏', domain: 'interaction', title: '小鹏发布XOS 6.3.0，完成物理AI座舱底层架构升级',
    point: '9月15日，小鹏发布XOS 6.3.0车载操作系统（智能座舱领域），完成面向物理AI的底层架构级重构。端侧模型参数量扩大3.5倍（达主流VLA的15倍以上）；流式自回归推理使响应速度提升300%；Infini-VLA长时序记忆窗口达30秒；X-Foresight世界模型可实现6秒未来预判；官方称综合安全能力提升20倍。',
    params: '端侧参数扩3.5倍；响应+300%；时序记忆30s；未来预判6s；安全+20倍',
    caliber: 'official', impact: 'high',
    impactNote: '座舱OS竞争进入架构层',
    metrics: [
      { label: '端侧参数量', value: '扩大3.5倍', compare: '主流VLA的15倍+', direction: 'up' },
      { label: '响应速度', value: '提升300%', compare: '流式自回归推理', direction: 'up' },
      { label: '时序记忆', value: '30秒', compare: 'Infini-VLA长时序' },
      { label: '未来预判', value: '6秒', compare: 'X-Foresight世界模型' },
      { label: '安全能力', value: '综合提升20倍', direction: 'up' }
    ],
    src: '小鹏官网', srcUrl: 'https://www.xiaopeng.com/news.html' },
  { id: 't12', date: '09-01', company: '小鹏', domain: 'adas', title: '小鹏首次重大升级第二代VLA大模型，实现4D时空理解',
    point: '9月1日，小鹏对第二代VLA（视觉-语言-动作）智驾大模型进行首次重大升级（智能驾驶领域），官方称AI由此开始理解"时间"，实现从3D空间理解向4D时空理解的跃迁；流式推理响应提升300%，端侧参数量扩大3.5倍（达主流VLA的15倍以上），综合安全能力提升20倍。',
    params: '3D→4D时空跃迁；响应+300%；参数+3.5倍；安全+20倍',
    caliber: 'official', impact: 'high',
    impactNote: '智驾技术路线分化观察点',
    metrics: [
      { label: '模型跃迁', value: '3D空间→4D时空' },
      { label: '流式推理', value: '响应+300%', direction: 'up' },
      { label: '参数量', value: '+3.5倍', compare: '主流VLA的15倍', direction: 'up' },
      { label: '安全能力', value: '综合+20倍', direction: 'up' }
    ],
    src: '小鹏官网', srcUrl: 'https://www.xiaopeng.com/news.html' },
  { id: 't13', date: '09-09', company: '华为', domain: 'adas', title: '华为乾崑智驾与鸿蒙座舱累计装车突破200万台',
    point: '9月9日，华为宣布乾崑智驾与鸿蒙座舱装车量同步突破200万台（智能驾驶/座舱产业化领域），乾崑APP用户仅用9个月达成200万；第二个100万台装车耗时12个月，较首个100万台的44个月提速3.7倍；累计辅助驾驶里程达149亿公里。',
    params: '装车200万；APP用户200万/9个月；2nd百万12月；累计辅助驾驶149亿公里',
    caliber: 'media', impact: 'high',
    impactNote: '供应商格局判断依据',
    metrics: [
      { label: '智驾搭载', value: '200万' },
      { label: '鸿蒙座舱', value: '200万' },
      { label: '乾崑APP用户', value: '200万', compare: '9个月达成' },
      { label: '增速对比', value: '2nd百万12月', compare: 'vs 首个44月(提速3.7x)', direction: 'up' },
      { label: '累计辅助驾驶', value: '149亿公里' }
    ],
    src: '第一电动', srcUrl: 'http://www.ce.cn/cysc/newmain/yc/jsxw/202609/t20260908_3201008.shtml' },
  { id: 't14', date: '09-08', company: '中创新航', domain: 'emissions', title: '中创新航率先发布气候与自然财务影响双报告',
    point: '9月8日，中创新航同时发布《气候风险量化财务影响报告》与《自然相关财务影响报告》（环境友好/ESG披露领域），官方称为行业率先，披露框架对标国际主流ESG准则。',
    params: '气候+自然双报告（行业率先）',
    caliber: 'official', impact: 'medium',
    impactNote: '影响海外客户ESG评级',
    metrics: [
      { label: '报告类型', value: '气候+自然双报告', compare: '行业率先' }
    ],
    src: '中创新航官网', srcUrl: 'http://www.calb-tech.com/NewsDetails/37.html' },
  { id: 't15', date: '09-14', company: '宁德时代', domain: 'corrosion', title: '宁德时代TECTRANS II电池包宣称15年防腐性能',
    point: '9月14日，宁德时代在IAA汉诺威车展发布的TECTRANS II电池包宣称实现15年防腐性能（防腐领域），面向沿海及寒冷地区长期运营场景；防腐年限指标首次进入商用车电池包产品规格书。',
    params: '15年防腐（沿海/寒冷地区）',
    caliber: 'official', impact: 'low',
    impactNote: '防腐指标产品化趋势',
    metrics: [
      { label: '防腐年限', value: '15年', compare: '沿海/寒冷地区', direction: 'up' }
    ],
    src: '宁德时代新闻稿', srcUrl: 'https://m.chinatruck.org/news/16_142316.html' }
];

// ---------- 月度趋势（总览页） ----------
var TRENDS = [
  { t: '"十五五"规划定调', d: '9月10日工信部等九部门印发《智能网联新能源汽车产业发展"十五五"规划》，叠加9月7日两部门规范车企供应商账款支付，政策面进入"智能化深化+供应链治理"双轨阶段。' },
  { t: '高端新能源"满编作战"', d: '工信部第411批公告（9月8日公示）显示阿维塔T09、魏牌第二代蓝山、吉利银河M8、宝马新世代i3/iX3/X5扎堆申报，35万—60万元区间竞争烈度显著上升；本批纯电型号233个、插混仅46个，纯电路线收复失地。' },
  { t: '电池技术多点突破、车企绑定加深', d: '宁德时代发布商用车模块化电池平台TECTRANS II；蜂巢能源公开混合固液电池低成本路径；小米官宣中创新航战略合作、理想i6自研电池封包落地申报。' },
  { t: 'AI大模型上车加速', d: '小鹏XOS 6.3.0"物理AI"底层架构+第二代VLA升级，华为乾崑智驾+鸿蒙座舱装车量达200万台，宝马中国版新世代操作系统X落地。' },
  { t: '安全竞争体系化', d: 'C-IASI 2026版、C-NCAP"启研2030"版规程相继发布；蔚来电池监控平台行业首家通过国标检测；奕境发布"天穹智盾"全时空安全架构。' }
];

// 月份标签
var REPORT_MONTH = '2026年9月';

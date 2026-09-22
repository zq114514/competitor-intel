/* ============================================================
 * 竞品技术情报站 · 2026年6月 月报数据（方案A：月报池独立文件）
 * ------------------------------------------------------------
 * 数据来源与核查：
 *  - 官方信源采集：data/raw/2026-06/items.json（collect.py 定向抓取）
 *  - AI 月度核查：WebSearch 逐条交叉核实，仅保留有明确6月日期+可追溯URL的条目
 *  - caliber：official=企业官方/央媒 ｜ cert=监管认证/标准 ｜ media=权威汽车媒体（已核对）
 *  - 单一来源/参数存疑处已在 desc/params 中标注"待核实"
 * 生成时间：2026-09-17
 * ============================================================ */

var REPORT_MONTH = '2026年6月';

var CARS = [
  {
    id: 'xiongmao', name: '吉利熊猫勇士', brand: '吉利', power: '纯电', seg: '微型车',
    price: '指导价5.09万 / 限时4.39万', launchDate: '2026-06-01', range: 'CLTC 210km', adas: '—', cockpit: '—', caliber: 'media',
    usp: ['30kW后置单电机', '宁德时代磷酸铁锂17.2kWh', '22kW直流快充30%-80%约30分钟'],
    desc: '三门四座微型纯电，官方指导价5.09万元、6月限时价4.39万元；宁德时代17.2kWh磷酸铁锂电池，CLTC续航210km。',
    src: '央视网汽车', srcUrl: 'https://auto.cctv.com/2026/06/02/ARTIoak2aGfgG5KMzvHAksGx260602.shtml', img: ''
  },
  {
    id: 'pao-hi4t', name: '长城炮 Hi4-T', brand: '长城', power: '插混', seg: '皮卡',
    price: '16.68-18.68万', launchDate: '2026-06-13', range: 'NEDC纯电123km / 综合1081km', adas: '—', cockpit: '—', caliber: 'media',
    usp: ['33.1kWh电池', '直流快充峰值110kW，30%-80%需18分钟', '电池包离地近700mm、IP68防水'],
    desc: '插混皮卡，商用/乘用两系上市，16.68万起；NEDC纯电123km、综合续航1081km。注：主要依据重庆车展现场单一媒体报道，价格口径待官方复核。',
    src: '中关村在线（重庆车展）', srcUrl: 'https://auto.zol.com.cn/1197/11976675.html', img: ''
  },
  {
    id: 's07-laser', name: '深蓝S07 华为乾崑激光版', brand: '深蓝', power: '增程', seg: '中型SUV',
    price: '15.99-17.69万（限时15.49万起）', launchDate: '2026-06-13', range: '纯电230/300km / 综合1385km', adas: '华为乾崑ADS 4 Pro', cockpit: 'CAS 4.0', caliber: 'official',
    usp: ['首搭华为舱内激光视觉雷达Limera', '3C超充30%-80%约15分钟', '馈电油耗3.8L'],
    desc: '230Max+/230Ultra/300Ultra三款上市，15.99万起；LFP电池31.73/39.05kWh，CLTC综合最高1385km；标配华为乾崑ADS 4 Pro。',
    src: '央广网/中国经济网', srcUrl: 'http://auto.cnr.cn/cz/20260613/t20260613_527659383.shtml', img: ''
  },
  {
    id: 'et5-champ', name: '蔚来 ET5 冠军纪念版', brand: '蔚来', power: '纯电', seg: '中型轿跑',
    price: '31.3万起 / BaaS 20.5万起', launchDate: '2026-06-15', range: 'CLTC 740km', adas: '—', cockpit: '—', caliber: 'official',
    usp: ['100kWh电池', '双电机360kW、零百4s', '底盘抗扭刚度提升6%、EP Mode可调阻尼'],
    desc: '2026款ET5/ET5T/EC6冠军纪念版系列（本条取ET5），整车购31.3万起、BaaS 20.5万起；专属底盘强化。',
    src: '蔚来官网', srcUrl: 'https://www.nio.cn/videos/20260615002', img: ''
  },
  {
    id: 'm6-ev', name: '问界M6 纯电新版（Max/Max+）', brand: '鸿蒙智行', power: '纯电', seg: '中大型SUV',
    price: '22.98 / 24.98万', launchDate: '2026-06-16', range: 'CLTC 602/630km', adas: '乾崑智驾ADS Pro增强版', cockpit: '—', caliber: 'media',
    usp: ['81kWh电池、后置单电机227kW', '车长4960mm、轴距2950mm', '标配单腔空悬+CDC'],
    desc: '中大型五座纯电SUV，22.98/24.98万；搭载华为舱内激光雷达Limera（6月中旬多款华为合作车型集中搭载）。',
    src: '中关村在线', srcUrl: 'https://auto.zol.com.cn/1200/12000511.html', img: ''
  },
  {
    id: 'c10-new', name: '零跑全新C10', brand: '零跑', power: '纯电+增程', seg: '中型SUV',
    price: '12.58-14.28万', launchDate: '2026-06-16', range: '纯电660km / 增程综合1300km', adas: '300线激光雷达+高通SA8650', cockpit: '—', caliber: 'official',
    usp: ['800V+3C快充30%-80%仅16分钟', '增程纯电290km、综合1300km', '标配免费P2P车位到车位领航'],
    desc: '纯电+增程双动力焕新上市，12.58万起；纯电版81.9kWh、CLTC 660km，智驾算力200TOPS等效。',
    src: '央广网', srcUrl: 'http://auto.cnr.cn/cz/20260617/t20260617_527664788.shtml', img: ''
  },
  {
    id: 'n8l-flash', name: '腾势N8L 闪充版', brand: '腾势', power: '插混', seg: '大型六座SUV',
    price: '31.98 / 34.98万', launchDate: '2026-06-23', range: '纯电430km / 综合1550km', adas: '天神之眼5.0', cockpit: '智能体"迪迪虾"', caliber: 'official',
    usp: ['第二代刀片电池', '10%-70%充电仅5分钟', '易三方±10°后轮转向、转弯半径4.58m、零百3.7s'],
    desc: '大型六座插混SUV闪充尊荣型/旗舰型上市，31.98万起；2.0T+三电机，云辇-A。电池容量75.26kWh仅见于自媒体，待官方核实。',
    src: '央广网/中国经济网', srcUrl: 'http://auto.cnr.cn/cz/20260624/t20260624_527674199.shtml', img: ''
  },
  {
    id: 'm817', name: '猛士 M817', brand: '猛士（东风）', power: '增程', seg: '豪华越野SUV',
    price: '29.99-39.98万', launchDate: '2026-06-27', range: '纯电301km / 综合1450km', adas: '华为CAS 5.0、行业首发896线激光雷达', cockpit: '华为乾崑方案', caliber: 'official',
    usp: ['综合功率715kW', '800V+6C超充30%-80%仅9.6分钟', '双向20°后轮转向、涉水900mm'],
    desc: '与华为乾崑联合打造的增程豪华越野SUV，5款配置29.99万起；62.5kWh宁德时代骁遥电池，150mm双腔空悬。',
    src: '东风集团官网/央广网', srcUrl: 'https://www.dfmc.com.cn/news/company/news_20260629_1014.html', img: ''
  },
  {
    id: '07gt-pre', name: '领克07GT（预售）', brand: '领克', power: '插混', seg: '中型旅行车',
    price: '预售16.58-18.58万', launchDate: '2026-06-29（预售）', range: '两驱综合1422km', adas: '千里浩瀚H7、Thor-U芯片', cockpit: '—', caliber: 'media',
    usp: ['1.5T Evo热效率47.26%', '四驱综合功率390kW', '高配MRC磁流变悬架、6kW外放电'],
    desc: '全球首秀并开启预售（正式上市定档7月23日）；28.3kWh神盾金砖电池，十周年时间限量版20.88万、限量1007台。',
    src: '易车/中关村在线', srcUrl: 'https://auto.zol.com.cn/1219/12197408.html', img: ''
  }
];

var TECHS = [
  { id: 't1', date: '06-06', company: '东风汽车', domain: 'charging', title: '全新一代固态（混合固液）电池宣布下半年量产装车',
    point: '宣布全新一代混合固液电池能量密度达350Wh/kg，配套车型纯电续航有望突破1000km，计划2026下半年量产装车。氧化物-聚合物复合路线，整包减重约30%；-30℃电量保持率超74%，170℃热箱不起火（国标130℃）。',
    params: '350Wh/kg；续航1000km+；-30℃保持率>74%；170℃热箱不起火；整包减重30%',
    caliber: 'official', impact: 'high',
    impactNote: '固态电池从样品走向量产装车的关键节点',
    metrics: [
      { label: '能量密度', value: '350Wh/kg' },
      { label: '续航', value: '1000km+', compare: '配套车型目标' },
      { label: '低温保持率', value: '-30℃ >74%' },
      { label: '整包减重', value: '约30%', direction: 'down' }
    ],
    src: '湖北省政府网转湖北日报', srcUrl: 'https://www.hubei.gov.cn/hbfb/rdgz/202606/t20260606_5953248.shtml' },
  { id: 't2', date: '06-13', company: '长安汽车', domain: 'hmi', title: '"天枢领航"辅助驾驶系统发布（Pro/Max/Ultra）',
    point: '发布分档辅助驾驶系统：Pro全系标配激光雷达；Max基于超2000万条人类驾驶数据切片训练；Ultra集成视觉语言大模型（VLM），将首发于9月上市的启源Q06。',
    params: 'Pro/Max/Ultra三档；训练数据2000万+条；首发车型启源Q06（800V碳化硅、6C超充）',
    caliber: 'official', impact: 'medium',
    impactNote: '车企自研智驾按硬件-数据-VLM分层落地',
    metrics: [
      { label: '训练数据', value: '2000万+条' },
      { label: '首发车型', value: '启源Q06' }
    ],
    src: '重庆日报（市政府门户）', srcUrl: 'http://www.cq.gov.cn/ywdt/jrcq/202606/t20260614_15751731_app.html' },
  { id: 't3', date: '06-13', company: '华为乾崑', domain: 'hmi', title: '激光视觉雷达Limera量产上车（深蓝S07首发）',
    point: '行业首创共光路光学架构的舱内集成式激光视觉雷达量产上车，"一镜双模"融合3D点云与2D图像，无机械运动部件，强化暗光与小障碍物探测；6月内深蓝S07激光版、问界M6纯电版相继搭载。',
    params: '共光路架构；激光+摄像头舱内集成；无机械运动部件',
    caliber: 'media', impact: 'high',
    impactNote: '激光雷达舱内化、固态化方向的量产样本',
    metrics: [
      { label: '首发车型', value: '深蓝S07激光版' },
      { label: '架构', value: '共光路/一镜双模' }
    ],
    src: '中国经济网/央广网', srcUrl: 'http://auto.ce.cn/auto/gundong/202606/t20260615_3032277.shtml' },
  { id: 't4', date: '06-15', company: '理想汽车', domain: 'hmi', title: '马赫M100自研芯片 + Mind大模型发布',
    point: '发布5nm车规自研芯片马赫M100：单芯算力达1280 TOPS、双芯2560 TOPS，实际运行效率超82%，已于5月量产上车新L9。Mind-Pro模型TPS峰值208 token/s、Token消耗降低38%；VLA综合响应0.28s（快于人类0.45s）。',
    params: '1280 TOPS/单芯；双芯2560 TOPS；运行效率>82%；VLA响应0.28s；Token消耗降38%',
    caliber: 'official', impact: 'high',
    impactNote: '新势力自研智驾芯片进入量产装车阶段',
    metrics: [
      { label: '单芯算力', value: '1280 TOPS' },
      { label: '双芯算力', value: '2560 TOPS' },
      { label: '运行效率', value: '>82%' },
      { label: 'VLA响应', value: '0.28s', compare: '人类0.45s' },
      { label: 'Token消耗', value: '降低38%', direction: 'down' }
    ],
    src: '中央广电总台国际在线', srcUrl: 'https://big5.cri.cn/gate/big5/auto.cri.cn/2026-06-16/ef214322-48e2-4b24-bcaf-276cd7edbb1c.html' },
  { id: 't5', date: '06-22', company: '宁德时代', domain: 'charging', title: '天恒TENER Sodium全球首款场站级实证型钠电储能系统发布',
    point: '在德国慕尼黑发布全球首款场站级实证型钠电储能系统，单套额定能量超30MWh，1GWh场站仅需34套；25℃循环寿命达15000次，-20℃容量保持超92%；较LFP膨胀力降低40%、热失控表面温度降低60%、辅源功耗由行业2%降至1%。注：储能场景，非乘用车直接部件。',
    params: '单套>30MWh；循环15000次；-20℃保持>92%；膨胀力-40%；热失控表面温度-60%',
    caliber: 'official', impact: 'medium',
    impactNote: '钠电池在大规模储能率先商业化，技术外溢值得跟踪',
    metrics: [
      { label: '单套能量', value: '>30MWh' },
      { label: '循环寿命', value: '15000次' },
      { label: '低温保持', value: '-20℃ >92%' },
      { label: '膨胀力', value: '降低40%', direction: 'down' },
      { label: '热失控表面温度', value: '降低60%', direction: 'down' }
    ],
    src: '新华网/CATL官网', srcUrl: 'http://www.xinhuanet.com/digital/20260623/6746e130b68c42fdb38d78a6dea2d8c9/c.html' },
  { id: 't6', date: '06-27', company: '国家标准（市场监管总局/工信部）', domain: 'safety', title: 'GB 47955-2026 组合驾驶辅助系统安全要求强制性国标发布',
    point: '国内首个L2组合驾驶辅助强制性国标发布，分别规定领航组合辅助、基础单车道/多车道组合辅助的技术要求与测试验证方法。背景：2026年乘用车组合驾驶辅助渗透率约70%、领航辅助超30%。华为引望为核心起草单位之一。',
    params: '国内首个L2强标；覆盖领航/单车道/多车道组合辅助；行业渗透率约70%',
    caliber: 'cert', impact: 'high',
    impactNote: '智驾从"宣传竞争"进入"强制合规"阶段',
    metrics: [
      { label: '标准性质', value: '强制性国标' },
      { label: '行业渗透率', value: '约70%' },
      { label: '领航辅助渗透率', value: '超30%' }
    ],
    src: '华为乾崑官网（标准公告）', srcUrl: 'https://auto.huawei.com/cn/news/2026/2026-6-27-l2' },
  { id: 't7', date: '06-27', company: '猛士×华为乾崑', domain: 'hmi', title: '896线激光雷达行业首发量产上车 + CAS 5.0',
    point: '随全新猛士M817上市，华为896线双光路图像级激光雷达实现行业首发量产装车（该雷达3月发布、本次为量产首发车型），同步搭载全维防碰撞系统CAS 5.0与NCA越野版，覆盖全时速/全方向六维安全。',
    params: '896线双光路；CAS 5.0六维安全；NCA越野版',
    caliber: 'official', impact: 'high',
    impactNote: '高阶激光雷达下探30万级越野车型',
    metrics: [
      { label: '激光雷达', value: '896线' },
      { label: '首发车型', value: '猛士M817' }
    ],
    src: '央广网', srcUrl: 'http://auto.cnr.cn/cz/20260628/t20260628_527680605.shtml' }
];

var TRENDS = [
  { t: '辅助驾驶进入强制合规时代', d: '6月27日GB 47955-2026成为国内首个L2组合驾驶辅助强制性国标，叠加行业约70%的渗透率，智驾竞争从参数宣传转向合规底线与责任界定。' },
  { t: '固态电池量产装车倒计时', d: '东风宣布350Wh/kg混合固液电池下半年量产装车、续航目标1000km；宁德时代钠电系统在储能场景率先商业化（15000次循环），下一代电池技术多路线并进。' },
  { t: '华为智驾生态集中上车', d: '6月内Limera舱内激光视觉雷达、896线激光雷达、乾崑ADS Pro/4 Pro、CAS 5.0在深蓝S07、问界M6、猛士M817等多款车型集中落地，供应商生态扩张速度显著。' }
];

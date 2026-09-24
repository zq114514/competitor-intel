/* ============================================================
 * 竞品技术情报站 · 2026年7月 月报数据（方案A：月报池独立文件）
 * ------------------------------------------------------------
 * 数据来源与核查：
 *  - 官方信源采集：data/raw/2026-07/items.json（理想L6/L8、CCRT等原始条目）
 *  - AI 月度核查：WebSearch 逐条交叉核实（官网+央媒），日期口径冲突处已修正
 *  - caliber：official=企业官方/央媒 ｜ cert=监管认证/评价 ｜ media=权威汽车媒体（已核对）
 * 生成时间：2026-09-17
 * ============================================================ */

var REPORT_MONTH = '2026年7月';

var CARS = [
  {
    id: 'glc-ev', name: '全新纯电GLC（鎏金版）', brand: '梅赛德斯-奔驰', power: '纯电', seg: '中型SUV',
    price: '鎏金版33.98万（晖银版预售29.98万）', launchDate: '2026-07-08', range: 'CLTC 680km（最高703km）', adas: '—', cockpit: '—', caliber: 'official',
    usp: ['MB.EA平台、800V架构', '85.5kWh三元锂（宁德电芯）', '峰值充电320kW，10分钟补能约300km'],
    desc: '全新纯电GLC鎏金版上市，晖银版/星铂版6座同步预售；双电机310kW、零百4.9s，10%-80%约22分钟。晖银版29.98/29.99万口径待核实。',
    src: '奔驰中国官网/扬子晚报', srcUrl: 'https://www.mercedes-benz.com.cn/vehicles/eq/glc-l.html', img: ''
  },
  {
    id: 'es8-5seat', name: '蔚来 ES8 大五座版', brand: '蔚来', power: '纯电', seg: '大型SUV',
    price: '38.28-42.28万 / BaaS 27.48万起', launchDate: '2026-07-09', range: 'CLTC 655km', adas: '—', cockpit: '—', caliber: 'official',
    usp: ['NT3.0平台、全域900V', '双电机520kW、零百3.9s', '4C超充+换电、双腔空悬'],
    desc: 'ES8行政豪华版/行政签名版上市，7月10日交付；102kWh电池、700N·m。',
    src: '蔚来官网', srcUrl: 'https://www.nio.cn/news/20260709001', img: ''
  },
  {
    id: 'l6-new', name: '新一代理想L6（Ultra）', brand: '理想', power: '增程', seg: '中大型SUV',
    price: '24.98万', launchDate: '2026-07-16', range: '纯电300km / 综合1250km', adas: '马赫M100芯片1280TOPS', cockpit: '—', caliber: 'official',
    usp: ['CLTC纯电300km（提升42%）', '峰值快充260kW，20%-80%仅12分钟', '51kWh新一代增程专用磷酸铁锂'],
    desc: '仅Ultra一款配置，全国统一零售价24.98万元；双电机四驱，自研马赫M100芯片上车。',
    src: '理想官网/央广网', srcUrl: 'https://www.lixiang.com/news/184.html', img: ''
  },
  {
    id: 'mona-l03-jul', name: '小鹏 MONA L03', brand: '小鹏', power: '纯电+增程', seg: '紧凑型SUV',
    price: '12.38-15.68万', launchDate: '2026-07-16', range: '纯电650km / 增程综合1380km', adas: '图灵芯片1500TOPS、第二代VLA', cockpit: '—', caliber: 'official',
    usp: ['纯电+超级增程9款配置', '四驱零百4.5s', '上市1小时大定4.6万台'],
    desc: '7月2日预售、7月16日慕尼黑全球上市；增程版纯电325km、WLTC亏电油耗4.96L。',
    src: '小鹏官网', srcUrl: 'https://www.xiaopeng.com/news/company_news/5579.html', img: ''
  },
  {
    id: 'avtr07l', name: '阿维塔07L（预售）', brand: '阿维塔', power: '纯电', seg: '中大型SUV',
    price: '预售24.99 / 27.99万', launchDate: '2026-07-17（预售）', range: 'CLTC 650/725km', adas: '华为乾崑896线激光雷达+ADS 5', cockpit: '—', caliber: 'official',
    usp: ['800V+宁德5C神行电池', '10分钟补能375km', '三电机712kW、零百3.7s'],
    desc: 'Max+纯电/Ultra三电机纯电预售（8月8日上市）；电池容量89.33/87.301kWh两说，待官方核实。',
    src: '浙江日报', srcUrl: 'http://zjrb.zjol.com.cn/html/2026-07/22/content_3919226.htm', img: ''
  },
  {
    id: '07gt-launch', name: '领克07GT', brand: '领克', power: '插混', seg: '中型旅行车',
    price: '15.78-20.88万（限时14.58万起）', launchDate: '2026-07-23', range: '综合最高1422km', adas: '千里浩瀚H7、Thor-U', cockpit: '—', caliber: 'media',
    usp: ['1.5T热效率47.26%+3挡DHT', '四驱三电机390kW', 'MRC磁流变悬架'],
    desc: '4款配置上市，上市27分钟大定破万；CLTC纯电200km。',
    src: '济南日报·新黄河（发布会现场）', srcUrl: 'https://www.jinantimes.com.cn/news-342-5292848.html', img: ''
  },
  {
    id: 'zeekr9x', name: '极氪9X 五座版', brand: '极氪', power: '插混', seg: '大型SUV',
    price: '47.19-58.59万（限时45.19万起）', launchDate: '2026-07-28', range: '纯电最高380km / 综合约1250km', adas: '千里浩瀚H7/H9（1400TOPS）', cockpit: '—', caliber: 'media',
    usp: ['全栈900V混动、6C混动电池', '三电机1030kW、零百3.1s', '20%-80%约9分钟'],
    desc: 'Ultra 55/70kWh、Hyper、曜黑等版本；H9版配5激光雷达+双Thor-U芯片。',
    src: '央视网', srcUrl: 'https://auto.cctv.cn/2026/07/29/ARTITMWxiuKLr7tTWcwbq8lM260729.shtml', img: ''
  },
  {
    id: 'mg07-pre', name: 'MG 07（预售）', brand: '上汽名爵', power: '纯电', seg: '中型轿跑',
    price: '预售12.59-16.59万', launchDate: '2026-07-29（预售）', range: 'CLTC 610/650/845km', adas: 'Momenta R7世界模型+激光雷达', cockpit: '—', caliber: 'official',
    usp: ['67kWh上汽清陶量产半固态电池', '845km版800V+5C，30%-80%最快12分钟', '全系mCDC电磁悬架'],
    desc: '5款配置预售（8月成都车展上市，后续有PHEV）；半固态版-7℃续航保持率约75%，能量密度官方未披露，待核实。',
    src: '上汽集团官网/央视网', srcUrl: 'https://www.saicmotor.com/chinese/xwzx/mtbd/2026/65025.shtml', img: ''
  },
  {
    id: 'pengcheng-pre', name: '小米澎程 N70 / N90 Max（预售）', brand: '小米', power: '增程', seg: '中大型/全尺寸SUV',
    price: '预售25.99 / 29.99万', launchDate: '2026-07-30（预售）', range: 'N70纯电505km / N90综合1705km', adas: 'Thor 700TOPS+双激光雷达', cockpit: '—', caliber: 'media',
    usp: ['昆仑架构首款增程双车', 'N90纯电464km、20%-80% 18分钟', '1.5T增程器热效率42%、加92号油'],
    desc: 'N70中大型五座/N90全尺寸七座预售（9月上市后售价20.99/26.99万起）；双电机四驱310kW，零百最快5.5s。预售价格存在25.99/25.5万两说，待核实。',
    src: '央广网', srcUrl: 'http://auto.cnr.cn/cz/20260731/t20260731_527738825.shtml', img: ''
  }
];

var TECHS = [
  { id: 't1', date: '07-13', company: '国轩高科', domain: 'charging', title: 'G垣（G-Yuan）混合固液电池通过极寒极热测试、具备量产条件',
    point: '197Ah方型电芯能量密度超300Wh/kg、系统超235Wh/kg（较同体积液态提升36%），装车轿车续航约1000km；通过3mm钢针针刺不起火，规划产能12GWh。',
    params: '电芯>300Wh/kg；系统>235Wh/kg；续航约1000km；3mm针刺不起火；规划12GWh',
    caliber: 'media', impact: 'high',
    impactNote: '半固态电池进入量产条件验证阶段',
    metrics: [
      { label: '电芯能量密度', value: '>300Wh/kg' },
      { label: '系统能量密度', value: '>235Wh/kg', compare: '较液态+36%', direction: 'up' },
      { label: '装车续航', value: '约1000km' },
      { label: '规划产能', value: '12GWh' }
    ],
    src: '盖世汽车', srcUrl: 'http://autonews.gasgoo.com/articles/news/gotions-semi-solid-state-battery-passes-extreme-tests-four-overseas-plants-begin-production-2077006817534980097' },
  { id: 't2', date: '07-16', company: '蜂巢能源', domain: 'charging', title: '蜂行短刀3.0 / 混合固液6C超充电芯 / 飞叠4.0发布',
    point: '常州全球合作伙伴峰会连发三项：短刀3.0电芯130+Ah、能量密度超181Wh/kg、8C倍率，10%-80%仅5.25分钟、续航650km以上，-40℃容量保持率提升35%；混合固液6C电芯能量密度233Wh/kg、续航750km以上，2027Q3量产；飞叠4.0效率提升100%。',
    params: '短刀3.0：>181Wh/kg/8C/5.25分钟→80%；固液6C：233Wh/kg/750km+；飞叠4.0效率+100%',
    caliber: 'official', impact: 'high',
    impactNote: '快充倍率竞赛推进到8C，叠片工艺再翻倍',
    metrics: [
      { label: '短刀3.0能量密度', value: '>181Wh/kg' },
      { label: '短刀3.0快充', value: '10%-80% 5.25分钟' },
      { label: '固液6C能量密度', value: '233Wh/kg' },
      { label: '固液6C续航', value: '750km+' },
      { label: '-40℃保持率', value: '提升35%', direction: 'up' },
      { label: '飞叠4.0效率', value: '提升100%', direction: 'up' }
    ],
    src: '蜂巢能源官网/NE时代', srcUrl: 'https://www.svolt.cn/news_248' },
  { id: 't3', date: '07-16', company: '华为/引望', domain: 'hmi', title: '乾崑智驾ADS 5（WEWA 2.0）全域OTA商用计划发布',
    point: '深圳乾崑媒体日公布ADS 5全域OTA商用计划：7月率先推送V5.0，9-10月第二轮、2027春节前三轮，覆盖近200万辆存量车；新增后向防追尾、RCA漫游巡航。截至7月16日搭载190万台、累计辅助驾驶128亿公里，合作25+品牌50+车型。',
    params: '覆盖近200万辆；搭载190万台；累计128亿公里；合作25+品牌50+车型',
    caliber: 'media', impact: 'high',
    impactNote: '智驾竞争转向存量车OTA运营',
    metrics: [
      { label: 'OTA覆盖', value: '近200万辆' },
      { label: '累计搭载', value: '190万台' },
      { label: '辅助驾驶里程', value: '128亿公里' },
      { label: '合作车型', value: '50+款' }
    ],
    src: '澎湃新闻', srcUrl: 'https://m.thepaper.cn/newsDetail_forward_33603110' },
  { id: 't4', date: '07-17', company: '均胜电子', domain: 'charging', title: '均恩固液混合电池包系列发布（WAIC 2026）',
    point: 'WAIC 2026发布半固态电池包系列，能量密度达380Wh/kg，同尺寸续航提升2-3倍（约60%），循环超2000次，30分钟充至80%。注：发布定位为机器人/具身智能用途，非乘用车部件。',
    params: '380Wh/kg；续航+60%；循环>2000次；30分钟充至80%；-20~60℃',
    caliber: 'official', impact: 'low',
    impactNote: '机器人电池技术路线，能量密度指标具参考价值',
    metrics: [
      { label: '能量密度', value: '380Wh/kg' },
      { label: '同尺寸续航', value: '提升约60%', direction: 'up' },
      { label: '循环寿命', value: '>2000次' }
    ],
    src: '中证网', srcUrl: 'https://www.cs.com.cn/ssgs/01/2026/07/17/detail_2026071710025127.html' },
  { id: 't5', date: '07-17', company: '蔚来神玑', domain: 'hmi', title: '"睿动"具身智能平台 + NX9031芯片矩阵（WAIC 2026）',
    point: '蔚来旗下神玑首次独立参展WAIC，展出NX9031X智驾芯片（5nm，累计出货30万颗以上）、NX9031U车规芯片与NX9031C（支持400B级大模型本地部署）组成的矩阵。',
    params: '5nm；NX9031X累计出货30万颗+；NX9031C支持400B大模型本地部署',
    caliber: 'media', impact: 'medium',
    impactNote: '车企自研芯片向具身智能外溢',
    metrics: [
      { label: 'NX9031X出货', value: '30万颗+' },
      { label: '制程', value: '5nm' }
    ],
    src: '中国经营报（WAIC现场）', srcUrl: 'http://app3.myzaker.com/news/article.php?pk=6a5e26258e9f093058719642' },
  { id: 't6', date: '07-29', company: '上汽集团×清陶能源', domain: 'charging', title: '量产半固态电池随MG 07预售官宣上车',
    point: '上汽与清陶联合研发的半固态电池在15万级车型MG 07（610/650km版，67kWh）量产标配，官方口径-7℃续航留存率约75%；能量密度等量化参数未在发布稿披露，待核实。',
    params: '67kWh；15万级量产标配；-7℃保持率约75%',
    caliber: 'official', impact: 'high',
    impactNote: '半固态电池量产装车价格带下探至15万级',
    metrics: [
      { label: '电池容量', value: '67kWh' },
      { label: '低温保持率', value: '-7℃ 约75%' },
      { label: '装车价格带', value: '15万级' }
    ],
    src: '上汽集团官网转上海汽车报', srcUrl: 'https://www.saicmotor.com/chinese/xwzx/mtbd/2026/65025.shtml' },
  { id: 't7', date: '07-30', company: '小米', domain: 'power', title: '昆仑技术架构发布（昆仑平台+超级增程+全域安全）',
    point: '北京增程技术发布会发布昆仑架构：大电池增程路线（52kWh铁锂/76kWh三元），1.5T专用增程器实车热效率达42%（与东安联合开发）；N90综合续航1705km；2.9m贯穿纯平地板、滑轨最长1938mm；全系Thor 700TOPS。',
    params: '增程器热效率42%；N90综合1705km；76kWh三元；Thor 700TOPS；纯平地板2.9m',
    caliber: 'media', impact: 'high',
    impactNote: '大电池增程成为家庭旗舰SUV主流技术路线',
    metrics: [
      { label: '增程器热效率', value: '42%' },
      { label: 'N90综合续航', value: '1705km' },
      { label: '智驾算力', value: '700 TOPS' },
      { label: '纯平地板', value: '2.9m' }
    ],
    src: '央广网', srcUrl: 'http://auto.cnr.cn/cz/20260731/t20260731_527738825.shtml' },
  { id: 't8', date: '07-01', company: '国家标准', domain: 'safety', title: 'GB 38031-2025 动力蓄电池安全要求正式实施',
    point: '新版强制性国标7月1日正式实施，新增底部撞击测试、强化热扩散管控等要求，动力电池安全准入门槛抬升。',
    params: '强制性国标；新增底部撞击；强化热扩散管控',
    caliber: 'cert', impact: 'high',
    impactNote: '电池托底/热扩散成为合规硬约束',
    metrics: [
      { label: '标准号', value: 'GB 38031-2025' },
      { label: '实施日期', value: '2026-07-01' }
    ],
    src: '经济观察报', srcUrl: 'https://36kr.com/p/3897987200567168' },
  { id: 't9', date: '07-29', company: '中汽测评（C-CRT）', domain: 'safety', title: 'CCRT 2026第一批车型评价结果公布',
    point: '7月28日长春发布、7月29日北京公布CCRT 2026第一批评价结果，聚焦新能源中大型及以上SUV，20款参评、10款获"用户推荐车型"（问界M7等入选），同步发布三份专项报告。',
    params: '20款参评；10款获用户推荐；聚焦新能源中大型以上SUV',
    caliber: 'cert', impact: 'medium',
    impactNote: '第三方用户满意度评价引导产品定义',
    metrics: [
      { label: '参评车型', value: '20款' },
      { label: '推荐车型', value: '10款' }
    ],
    src: '中国新闻周刊网/易车', srcUrl: 'https://www.inewsweek.cn/auto/2026-07-31/31381.shtml' }
];

var TRENDS = [
  { t: '半固态电池从发布走向量产', d: '国轩G垣（>300Wh/kg）通过极端测试具备量产条件、上汽清陶半固态在15万级MG 07量产标配、蜂巢公布233Wh/kg固液6C电芯时间表，2026下半年成为半固态量产装车密集窗口。' },
  { t: '大电池增程高端化成主流', d: '小米昆仑架构（42%热效率、N90综合1705km）、极氪9X全栈900V混动、新一代理想L6（纯电300km）相继落地，增程路线在30万以上家庭旗舰市场完成技术升级。' },
  { t: '智驾竞争转向存量OTA运营', d: '华为ADS 5公布覆盖近200万辆存量车的三轮OTA计划，累计辅助驾驶128亿公里；蔚来神玑、理想马赫自研芯片矩阵化，智驾价值链从硬件转向软件运营。' }
];

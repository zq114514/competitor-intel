/* ============================================================
 * 竞品技术情报站 · 2026年8月 月报数据（方案A：月报池独立文件）
 * ------------------------------------------------------------
 * 数据来源与核查：
 *  - 官方信源采集：data/raw/2026-08/items.json（小鹏G9L、C-IASI等原始条目）
 *  - AI 月度核查：WebSearch 逐条交叉核实（官网/央媒/车质网周汇总），存疑参数已标注
 *  - caliber：official=企业官方/央媒 ｜ cert=监管认证/评价 ｜ media=权威汽车媒体（已核对）
 * 生成时间：2026-09-17
 * ============================================================ */

var REPORT_MONTH = '2026年8月';

var CARS = [
  {
    id: 'g9l', name: '小鹏 G9L（预售）', brand: '小鹏', power: '纯电+增程', seg: '中大型SUV',
    price: '预售25.98万', launchDate: '2026-08-11（预售）', range: '纯电755km / 增程综合1602km', adas: '—', cockpit: '—', caliber: 'official',
    usp: ['110kWh 5C电池、800V，充电9分钟最高补能450km', '增程纯电435km、可加92号油', '后轮线控转向转弯半径5.4m'],
    desc: '大五座科技旗舰开启预售，车长5120mm、轴距3100mm；纯电四驱零百4.45s，扭转刚度56000N·m/deg。',
    src: '小鹏官网', srcUrl: 'https://www.xiaopeng.com/news/company_news/5584.html', img: ''
  },
  {
    id: 'a05', name: '零跑 A05', brand: '零跑', power: '纯电', seg: '小型车',
    price: '6.39-9.09万', launchDate: '2026-08-11', range: 'CLTC 405/510km', adas: '激光雷达+高通8650', cockpit: '—', caliber: 'media',
    usp: ['前置单电机70/90kW', '2.5C快充30%-80%约16分钟', '6万级配激光雷达'],
    desc: '纯电小型两厢车5个版本上市；车长4200mm、轴距2605mm。细分形式建议以官方配置表复核。',
    src: '车质网周度上市汇总（汽车之家转载）', srcUrl: 'https://chejiahao.m.autohome.com.cn/pingan/chejiahao/detailinfo/26221854', img: ''
  },
  {
    id: 'seal06-my27', name: '2027款海豹06', brand: '比亚迪', power: '纯电+插混', seg: '中型轿车',
    price: 'DM-i 9.99万起 / EV 10.99万起', launchDate: '2026-08-11', range: 'EV CLTC 530/630km', adas: '高配天神之眼5.0', cockpit: '—', caliber: 'media',
    usp: ['12款配置、DM-i+EV双线', 'EV电机120/240kW', '第五代DM插混'],
    desc: '改款上市，DM-i 9.99-14.19万、EV 10.99-15.59万；DM-i纯电230/320km。',
    src: '车质网周度上市汇总', srcUrl: 'https://chejiahao.m.autohome.com.cn/pingan/chejiahao/detailinfo/26221854', img: ''
  },
  {
    id: 'qinmax', name: '比亚迪秦MAX', brand: '比亚迪', power: '纯电+插混', seg: '中型轿车',
    price: '9.99-14.39万', launchDate: '2026-08-13', range: 'EV CLTC 530/630km / DM-i综合2370km', adas: '高配天神之眼', cockpit: '—', caliber: 'media',
    usp: ['第二代刀片电池52.868/64.315kWh', '闪充10%→70%约5分钟', 'DM-i亏电油耗2.59L'],
    desc: '全新车系，EV+DM-i共9款，轴距2820mm；EV高配240kW、零百5.9s。',
    src: '易车/太平洋汽车参数库', srcUrl: 'https://news.yiche.com/hao/wenzhang/112275320/', img: ''
  },
  {
    id: 'v8x', name: '魏牌 V8X', brand: '魏牌（长城）', power: '插混', seg: '中大型SUV',
    price: '23.98-31.58万（限时22.68万起）', launchDate: '2026-08-14', range: '纯电402km / 综合最高1659km', adas: '—', cockpit: '—', caliber: 'official',
    usp: ['2.0T超级Hi4+4挡DHT+800V+6C', '66.6kWh电池、5分钟补能170km', '系统综合500kW、零百4.5s'],
    desc: '大五座SUV 5款上市；闭式双腔空悬+EDC，车长5125mm、轴距3050mm。',
    src: '新华网/央视网', srcUrl: 'http://www.xinhuanet.com/auto/20260819/e6875d340c3b4e04ab04c024d9f2ef5c/c.html', img: ''
  },
  {
    id: 'zhuiguang-s', name: '岚图追光S', brand: '岚图（东风）', power: '纯电', seg: '轿跑SUV',
    price: '22.99-27.98万（限时22.39万起）', launchDate: '2026-08-15', range: 'CLTC 630/740km', adas: '华为乾崑ADS 5（四激光含896线）', cockpit: '鸿蒙座舱5.2', caliber: 'official',
    usp: ['全球首发98kWh琥珀电池2.0', '全域800V 5C，15分钟补能577km', '四驱475kW、零百3秒级'],
    desc: '纯电FUV/轿跑SUV 3款上市，车长5050mm、轴距3000mm；20%→80%约10分钟。',
    src: '东风汽车官网', srcUrl: 'https://www.dfmc.com.cn/news/company/news_20260817_0924.html', img: ''
  },
  {
    id: 'l6-im', name: '全新一代智己L6（预售）', brand: '智己（上汽）', power: '纯电', seg: '中型轿车',
    price: '预售21.99-26.99万', launchDate: '2026-08-18（预售）', range: 'CLTC最高850km', adas: '—', cockpit: '—', caliber: 'media',
    usp: ['NEO三电架构、宁德93kWh电池', '两驱电耗低至11.6kWh/100km', '全线控底盘（后轮转向+MKC2线控制动）'],
    desc: '预售权益价21.99万起；全系800V、最高396kW超快充。最终参数以上市官方稿为准。',
    src: '财联社汽车早报', srcUrl: 'https://www.cls.cn/detail/2457784', img: ''
  },
  {
    id: 'tai7-dm', name: '方程豹钛7 DM长续航版', brand: '方程豹（比亚迪）', power: '插混', seg: '方盒子SUV',
    price: '19.58-22.58万', launchDate: '2026-08-18', range: 'CLTC纯电300/315km', adas: '—', cockpit: '—', caliber: 'media',
    usp: ['电池升级至50kWh', '电机200/360kW', '零百最快4.5s'],
    desc: '2款配置上市，1.5T混动专用发动机115kW。',
    src: '车质网第34周汇总', srcUrl: 'http://news.qq.com/rain/a/20260825A03OUU00', img: ''
  },
  {
    id: 'g9-xiangjie', name: '享界 G9', brand: '鸿蒙智行/北汽', power: '增程+纯电', seg: '硬派SUV',
    price: '42.98-54.98万', launchDate: '2026-08-20', range: '纯电最高728km / 增程综合1366km', adas: '全车系L3架构、120km/h L3测试牌照', cockpit: '—', caliber: 'official',
    usp: ['纯电120kWh、800V快充15分钟+300km', '双电机437kW、单轮峰值5000N·m', '全球首发800V全主动可断开稳定杆'],
    desc: '五/六座10款上市，轴距3160mm；增程56/75kWh；同场智界RX预售、问界M6增程版上新。',
    src: '中国经济网/鸿蒙智行配置表', srcUrl: 'http://auto.ce.cn/auto/gundong/202608/t20260821_3162213.shtml', img: ''
  },
  {
    id: 'g318-new', name: '全新深蓝G318', brand: '深蓝（长安）', power: '增程', seg: '方盒子SUV',
    price: '限时19.68-23.68万', launchDate: '2026-08-21', range: '纯电200km / 综合超1000km', adas: '华为乾崑ADS 5 Pro+舱内激光Limera', cockpit: '鸿蒙座舱5', caliber: 'media',
    usp: ['1.5T增程、前后双电机450Ps', '27传感器', '空悬+CDC魔毯'],
    desc: '增程中大型方盒子SUV 3款上市。',
    src: '汽车之家现场报道', srcUrl: 'http://chejiahao.autohome.com.cn/info/26260566', img: ''
  },
  {
    id: 'taitan700', name: '北京越野 泰钽700', brand: '北京越野', power: '增程', seg: '硬派SUV',
    price: '27.98-37.98万（焕新24.98万起）', launchDate: '2026-08-25', range: '纯电220km / 综合1340km', adas: '华为乾崑ADS 5、896线激光雷达、越野NOA', cockpit: '—', caliber: 'media',
    usp: ['1.5T魔核增程、系统综合391kW', '非承载车身', '官方称行业首创越野NOA'],
    desc: '中大型豪华硬派SUV 3款上市。',
    src: '车质网第35周汇总', srcUrl: 'https://chejiahao.m.autohome.com.cn/pingan/chejiahao/detailinfo/26353080', img: ''
  },
  {
    id: 'fengyun-t7', name: '奇瑞风云T7', brand: '奇瑞', power: '纯电', seg: '紧凑型SUV',
    price: '9.79-11.89万', launchDate: '2026-08-26', range: 'CLTC 600km', adas: '—', cockpit: '—', caliber: 'media',
    usp: ['65.05kWh国轩高科磷酸铁锂', '单电机178kW', '10万级600km续航'],
    desc: '全新车系3款上市，车长4570mm、轴距2700mm。',
    src: '车质网第35周汇总', srcUrl: 'https://chejiahao.m.autohome.com.cn/pingan/chejiahao/detailinfo/26353080', img: ''
  },
  {
    id: 'ora5gt', name: '欧拉5GT / 5运动款', brand: '欧拉（长城）', power: '纯电（另有HEV/燃油）', seg: '紧凑轿跑',
    price: '5GT 9.98万起 / 运动款8.18万起', launchDate: '2026-08-28', range: 'CLTC 550km（580km待核实）', adas: 'Coffee Pilot 3城市NOA', cockpit: '—', caliber: 'official',
    usp: ['蜂巢14合1电驱150kW、58.3kWh', '纯电版零百7.4s', '城市NOA'],
    desc: '成都车展上市，纯电/HEV/燃油三动力；续航550/580km两说，待核实。',
    src: '欧拉官网/易车', srcUrl: 'https://www.oraev.com/news_3403983.html', img: ''
  }
];

var TECHS = [
  { id: 't1', date: '08-07', company: '蔚来', domain: 'charging', title: '第五代换电站投运 + 第4000座换电站落成',
    point: '第五代换电站在北京、上海、广州等7城首批投运：自研新一代换电平台实时调整定位电池螺栓，最大支持3.5米轴距，覆盖小车到全尺寸SUV，三品牌全系兼容；累计换电超1.2亿次，换电站达4006座。',
    params: '支持3.5m轴距；首批7城；累计换电1.2亿次；站点4006座',
    caliber: 'official', impact: 'high',
    impactNote: '换电网络进入第五代平台+4000站规模阶段',
    metrics: [
      { label: '支持最大轴距', value: '3.5m' },
      { label: '累计换电', value: '1.2亿次' },
      { label: '换电站', value: '4006座' }
    ],
    src: '蔚来官网', srcUrl: 'https://www.nio.cn/news/20260807001' },
  { id: 't2', date: '08-07', company: '工信部（强制性国标）', domain: 'safety', title: 'L3/L4自动驾驶系统安全要求强制性国标获批发布',
    point: '我国首部L3/L4级自动驾驶强制性国标获批发布，适用M/N类车，划定统一安全准入基线（L3须具备接管监测、最小风险策略等），2027年7月1日实施；与6月L2级强标构成L2-L4监管体系。',
    params: '国内首部L3/L4强标；2027-07-01实施；适用M/N类车',
    caliber: 'cert', impact: 'high',
    impactNote: 'L3量产合规通道打开，智驾法规体系成型',
    metrics: [
      { label: '标准级别', value: 'L3/L4 强标' },
      { label: '实施日期', value: '2027-07-01' }
    ],
    src: '新华网/央视网', srcUrl: 'https://www.news.cn/sci-tech/20260807/203f334499b04ddc823905b1bd28eb80/c.html' },
  { id: 't3', date: '08-09', company: '宁德时代', domain: 'charging', title: '全球首款方壳电芯航空动力电池通过热失控不扩散验证',
    point: '方壳电芯航空动力电池能量密度达350Wh/kg（官方称较常规电动车电池高约50%），包内中部/边角相邻双电芯同时触发不起火不蔓延；全程在民航局（CAAC）指定代表监督下完成，已具备量产条件，将率先用于峰飞载人eVTOL。',
    params: '350Wh/kg（+50%）；双电芯触发不起火；CAAC监督；eVTOL首发',
    caliber: 'official', impact: 'medium',
    impactNote: '高能量密度+热不扩散打通电动航空准入',
    metrics: [
      { label: '能量密度', value: '350Wh/kg', compare: '较常规+50%', direction: 'up' },
      { label: '验证场景', value: '双电芯热失控不扩散' }
    ],
    src: 'CATL英文官网', srcUrl: 'https://www.catl.com/en/news/6948.html' },
  { id: 't4', date: '08-13', company: '中保研（C-IASI）', domain: 'safety', title: '中国保险汽车安全指数测试评价规程（2026版）发布',
    point: '发布含8个分规程的2026版规程，新增/修订《新能源汽车专项指数》及《动力电池包低速托底测试评价规程》，纳入翻滚保护、大倾角座椅乘员保护、救援逃生等工况，2027年3月1日实施。',
    params: '8个分规程；新增电池包低速托底；2027-03-01实施',
    caliber: 'cert', impact: 'high',
    impactNote: '与7月实施的GB 38031形成托底安全的标准呼应',
    metrics: [
      { label: '分规程', value: '8个' },
      { label: '实施日期', value: '2027-03-01' }
    ],
    src: '中保研官网', srcUrl: 'https://ciasi.org.cn/news/show-125.html' },
  { id: 't5', date: '08-19', company: '博世×地平线', domain: 'hmi', title: '基于征程6B的第四代多功能摄像头MPC4获千万套级量产定点',
    point: '基于地平线征程6B（自研BPU纳什架构，支撑L2/主动安全）的博世MPC4平台获千万套级量产定点，覆盖40余款车型，首个项目2026Q3量产；征程6B累计定点已破2000万套。',
    params: '订单千万套级；覆盖40+款车型；征程6B累计定点破2000万套',
    caliber: 'media', impact: 'medium',
    impactNote: '国产智驾芯片进入国际Tier1规模供应链',
    metrics: [
      { label: '平台定点', value: '千万套级' },
      { label: '覆盖车型', value: '40+款' },
      { label: '征程6B累计定点', value: '破2000万套' }
    ],
    src: '中国证券报·中证网', srcUrl: 'https://www.cs.com.cn/ssgs/01/2026/08/19/detail_2026081910032309.html' },
  { id: 't6', date: '08-20', company: '华为', domain: 'handling', title: '全地形途灵平台首发：800V全主动可断开稳定杆',
    point: '随享界G9上市首发全地形途灵平台：全球首发800V全主动可断开稳定杆（高压瞬态建扭、毫秒级姿态预判/解耦）+智擎自适应牙嵌式差速锁电驱（约0.2s响应）；双阀CDC阻尼范围较单阀提升50%以上，±12°后轮转向、转弯半径5.2m、涉水800mm。',
    params: '稳定杆800V；CDC阻尼+50%；后轮转向±12°；转弯半径5.2m；涉水800mm；差速锁响应0.2s',
    caliber: 'official', impact: 'high',
    impactNote: '底盘主动化进入高压执行器时代',
    metrics: [
      { label: 'CDC阻尼范围', value: '提升50%以上', direction: 'up' },
      { label: '后轮转向', value: '±12°' },
      { label: '转弯半径', value: '5.2m' },
      { label: '涉水深度', value: '800mm' },
      { label: '差速锁响应', value: '0.2s' }
    ],
    src: '中国经济网', srcUrl: 'http://auto.ce.cn/auto/gundong/202608/t20260821_3162213.shtml' },
  { id: 't7', date: '08-24', company: '宝马MINI（中国）', domain: 'hmi', title: 'MINI智能个人助理Spike进入"AI双核"时代',
    point: '全新MINI家族通过RSU远程升级接入阿里巴巴大语言模型与DeepSeek（订阅后开启DeepSeek深度思考），强化多轮对话与复合指令车控；官方披露Spike月活长期超90%、OTA主动安装率超85%。',
    params: '接入阿里大模型+DeepSeek；Spike月活>90%；OTA安装率>85%',
    caliber: 'official', impact: 'medium',
    impactNote: '国际品牌座舱大模型转向中国本土双供应商',
    metrics: [
      { label: 'Spike月活', value: '>90%' },
      { label: 'OTA安装率', value: '>85%' }
    ],
    src: '网通社/鞭牛士', srcUrl: 'http://auto.news18a.com/news/storys_289860.html' },
  { id: 't8', date: '08-27', company: '中保研（C-IASI）', domain: 'safety', title: '2025年测评车型第五次结果发布（含小米YU7）',
    point: '发布2025年第五次测评结果：奔驰E级、小米YU7；小米YU7车内乘员、车外行人、辅助安全三项获G评价，新能源专项获G。',
    params: '小米YU7三项G+新能源专项G',
    caliber: 'cert', impact: 'medium',
    impactNote: '新势力新车安全评价获全优，安全成标配竞争点',
    metrics: [
      { label: '小米YU7评价', value: '三项G + 新能源专项G' }
    ],
    src: '中保研官网', srcUrl: 'https://ciasi.org.cn/news/show-126.html' }
];

var TRENDS = [
  { t: 'L2-L4法规体系闭环成型', d: '8月7日国内首部L3/L4强标获批（2027年7月实施），与6月L2强标、7月实施的GB 38031电池强标、8月C-IASI 2026版规程共同构成"辅助-自动驾驶+电池+保险指数"的完整监管框架。' },
  { t: '800V高压主动底盘上车越野旗舰', d: '华为随享界G9首发800V全主动可断开稳定杆、自适应牙嵌差速锁（0.2s响应），岚图追光S首发98kWh琥珀电池2.0，高压平台从三电延伸到底盘执行器。' },
  { t: '座舱大模型本土双供应商化', d: 'MINI Spike通过OTA同时接入阿里大模型与DeepSeek；8月上市新车（追光S、深蓝G318）普遍标配华为ADS 5与鸿蒙座舱5，AI座舱供应链走向多模型可选。' }
];

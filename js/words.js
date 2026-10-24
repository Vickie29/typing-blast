/* 打字爆破 · 词库与数据层（阶段 2 + 增量扩充）
   TB.Words：内置词库、抽词、词条校验
   TB.Storage：最高分、自定义词库 CRUD、导入导出 */
(function () {
  'use strict';
  window.TB = window.TB || {};

  /* ---------- 内置词库：打工人模式（含彩蛋词：下班 / 放假 / 发工资 / 下课） ---------- */
  const WORKER_PACK = [
    /* 原始词库 */
    { word: '对齐颗粒度', pinyin: 'dui qi ke li du' },
    { word: '赋能', pinyin: 'fu neng' },
    { word: '闭环', pinyin: 'bi huan' },
    { word: '抓手', pinyin: 'zhua shou' },
    { word: '颗粒度', pinyin: 'ke li du' },
    { word: '打法', pinyin: 'da fa' },
    { word: '沉淀', pinyin: 'chen dian' },
    { word: '复盘', pinyin: 'fu pan' },
    { word: '拉通', pinyin: 'la tong' },
    { word: '落地', pinyin: 'luo di' },
    { word: '组合拳', pinyin: 'zu he quan' },
    { word: '底层逻辑', pinyin: 'di ceng luo ji' },
    { word: '顶层设计', pinyin: 'ding ceng she ji' },
    { word: '心智', pinyin: 'xin zhi' },
    { word: '链路', pinyin: 'lian lu' },
    { word: '向上管理', pinyin: 'xiang shang guan li' },
    { word: '周报', pinyin: 'zhou bao' },
    { word: '早八', pinyin: 'zao ba' },
    { word: '内卷', pinyin: 'nei juan' },
    { word: '躺平', pinyin: 'tang ping' },
    { word: '画饼', pinyin: 'hua bing' },
    { word: '背锅', pinyin: 'bei guo' },
    { word: '需求评审', pinyin: 'xu qiu ping shen' },
    { word: '拉齐', pinyin: 'la qi' },
    { word: '对焦', pinyin: 'dui jiao' },
    { word: '输出口径', pinyin: 'shu chu kou jing' },
    { word: '开会', pinyin: 'kai hui' },
    { word: '加班', pinyin: 'jia ban' },
    { word: '下班', pinyin: 'xia ban' },
    { word: '放假', pinyin: 'fang jia' },
    { word: '发工资', pinyin: 'fa gong zi' },
    { word: '下课', pinyin: 'xia ke' },
    { word: '述职', pinyin: 'shu zhi' },
    { word: '串联', pinyin: 'chuan lian' },
    { word: '反哺', pinyin: 'fan bu' },
    { word: '击穿', pinyin: 'ji chuan' },
    { word: '打通', pinyin: 'da tong' },
    { word: '解耦', pinyin: 'jie ou' },
    { word: '耦合', pinyin: 'ou he' },
    { word: '兜底', pinyin: 'dou di' },
    { word: '卡点', pinyin: 'ka dian' },
    { word: '对标', pinyin: 'dui biao' },
    { word: '引爆点', pinyin: 'yin bao dian' },
    { word: '增量', pinyin: 'zeng liang' },
    { word: '存量', pinyin: 'cun liang' },
    { word: '留存', pinyin: 'liu cun' },
    { word: '转化率', pinyin: 'zhuan hua lv' },
    { word: '日活', pinyin: 'ri huo' },
    { word: '月报', pinyin: 'yue bao' },
    { word: '晨会', pinyin: 'chen hui' },
    { word: '站会', pinyin: 'zhan hui' },
    { word: '团建', pinyin: 'tuan jian' },
    { word: '考核', pinyin: 'kao he' },
    { word: '绩效', pinyin: 'ji xiao' },
    { word: '优化', pinyin: 'you hua' },
    { word: '迭代', pinyin: 'die dai' },
    { word: '排期', pinyin: 'pai qi' },
    { word: '延期', pinyin: 'yan qi' },
    { word: '需求变更', pinyin: 'xu qiu bian geng' },
    { word: '上线', pinyin: 'shang xian' },
    { word: '回滚', pinyin: 'hui gun' },
    { word: '线上事故', pinyin: 'xian shang shi gu' },
    { word: '甩锅', pinyin: 'shuai guo' },
    { word: '摸鱼', pinyin: 'mo yu' },
    { word: '划水', pinyin: 'hua shui' },
    { word: '带薪摸鱼', pinyin: 'dai xin mo yu' },
    { word: '甲方', pinyin: 'jia fang' },
    { word: '临时需求', pinyin: 'lin shi xu qiu' },
    { word: '头部玩家', pinyin: 'tou bu wan jia' },
    { word: '私域流量', pinyin: 'si yu liu liang' },
    { word: '长期主义', pinyin: 'chang qi zhu yi' },
    { word: '降本增效', pinyin: 'jiang ben zeng xiao' },
    { word: '护城河', pinyin: 'hu cheng he' },
    { word: '方法论', pinyin: 'fang fa lun' },
    { word: '执行力', pinyin: 'zhi xing li' },
    { word: '闭环思维', pinyin: 'bi huan si wei' },
    { word: '用户画像', pinyin: 'yong hu hua xiang' },
    { word: '痛点', pinyin: 'tong dian' },
    { word: '抓大放小', pinyin: 'zhua da fang xiao' },
    { word: '对齐一下', pinyin: 'dui qi yi xia' },
    { word: '稍后同步', pinyin: 'shao hou tong bu' },
    { word: '卷王', pinyin: 'juan wang' },
    /* 扩充：黑话进阶 */
    { word: '草台班子', pinyin: 'cao tai ban zi' },
    { word: '班味', pinyin: 'ban wei' },
    { word: '去班味', pinyin: 'qu ban wei' },
    { word: '精神离职', pinyin: 'jing shen li zhi' },
    { word: '精神内耗', pinyin: 'jing shen nei hao' },
    { word: '情绪价值', pinyin: 'qing xu jia zhi' },
    { word: '情绪管理', pinyin: 'qing xu guan li' },
    { word: '双向奔赴', pinyin: 'shuang xiang ben fu' },
    { word: '期望管理', pinyin: 'qi wang guan li' },
    { word: '结果导向', pinyin: 'jie guo dao xiang' },
    { word: '数据说话', pinyin: 'shu ju shuo hua' },
    { word: '拉齐认知', pinyin: 'la qi ren zhi' },
    { word: '信息对齐', pinyin: 'xin xi dui qi' },
    { word: '同步进度', pinyin: 'tong bu jin du' },
    { word: '助力', pinyin: 'zhu li' },
    { word: '飞轮', pinyin: 'fei lun' },
    { word: '增长黑客', pinyin: 'zeng chang hei ke' },
    { word: '流量密码', pinyin: 'liu liang mi ma' },
    { word: '破圈', pinyin: 'po quan' },
    { word: '品牌调性', pinyin: 'pin pai diao xing' },
    { word: '用户黏性', pinyin: 'yong hu nian xing' },
    { word: '精细化运营', pinyin: 'jing xi hua yun ying' },
    { word: '全链路', pinyin: 'quan lian lu' },
    { word: '端到端', pinyin: 'duan dao duan' },
    { word: '一把手', pinyin: 'yi ba shou' },
    { word: '主人翁精神', pinyin: 'zhu ren weng jing shen' },
    { word: '狼性文化', pinyin: 'lang xing wen hua' },
    { word: '主人翁意识', pinyin: 'zhu ren weng yi shi' },
    { word: '抗压能力', pinyin: 'kang ya neng li' },
    { word: '边界感', pinyin: 'bian jie gan' },
    { word: '松弛感', pinyin: 'song chi gan' },
    { word: '钝感力', pinyin: 'dun gan li' },
    { word: '上进心', pinyin: 'shang jin xin' },
    /* 扩充：职场吐槽 */
    { word: '打工人', pinyin: 'da gong ren' },
    { word: '在吗', pinyin: 'zai ma' },
    { word: '收到请回复', pinyin: 'shou dao qing hui fu' },
    { word: '已读不回', pinyin: 'yi du bu hui' },
    { word: '韭菜', pinyin: 'jiu cai' },
    { word: '割韭菜', pinyin: 'ge jiu cai' },
    { word: '福报', pinyin: 'fu bao' },
    { word: '大饼', pinyin: 'da bing' },
    { word: '画大饼', pinyin: 'hua da bing' },
    { word: '弹性工作', pinyin: 'tan xing gong zuo' },
    { word: '自愿加班', pinyin: 'zi yuan jia ban' },
    { word: '加班文化', pinyin: 'jia ban wen hua' },
    { word: '带薪拉屎', pinyin: 'dai xin la shi' },
    { word: '破防了', pinyin: 'po fang le' },
    { word: '心态崩了', pinyin: 'xin tai beng le' },
    { word: 'emo了', pinyin: 'emo le' },
    { word: '卷不动了', pinyin: 'juan bu dong le' },
    { word: '摆烂', pinyin: 'bai lan' },
    { word: '发际线', pinyin: 'fa ji xian' },
    { word: '秃了', pinyin: 'tu le' },
    { word: '保温杯泡枸杞', pinyin: 'bao wen bei pao gou qi' },
    { word: '熬夜冠军', pinyin: 'ao ye guan jun' },
    { word: '咖啡续命', pinyin: 'ka fei xu ming' },
    { word: '奶茶自由', pinyin: 'nai cha zi you' },
    { word: '干饭人', pinyin: 'gan fan ren' },
    { word: '尾款人', pinyin: 'wei kuan ren' },
    { word: '双十一', pinyin: 'shuang shi yi' },
    { word: '优惠券', pinyin: 'you hui quan' },
    { word: '退款', pinyin: 'tui kuan' },
    { word: '满减', pinyin: 'man jian' },
    { word: '拼单', pinyin: 'pin dan' },
    { word: '下午茶', pinyin: 'xia wu cha' },
    { word: '外卖', pinyin: 'wai mai' },
    { word: '通勤', pinyin: 'tong qin' },
    { word: '通勤两小时', pinyin: 'tong qin liang xiao shi' },
    { word: '早高峰', pinyin: 'zao gao feng' },
    { word: '挤地铁', pinyin: 'ji di tie' },
    /* 扩充：职业与钱 */
    { word: '上岸', pinyin: 'shang an' },
    { word: '内推', pinyin: 'nei tui' },
    { word: '转正', pinyin: 'zhuan zheng' },
    { word: '试用期', pinyin: 'shi yong qi' },
    { word: '五险一金', pinyin: 'wu xian yi jin' },
    { word: '年终奖', pinyin: 'nian zhong jiang' },
    { word: '十三薪', pinyin: 'shi san xin' },
    { word: '涨薪', pinyin: 'zhang xin' },
    { word: '降薪', pinyin: 'jiang xin' },
    { word: '裁员', pinyin: 'cai yuan' },
    { word: '被优化', pinyin: 'bei you hua' },
    { word: '毕业', pinyin: 'bi ye' },
    { word: '跳槽', pinyin: 'tiao cao' },
    { word: '裸辞', pinyin: 'luo ci' },
    { word: '提离职', pinyin: 'ti li zhi' },
    { word: '工位', pinyin: 'gong wei' },
    { word: '报销', pinyin: 'bao xiao' },
    { word: '走流程', pinyin: 'zou liu cheng' },
    { word: '审批', pinyin: 'shen pi' },
    { word: '催进度', pinyin: 'cui jin du' },
    /* 扩充：会议与需求 */
    { word: '开放式办公', pinyin: 'kai fang shi ban gong' },
    { word: '视频会议', pinyin: 'shi pin hui yi' },
    { word: '已开麦', pinyin: 'yi kai mai' },
    { word: '请闭麦', pinyin: 'qing bi mai' },
    { word: '会议纪要', pinyin: 'hui yi ji yao' },
    { word: '紧急', pinyin: 'jin ji' },
    { word: '明天上线', pinyin: 'ming tian shang xian' },
    { word: '先上线再说', pinyin: 'xian shang xian zai shuo' },
    { word: '小问题', pinyin: 'xiao wen ti' },
    { word: '很简单', pinyin: 'hen jian dan' },
    { word: '五分钟搞定', pinyin: 'wu fen zhong gao ding' },
    { word: '临时插入', pinyin: 'lin shi cha ru' },
    { word: '优先级高', pinyin: 'you xian ji gao' },
    { word: '老板觉得', pinyin: 'lao ban jue de' },
    { word: '甲方爸爸', pinyin: 'jia fang ba ba' },
    { word: '需求文档', pinyin: 'xu qiu wen dang' },
    { word: '原型图', pinyin: 'yuan xing tu' },
    { word: '做不了', pinyin: 'zuo bu liao' },
    { word: '提测', pinyin: 'ti ce' },
    { word: '回归测试', pinyin: 'hui gui ce shi' },
    { word: '灰度发布', pinyin: 'hui du fa bu' },
    { word: '待办', pinyin: 'dai ban' },
    { word: '待跟进', pinyin: 'dai gen jin' },
    { word: '卡住了', pinyin: 'ka zhu le' },
    { word: '阻塞', pinyin: 'zu se' },
    { word: '排期紧张', pinyin: 'pai qi jin zhang' },
    { word: '人手不够', pinyin: 'ren shou bu gou' },
    { word: '身兼数职', pinyin: 'shen jian shu zhi' },
    { word: '分身乏术', pinyin: 'fen shen fa shu' },
    { word: '下班了再说', pinyin: 'xia ban le zai shuo' },
    { word: '明天再说', pinyin: 'ming tian zai shuo' },
    { word: '团队氛围', pinyin: 'tuan dui fen wei' },
    /* 扩充：学生党 */
    { word: '课设', pinyin: 'ke she' },
    { word: '答辩', pinyin: 'da bian' },
    { word: '查重', pinyin: 'cha zhong' },
    { word: '导师', pinyin: 'dao shi' },
    { word: '组会', pinyin: 'zu hui' },
    { word: '文献综述', pinyin: 'wen xian zong shu' },
    { word: '开题', pinyin: 'kai ti' },
    { word: '盲审', pinyin: 'mang shen' },
    { word: '延毕', pinyin: 'yan bi' },
    { word: '考研', pinyin: 'kao yan' },
    { word: '考公', pinyin: 'kao gong' },
    { word: '秋招', pinyin: 'qiu zhao' },
    { word: '春招', pinyin: 'chun zhao' },
    { word: '网申', pinyin: 'wang shen' },
    { word: '笔试', pinyin: 'bi shi' },
    { word: '群面', pinyin: 'qun mian' },
    { word: '拿offer', pinyin: 'na offer' },
    { word: '赶ddl', pinyin: 'gan ddl' }
  ];

  /* ---------- 内置词库：四六级模式 ---------- */
  const CET6_PACK = [
    /* 原始词库 */
    { meaning: '使沮丧的', word: 'depressed' },
    { meaning: '截止期限', word: 'deadline' },
    { meaning: '加班', word: 'overtime' },
    { meaning: '优先事项', word: 'priority' },
    { meaning: '妥协', word: 'compromise' },
    { meaning: '不可避免的', word: 'inevitable' },
    { meaning: '筋疲力尽的', word: 'exhausted' },
    { meaning: '拖延', word: 'procrastinate' },
    { meaning: '作业', word: 'assignment' },
    { meaning: '论文', word: 'thesis' },
    { meaning: '复习', word: 'review' },
    { meaning: '考试', word: 'exam' },
    { meaning: '讲座', word: 'lecture' },
    { meaning: '学期', word: 'semester' },
    { meaning: '奖学金', word: 'scholarship' },
    { meaning: '实习', word: 'internship' },
    { meaning: '简历', word: 'resume' },
    { meaning: '面试', word: 'interview' },
    { meaning: '晋升', word: 'promotion' },
    { meaning: '薪水', word: 'salary' },
    { meaning: '补贴', word: 'allowance' },
    { meaning: '预算', word: 'budget' },
    { meaning: '会议', word: 'meeting' },
    { meaning: '同事', word: 'colleague' },
    { meaning: '上司', word: 'supervisor' },
    { meaning: '客户', word: 'client' },
    { meaning: '报告', word: 'report' },
    { meaning: '摘要', word: 'summary' },
    { meaning: '草稿', word: 'draft' },
    { meaning: '修改', word: 'revise' },
    { meaning: '提交', word: 'submit' },
    { meaning: '反馈', word: 'feedback' },
    { meaning: '评价', word: 'evaluation' },
    { meaning: '批评', word: 'criticize' },
    { meaning: '表扬', word: 'praise' },
    { meaning: '压力', word: 'stress' },
    { meaning: '焦虑的', word: 'anxious' },
    { meaning: '崩溃', word: 'breakdown' },
    { meaning: '疲惫的', word: 'tired' },
    { meaning: '放松', word: 'relax' },
    { meaning: '假期', word: 'vacation' },
    { meaning: '周末', word: 'weekend' },
    { meaning: '娱乐', word: 'entertainment' },
    { meaning: '失眠', word: 'insomnia' },
    { meaning: '咖啡因', word: 'caffeine' },
    { meaning: '专注', word: 'focus' },
    { meaning: '分心的', word: 'distracted' },
    { meaning: '效率', word: 'efficiency' },
    { meaning: '动力', word: 'motivation' },
    { meaning: '目标', word: 'goal' },
    { meaning: '日程', word: 'schedule' },
    { meaning: '紧急的', word: 'urgent' },
    { meaning: '重要的', word: 'essential' },
    { meaning: '困难的', word: 'challenging' },
    { meaning: '复杂的', word: 'complicated' },
    { meaning: '明显的', word: 'obvious' },
    { meaning: '暂时的', word: 'temporary' },
    { meaning: '永久的', word: 'permanent' },
    { meaning: '充足的', word: 'adequate' },
    { meaning: '匮乏的', word: 'scarce' },
    { meaning: '谨慎的', word: 'cautious' },
    { meaning: '固执的', word: 'stubborn' },
    { meaning: '犹豫', word: 'hesitate' },
    { meaning: '放弃', word: 'abandon' },
    { meaning: '完成', word: 'accomplish' },
    { meaning: '改进', word: 'improve' },
    { meaning: '降低', word: 'reduce' },
    { meaning: '积累', word: 'accumulate' },
    { meaning: '分析', word: 'analyze' },
    { meaning: '总结', word: 'conclude' },
    { meaning: '记忆', word: 'memorize' },
    { meaning: '理解', word: 'comprehend' },
    { meaning: '忽视', word: 'ignore' },
    { meaning: '忍耐', word: 'endure' },
    { meaning: '适应', word: 'adapt' },
    { meaning: '乐观的', word: 'optimistic' },
    { meaning: '悲观的', word: 'pessimistic' },
    { meaning: '满意的', word: 'satisfied' },
    { meaning: '失望的', word: 'disappointed' },
    { meaning: '尴尬的', word: 'awkward' },
    { meaning: '困惑的', word: 'confused' },
    { meaning: '后悔', word: 'regret' },
    { meaning: '鼓励', word: 'encourage' },
    { meaning: '职业倦怠', word: 'burnout' },
    /* 扩充：校园 */
    { meaning: '学费', word: 'tuition' },
    { meaning: '选修课', word: 'elective' },
    { meaning: '必修课', word: 'compulsory' },
    { meaning: '学分', word: 'credit' },
    { meaning: '绩点', word: 'gpa' },
    { meaning: '补考', word: 'resit' },
    { meaning: '逃课', word: 'skip class' },
    { meaning: '点名', word: 'roll call' },
    { meaning: '图书馆', word: 'library' },
    { meaning: '自习', word: 'self study' },
    { meaning: '笔记', word: 'notes' },
    { meaning: '课件', word: 'slides' },
    { meaning: '期末考', word: 'final' },
    { meaning: '期中考', word: 'midterm' },
    { meaning: '挂科', word: 'flunk' },
    { meaning: '重修', word: 'retake' },
    { meaning: '论文查重', word: 'plagiarism' },
    { meaning: '参考文献', word: 'references' },
    { meaning: '导师', word: 'tutor' },
    { meaning: '实验室', word: 'laboratory' },
    { meaning: '数据', word: 'data' },
    { meaning: '问卷', word: 'questionnaire' },
    { meaning: '采样', word: 'sampling' },
    { meaning: '变量', word: 'variable' },
    { meaning: '假设', word: 'hypothesis' },
    { meaning: '结果', word: 'outcome' },
    { meaning: '实验', word: 'experiment' },
    { meaning: '报告厅', word: 'auditorium' },
    { meaning: '社团', word: 'club' },
    { meaning: '志愿者', word: 'volunteer' },
    { meaning: '军训', word: 'training' },
    { meaning: '宿舍', word: 'dormitory' },
    { meaning: '室友', word: 'roommate' },
    { meaning: '断电', word: 'power cut' },
    { meaning: '澡堂', word: 'bathhouse' },
    { meaning: '食堂', word: 'canteen' },
    /* 扩充：生活与情绪 */
    { meaning: '快递', word: 'express' },
    { meaning: '外卖员', word: 'courier' },
    { meaning: '谈恋爱', word: 'romance' },
    { meaning: '分手', word: 'breakup' },
    { meaning: '单恋', word: 'crush' },
    { meaning: '相亲', word: 'blind date' },
    { meaning: '秃头', word: 'bald' },
    { meaning: '脱发', word: 'hair loss' },
    { meaning: '黑眼圈', word: 'dark circles' },
    { meaning: '熬夜', word: 'stay up' },
    { meaning: '闹钟', word: 'alarm' },
    { meaning: '打卡', word: 'clock in' },
    { meaning: '通宵', word: 'all nighter' },
    { meaning: '冲刺', word: 'sprint' },
    { meaning: '划水', word: 'slacking' },
    { meaning: '无聊的', word: 'bored' },
    { meaning: '兴奋的', word: 'excited' },
    { meaning: '平静的', word: 'calm' },
    { meaning: '烦躁的', word: 'irritated' },
    { meaning: '委屈的', word: 'wronged' },
    { meaning: '无语的', word: 'speechless' },
    { meaning: '心累的', word: 'drained' },
    { meaning: '充实的', word: 'fulfilled' },
    { meaning: '空虚的', word: 'empty' },
    { meaning: '迷茫的', word: 'lost' },
    { meaning: '坚定的', word: 'determined' },
    { meaning: '优柔寡断的', word: 'indecisive' },
    { meaning: '冲动的', word: 'impulsive' },
    { meaning: '理性的', word: 'rational' },
    { meaning: '感性的', word: 'emotional' },
    { meaning: '敏感的', word: 'sensitive' },
    { meaning: '冷漠的', word: 'indifferent' },
    { meaning: '热情的', word: 'passionate' },
    { meaning: '认真的', word: 'earnest' },
    /* 扩充：职场与钱 */
    { meaning: '带薪休假', word: 'paid leave' },
    { meaning: '病假', word: 'sick leave' },
    { meaning: '出差', word: 'business trip' },
    { meaning: '加薪', word: 'raise' },
    { meaning: '奖金', word: 'bonus' },
    { meaning: '罚款', word: 'fine' },
    { meaning: '报销', word: 'reimbursement' },
    { meaning: '发票', word: 'invoice' },
    { meaning: '预算削减', word: 'budget cut' },
    { meaning: '成本', word: 'cost' },
    { meaning: '利润', word: 'profit' },
    { meaning: '亏损', word: 'loss' },
    { meaning: '裁员', word: 'layoff' },
    { meaning: '猎头', word: 'headhunter' },
    { meaning: '录用通知', word: 'offer' },
    { meaning: '冗长的', word: 'lengthy' },
    { meaning: '低效的', word: 'inefficient' },
    { meaning: '高效的', word: 'efficient' },
    { meaning: '忙碌的', word: 'busy' },
    /* 扩充：消费 */
    { meaning: '昂贵的', word: 'expensive' },
    { meaning: '便宜的', word: 'cheap' },
    { meaning: '退款', word: 'refund' },
    { meaning: '砍价', word: 'bargain' },
    { meaning: '存款', word: 'savings' },
    { meaning: '折扣', word: 'discount' },
    { meaning: '促销', word: 'sale' },
    { meaning: '秒杀', word: 'flash sale' },
    { meaning: '拼团', word: 'group buying' },
    { meaning: '包邮', word: 'free shipping' },
    { meaning: '差评', word: 'bad review' }
  ];

  /* typing 串：仅保留 a-z，小写 */
  function toTyping(s) {
    return String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  /* 各模式最近抽过的词（避免短期重复） */
  const recentPicks = {};

  TB.Words = {
    WORKER_PACK: WORKER_PACK,
    CET6_PACK: CET6_PACK,

    /* 统一格式：[{ main, sub, typing }] */
    getPack(mode) {
      if (mode === 'worker') {
        return WORKER_PACK.map(function (x) {
          return { main: x.word, sub: x.pinyin, typing: toTyping(x.pinyin) };
        });
      }
      if (mode === 'cet') {
        return CET6_PACK.map(function (x) {
          return { main: x.meaning, sub: x.word, typing: toTyping(x.word) };
        });
      }
      if (mode === 'custom') {
        return TB.Storage.getCustom().map(function (x) {
          const py = (x.pinyin || '').trim();
          return { main: x.word, sub: py || x.word, typing: toTyping(py || x.word) };
        });
      }
      return [];
    },

    /* 随机抽词，避开最近 excludeRecent 条（默认 8） */
    pick(mode, excludeRecent) {
      const n = (excludeRecent === undefined) ? 8 : excludeRecent;
      const pack = TB.Words.getPack(mode);
      if (!pack.length) return null;
      const seen = recentPicks[mode] || (recentPicks[mode] = []);
      let pool = pack.filter(function (w) { return seen.indexOf(w) === -1; });
      if (!pool.length) pool = pack;
      const w = pool[Math.floor(Math.random() * pool.length)];
      seen.push(w);
      while (seen.length > n) seen.shift();
      return w;
    },

    /* 编辑器表单校验 */
    validateEntry(entry) {
      const word = String((entry && entry.word) || '').trim();
      const pinyin = String((entry && entry.pinyin) || '').trim();
      if (!word) return { ok: false, reason: '词不能为空' };
      if (word.length > 12) return { ok: false, reason: '词不能超过 12 个字' };
      if (pinyin && !/^[a-z ]+$/i.test(pinyin)) {
        return { ok: false, reason: '拼音只能包含字母和空格' };
      }
      if (/[^\x00-\x7F]/.test(word)) {
        if (!pinyin) return { ok: false, reason: '中文词必须填写拼音' };
        if (!toTyping(pinyin)) return { ok: false, reason: '拼音格式不正确' };
      }
      return { ok: true, reason: '' };
    }
  };

  /* ---------- localStorage 存取 ---------- */
  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const val = JSON.parse(raw);
      return (val === null || val === undefined) ? fallback : val;
    } catch (e) {
      return fallback;
    }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 存储不可用时静默降级 */ }
  }

  TB.Storage = {
    /* 各模式独立最高分 */
    getBest(mode) {
      const all = lsGet('TB_BEST', {});
      return (all && typeof all === 'object' && all[mode]) || 0;
    },
    setBest(mode, score) {
      const all = lsGet('TB_BEST', {});
      if (!all || typeof all !== 'object') return false;
      const prev = all[mode] || 0;
      if (score > prev) {
        all[mode] = score;
        lsSet('TB_BEST', all);
        return true;
      }
      return false;
    },

    /* 同屏最大词数（1~8，默认 5） */
    getMaxWords() {
      const n = parseInt(lsGet('TB_MAX_WORDS', 5), 10);
      return isNaN(n) ? 5 : Math.min(8, Math.max(1, n));
    },
    setMaxWords(nv) {
      const v = Math.min(8, Math.max(1, parseInt(nv, 10) || 5));
      lsSet('TB_MAX_WORDS', v);
      return v;
    },

    /* 自定义词库 */
    getCustom() {
      const list = lsGet('TB_CUSTOM_WORDS', []);
      return Array.isArray(list) ? list : [];
    },
    addCustom(entry) {
      const list = TB.Storage.getCustom();
      list.push(entry);
      lsSet('TB_CUSTOM_WORDS', list);
    },
    removeCustom(word) {
      lsSet('TB_CUSTOM_WORDS', TB.Storage.getCustom().filter(function (x) { return x.word !== word; }));
    },
    exportCustom() {
      return JSON.stringify(TB.Storage.getCustom());
    },
    /* 导入：非法 JSON / 无有效词条返回 false 且不破坏现有数据 */
    importCustom(json) {
      let parsed;
      try { parsed = JSON.parse(json); } catch (e) { return false; }
      if (!Array.isArray(parsed)) return false;
      const valid = [];
      const seen = {};
      for (let i = 0; i < parsed.length; i++) {
        const x = parsed[i];
        if (!x || typeof x.word !== 'string') continue;
        const entry = { word: x.word.trim(), pinyin: String(x.pinyin || '').trim() };
        if (!TB.Words.validateEntry(entry).ok) continue;
        if (seen[entry.word]) continue;
        seen[entry.word] = true;
        valid.push(entry);
      }
      if (!valid.length) return false;
      lsSet('TB_CUSTOM_WORDS', valid);
      return true;
    }
  };
})();

# 打字爆破 · 阶段 2/5：词库与数据层

> 使用方法：把本文件全文复制给 AI。开工前先阅读仓库现有文件 index.html 与 js/game.js（了解 TB 命名空间与 Screens），确认阶段 1 已完成验收。

## 项目背景

「打字爆破」是一个浏览器打字解压小游戏：让人血压升高的词从屏幕顶部落下，敲对拼音/英文整词爆炸。共三种模式：打工人（打拼音）、四六级（看中文释义打英文）、自定义（玩家自己录词）。阶段 1 已完成界面骨架。你只做**阶段 2：词库与数据层**，本阶段没有任何界面变化。

## 技术红线

1. 纯 vanilla JS，禁止任何依赖与网络请求
2. 只新建/实现 `js/words.js`，不改动其他文件的现有行为
3. 所有文件 UTF-8 编码
4. 不做任何 UI（编辑器是阶段 5 的事）

## 本阶段任务：实现 `js/words.js`

### 1. 内置词库（写死在文件里）

**WORKER_PACK**（打工人模式）：≥ 70 条，每条 `{ word, pinyin }`

- `pinyin`：小写、无声调、音节间一个空格。例：对齐颗粒度 → `"dui qi ke li du"`
- **必须包含**：「下班」和「放假」（阶段 5 的彩蛋词依赖它们）
- 建议方向（自行扩充到 70+，保持职场黑话/吐槽味）：对齐颗粒度、赋能、闭环、抓手、颗粒度、打法、沉淀、复盘、拉通、落地、组合拳、底层逻辑、顶层设计、心智、链路、向上管理、周报、早八、内卷、躺平、画饼、背锅、需求评审、拉齐、对焦、输出口径……
- 硬约束：每条去空格后的 typing 串**仅含 a–z**；词库内 typing 串不得重复；**不得收录 996、007 等含数字的词**（键盘只响应字母）

**CET6_PACK**（四六级模式）：≥ 80 条，每条 `{ meaning, word }`

- `word` 为英文单词或短语，例：使沮丧的 → `"depressed"`
- 建议方向：deadline、overtime、priority、compromise、inevitable、exhausted、procrastinate、assignment……优先选学业/职场/情绪相关的词
- 硬约束：typing 串（word 去空格小写）仅含 a–z、包内不重复

### 2. API（全部挂在 `window.TB.Words` 与 `window.TB.Storage` 下）

`TB.Words`：

- `getPack(mode)`：mode 为 `'worker' | 'cet' | 'custom'`，返回统一格式数组 `[{ main, sub, typing }]`
  - worker → main=中文词，sub=带空格拼音，typing=拼音去空格
  - cet → main=中文释义，sub=英文单词，typing=英文去空格小写
  - custom → 从 localStorage 读玩家词库，映射成同格式（pinyin 为空时 typing 取 word 本身）
- `pick(mode, excludeRecent = 8)`：随机抽一条，避开最近抽过的 8 条（内部记录游标即可，不污染词库）

`TB.Storage`：

- `getBest(mode)` / `setBest(mode, score)`：各模式独立的最高分
- 自定义词库：`getCustom()` → `[{ word, pinyin }]`；`addCustom({ word, pinyin })`；`removeCustom(word)`
- `exportCustom()` → JSON 字符串；`importCustom(json)` → 成功返回 true 并覆盖，失败返回 false 不破坏原数据
- 所有 localStorage 键加前缀 `TB_`（如 `TB_BEST`、`TB_CUSTOM_WORDS`）；JSON.parse 失败时返回安全默认值（空数组/0），不抛异常

### 3. 校验工具（给阶段 5 的编辑器用）

`TB.Words.validateEntry({ word, pinyin })` → `{ ok: boolean, reason: string }`：

- word 必填、长度 ≤ 12
- word 含非 ASCII 字符（中文）时：pinyin 必填，且匹配 `/^[a-z ]+$/`
- word 为纯英文/字母时：pinyin 可留空

## 验收清单（完成后逐项自测）

- [ ] console 执行 `TB.Words.getPack('worker').length >= 70` 为真，且包含 word 为「下班」「放假」的条目
- [ ] 两个包的每条 typing 串都匹配 `/^[a-z]+$/`，且各自包内无重复
- [ ] `TB.Words.pick('worker')` 连续抽 20 次不出现紧邻重复
- [ ] `addCustom` → `getCustom` → `removeCustom` 往返正确；刷新页面后数据仍在
- [ ] `setBest('worker', 100)` 不影响 `getBest('cet')`，模式间隔离
- [ ] `importCustom` 传入非法 JSON 返回 false 且原数据未损坏
- [ ] Console 零报错；index.html 打开后阶段 1 的功能全部照常

## 边界（禁止）

- 不做任何 UI 与游戏逻辑
- 不改 game.js / index.html / style.css 的行为

完成后：逐项确认验收清单，并列出两个词库的实际条数与 5 条示例。

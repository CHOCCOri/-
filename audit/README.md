# audit/ · 聊天记录顺序 与 全局字号 的回归测试

用 jsdom 从 `index.html` 里**抽取真实函数源码**跑「进房间 → 写盘」的循环，
所以测的是线上那份代码，不是复制品。

## 跑法

```bash
cd audit
npm init -y && npm install jsdom
node scenario1.js   # 老消息（无时间戳）不再漂到最新一端，反复进出稳定
node scenario2.js   # 已被 z75 写坏：同一段老消息复制成 3 份（全带时间戳）→ 折回 1 份
node scenario3.js   # 真身已修复、副本还堆在最新端的形态；并检查「好/嗯」真实重复不误伤
node scenario4.js   # 特殊卡片：没有副本时间的老卡不再顶在最新消息点
node scenario5.js   # 老红包卡：只有「09:41」这种无日期文案时绝不猜成「今天」
node scenario6.js   # 全局字号：重复应用幂等、新节点即时生效、调回 100% 能撤掉内联字号
node scenario7.js   # 写盘会把全局字号留下的内联字号/标记从聊天记录里剥掉
```

`dbg*.js` 是排查过程中的单点复现脚本，可单独运行。

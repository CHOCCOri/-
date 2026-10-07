/* 场景③：z76 已经修过一遍的房间 —— 真身（无时间戳的老行）已经被前移，
   但当时写坏时留下的「带时间戳的副本」还堆在最新消息那一端。
   看看现在的修复能不能把副本收掉（用户症状①的残留形态）。 */
const { api, storage, document, ctx } = require('./harness');
const H = 'h1';
api.setHandle(H);
api.setSettings(H, { deletedSpecialMessageIds: [], deletedChatLineKeys: [], redEnvelopes: [], transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: [] });

function line(dir, text, at, extra = '') {
  const stamp = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line ${dir}" data-message-kind="text"${stamp}${extra}>`
    + `<div class="chat-message-avatar ${dir === 'incoming' ? 'partner-avatar' : 'self-avatar'}"></div>`
    + `<div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;
}
const T0 = Date.UTC(2026, 9, 1, 10, 0, 0);
const texts = ['今天下雨了', '那你带伞了吗', '带了', '晚饭吃什么', '随便', '那别吃了', '生气啦？', '没有', '真的？', '真的', '好吧', '那就吃面'];
const modern = Array.from({ length: 5 }, (_, i) => line(i % 2 ? 'incoming' : 'outgoing', `新消息 ${i + 1}`, T0 + i * 60000));
// 真身：已经被前一次修复前移并盖了 floor 章
const real = texts.map((t, i) => line(i % 2 ? 'incoming' : 'outgoing', t, T0 - 100000 + i * 1000));
// 副本：那次进房时被补上「当时时间」的复制品，仍堆在最新一端
const copy = texts.map((t, i) => line(i % 2 ? 'incoming' : 'outgoing', t, T0 + 900000 + i));
const damaged = [...real, ...modern, ...copy];
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({ storageVersion: 4, updatedAt: Date.now(), lines: damaged }));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));

const names = (arr) => JSON.stringify(arr.map((h) => (h.match(/class="chat-bubble">([^<]*)</) || [])[1]));
console.log('损坏数据', damaged.length, '行（真实只有 17 条）。');
const t0 = Date.now();
const changed = api.repairStoredChatHistoryLayout(H);
const snap = api.getChatHistorySnapshot(H).lines;
console.log(`repair -> changed=${changed}，耗时 ${Date.now() - t0}ms，修复后 ${snap.length} 行`);
console.log(names(snap));
const changed2 = api.repairStoredChatHistoryLayout(H);
console.log('第二遍 changed =', changed2, '（必须 0）');

/* 误伤检查：用户「先后发两条一样的『好』」必须保留 */
storage.set('dream-messenger:chat-history:room:h2', JSON.stringify({ storageVersion: 4, updatedAt: Date.now(), lines: [
  line('outgoing', '好', T0), line('incoming', '嗯', T0 + 60000), line('outgoing', '好', T0 + 120000), line('incoming', '嗯', T0 + 180000), line('outgoing', '好', T0 + 240000)
] }));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1', 'h2']));
api.setHandle('h2');
api.repairStoredChatHistoryLayout('h2');
const snap2 = api.getChatHistorySnapshot('h2').lines;
console.log('重复的「好」房间 ->', snap2.length, '行', names(snap2), '（必须 5 行）');

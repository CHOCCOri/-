/* 场景⑤：特殊卡片的三种形态
   A) 老红包卡（副本只有「09:41」这种没有日期的显示时间，记录里没有 createdAt）
      —— 绝不能被猜成「今天 09:41」而跳到最新一端；
   B) 已经被写坏的红包卡（时间戳是当时写盘的「现在」）+ 记录里有真正的 createdAt
      —— 必须被改回真时间、回到原位；
   C) 完全没有记录的卡片 —— 位置要稳定（挪到老记录段、盖章），写盘不许再发明时间戳。 */
const { api, storage, document, ctx } = require('./harness');
const H = 'h1';
api.setHandle(H);
api.setSettings(H, { deletedSpecialMessageIds: [], deletedChatLineKeys: [], redEnvelopes: [], transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: [] });

const T0 = Date.UTC(2026, 9, 1, 10, 0, 0);
const now = Date.UTC(2026, 9, 7, 12, 0, 0);
function textLine(dir, text, at) {
  const s = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line ${dir}" data-message-kind="text"${s}><div class="chat-message-avatar ${dir === 'incoming' ? 'partner-avatar' : 'self-avatar'}"></div><div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;
}
function redCard(id, at, extra = '') {
  const s = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line incoming" data-message-kind="red-envelope"${s}${extra}><div class="chat-message-avatar partner-avatar"></div>`
   + `<div class="chat-message-content"><div class="chat-bubble chat-red-envelope-bubble" data-red-id="${id}" data-red-direction="in" data-red-amount="8.88" data-red-note="愿你今天也被温柔接住">`
   + `<div class="chat-red-envelope-card-top"><span class="chat-red-envelope-seal">✦</span><div class="chat-red-envelope-copy"><strong>小小心意</strong><span class="chat-red-envelope-recipient">TO: 我</span></div></div>`
   + `<div class="chat-red-envelope-note">愿你今天也被温柔接住</div><div class="chat-red-envelope-footer"><span>09:41</span><strong>已收到</strong></div></div>`
   + `<div class="chat-message-meta">09:41</div></div></div>`;
}
const names = (arr) => JSON.stringify(arr.map((h) => (h.match(/class="chat-bubble[^"]*">/) ? (h.match(/data-red-id="([^"]*)"/) ? `红包[${(h.match(/data-created-at="(\d+)"/) || [])[1] || '无章'}]` : (h.match(/class="chat-bubble">([^<]*)</) || [])[1]) : '?')));
function put(key, lines) { storage.set(`dream-messenger:chat-history:room:${key}`, JSON.stringify({ storageVersion: 4, updatedAt: now, lines })); storage.set('dream-messenger:chat-history:rooms', JSON.stringify([key])); }
const read = (key) => JSON.parse(storage.get(`dream-messenger:chat-history:room:${key}`)).lines;

/* A) 无日期显示时间的老红包卡（记录里没有 createdAt） */
console.log('=== A) 老红包卡：记录只有「09:41」 ===');
api.setSettings(H, { deletedSpecialMessageIds: [], deletedChatLineKeys: [], redEnvelopes: [{ id: 'red-old', direction: 'in', amount: '8.88', note: '', time: '09:41' }], transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: [] });
put(H, [textLine('outgoing', '早', T0), textLine('incoming', '早呀', T0 + 60000), redCard('red-old', 0), textLine('outgoing', '晚上见', T0 + 120000), textLine('incoming', '好', T0 + 180000)]);
let changed = api.repairStoredChatHistoryLayout(H);
let lines = read(H);
const redStamp = Number((lines.find(l => l.includes('red-old')).match(/data-created-at="(\d+)"/) || [])[1] || 0);
console.log('repair changed =', changed, '| 红包卡时间戳 =', redStamp, '（今天 09:41 是', new Date().setHours(9, 41, 0, 0), '；绝不能等于它）');
console.log('顺序 =', names(lines));
console.log('第二遍 changed =', api.repairStoredChatHistoryLayout(H), '（必须 0）');

/* B) 被写坏的红包卡（时间戳=写盘时间）+ 记录里有真 createdAt */
console.log('=== B) 写坏的红包卡：记录里有真时间 ===');
api.setSettings(H, { deletedSpecialMessageIds: [], deletedChatLineKeys: [], redEnvelopes: [{ id: 'red-ok', direction: 'in', amount: '8.88', note: '', createdAt: T0 + 30000, time: '10:00' }], transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: [] });
put(H, [textLine('outgoing', '早', T0), redCard('red-ok', now - 3600e3), textLine('incoming', '晚上见', T0 + 120000)]);
changed = api.repairStoredChatHistoryLayout(H);
lines = read(H);
console.log('repair changed =', changed, '| 红包卡时间戳 =', (lines.find(l => l.includes('red-ok')).match(/data-created-at="(\d+)"/) || [])[1], '（应为', T0 + 30000, '）');
console.log('顺序 =', names(lines));

/* C) 完全没有记录的卡片：写盘不许再发明时间戳 */
console.log('=== C) 无记录卡片：进房 + 写盘 ===');
api.setSettings(H, { deletedSpecialMessageIds: [], deletedChatLineKeys: [], redEnvelopes: [], transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: [] });
put(H, [textLine('outgoing', '早', T0), textLine('incoming', '早呀', T0 + 60000), redCard('red-ghost', 0), textLine('outgoing', '晚上见', T0 + 120000), textLine('incoming', '好', T0 + 180000)]);
api.repairStoredChatHistoryLayout(H);
lines = read(H);
const ghostBefore = (lines.find(l => l.includes('red-ghost')).match(/data-created-at="(\d+)"/) || [])[1] || '无';
const body = document.getElementById('chatThreadBody');
body.innerHTML = '<div id="chatTyping"></div>';
ctx.restoringChatHistory = false;
api.restoreChatHistory(H, {});
ctx.restoringChatHistory = false;
api.saveChatHistoryForHandle(H, { reason: 'test' });
lines = read(H);
const ghostAfter = (lines.find(l => l.includes('red-ghost')).match(/data-created-at="(\d+)"/) || [])[1] || '无';
console.log('写盘前红包卡时间戳 =', ghostBefore, '写盘后 =', ghostAfter, '（必须相等；且不能出现 "1"/"2" 这种下标时间戳）');
console.log('存储里有没有下标时间戳（data-created-at="1" 等）=', /data-created-at="[1-9]\d{0,2}"/.test(JSON.stringify(lines)));
console.log('顺序 =', names(lines));
console.log('再进一次 changed =', api.repairStoredChatHistoryLayout(H), '（必须 0）');

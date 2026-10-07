/* 场景②：已经被 z75 时代代码写坏的历史 —— 老消息被写上「当时的时间」并复制多份、
   停在最新消息那一端。看看现在（v111z76）的进房修复能不能把它们折回原位。 */
const { api, storage, document, ctx } = require('./harness');

const H = 'h1';
api.setHandle(H);
api.setSettings(H, { deletedSpecialMessageIds: [], deletedChatLineKeys: [], redEnvelopes: [], transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: [] });

function textLine(dir, text, at) {
  const stamp = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line ${dir}" data-message-kind="text"${stamp}>`
    + `<div class="chat-message-avatar ${dir === 'incoming' ? 'partner-avatar' : 'self-avatar'}"></div>`
    + `<div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;
}

const T0 = Date.UTC(2026, 9, 1, 10, 0, 0);
const now = Date.UTC(2026, 9, 7, 12, 0, 0);
const legacyTexts = ['今天下雨了', '那你带伞了吗', '带了', '晚饭吃什么', '随便', '那别吃了', '生气啦？', '没有', '真的？', '真的', '好吧', '那就吃面'];

/* z75 时代的损坏：每进一次房间，12 条老消息整体被补上「当时」的时间戳并复制一份 */
function block(at) { return legacyTexts.map((t, i) => textLine(i % 2 ? 'incoming' : 'outgoing', t, at + i)); }
const modern = Array.from({ length: 5 }, (_, i) => textLine(i % 2 ? 'incoming' : 'outgoing', `新消息 ${i + 1}`, T0 + i * 60000));

const damaged = [
  ...modern,
  ...block(now - 3 * 3600e3),
  ...block(now - 2 * 3600e3),
  ...block(now - 1 * 3600e3)
];
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({ storageVersion: 4, updatedAt: now, lines: damaged }));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));

const body = document.getElementById('chatThreadBody');
console.log('损坏的历史：共', damaged.length, '行（实际只有 17 条真实消息）');

const t0 = Date.now();
const changed = api.repairStoredChatHistoryLayout(H);
const snap = api.getChatHistorySnapshot(H).lines;
const names = snap.map((h) => (h.match(/class="chat-bubble">([^<]*)</) || [])[1]);
console.log(`repairStoredChatHistoryLayout 返回 changed=${changed}，耗时 ${Date.now() - t0}ms`);
console.log('修复后：共', snap.length, '行 ->', JSON.stringify(names));

/* 再进房间渲染 + 写盘，看用户实际会看到什么、会不会继续变 */
body.innerHTML = '<div id="chatTyping"></div>';
api.restoreChatHistory(H, {});
ctx.restoringChatHistory = false;
api.saveChatHistoryForHandle(H, { reason: 'test' });
const snap2 = api.getChatHistorySnapshot(H).lines;
console.log('进出一次后：共', snap2.length, '行 ->', JSON.stringify(snap2.map((h) => (h.match(/class="chat-bubble">([^<]*)</) || [])[1])));

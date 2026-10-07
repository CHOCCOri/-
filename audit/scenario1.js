/* 场景①：老消息（没有 data-created-at）在「进房间 → 写盘」循环里的位置变化。
   这也顺带检验 z76 的「按时间戳并集」是否真的把老行留在原地。 */
const { api, storage, document, ctx } = require('./harness');

const H = 'h1';
api.setHandle(H);
api.setSettings(H, {
  deletedSpecialMessageIds: [], deletedChatLineKeys: [],
  redEnvelopes: [], transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: []
});

/* 造一条普通文字消息行（结构与真实渲染一致：avatar + content(bubble + meta)） */
function textLine(dir, text, at) {
  const stamp = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line ${dir}" data-message-kind="text"${stamp}>`
    + `<div class="chat-message-avatar ${dir === 'incoming' ? 'partner-avatar' : 'self-avatar'}"></div>`
    + `<div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;
}

const T0 = Date.UTC(2026, 9, 1, 10, 0, 0);   /* 10 月 1 日 */
/* 老消息（时间戳功能上线前的历史）：12 条，没有 data-created-at，被塞在数组最末尾（= 用户报的现状） */
const legacy = Array.from({ length: 12 }, (_, i) => textLine(i % 2 ? 'incoming' : 'outgoing', `老消息 ${i + 1}`, 0));
/* 真实带时间戳的对话：5 条 */
const modern = Array.from({ length: 5 }, (_, i) => textLine(i % 2 ? 'incoming' : 'outgoing', `新消息 ${i + 1}`, T0 + i * 60000));

const damaged = [...modern, ...legacy];   /* 复现用户看到的：老消息贴在最新一条消息那一端 */
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({ storageVersion: 4, updatedAt: T0, lines: damaged }));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));

const body = document.getElementById('chatThreadBody');
const before = api.getChatHistorySnapshot(H).lines.map((h) => (/data-created-at="(\d+)"/.exec(h) || [])[1] || '无');
console.log('写入前的顺序（时间戳）：', before.join(' , '));

/* 进房间：restoreChatHistory 渲染尾部 100 行 */
body.innerHTML = '<div id="chatTyping"></div>';
api.restoreChatHistory(H, {});
const rendered = [...body.querySelectorAll(':scope > .chat-message-line')];
console.log('渲染后 DOM 行数：', rendered.length, ' 首行：', rendered[0]?.querySelector('.chat-bubble')?.textContent);
console.log('渲染后 DOM 时间戳：', rendered.map((l) => l.dataset.createdAt || '无').join(' , '));

/* 写盘（真实路径：saveChatHistoryForHandle） */
ctx.restoringChatHistory = false;
api.saveChatHistoryForHandle(H, { reason: 'test' });
const after = api.getChatHistorySnapshot(H).lines.map((h) => (/data-created-at="(\d+)"/.exec(h) || [])[1] || '无');
console.log('写盘后的顺序（时间戳）：', after.join(' , '));

/* 再进一次房间，看有没有继续漂/复制 */
for (let round = 1; round <= 2; round++) {
  body.innerHTML = '<div id="chatTyping"></div>';
  api.restoreChatHistory(H, {});
  ctx.restoringChatHistory = false;
  api.saveChatHistoryForHandle(H, { reason: 'test' });
  const snap = api.getChatHistorySnapshot(H).lines;
  const names = snap.map((h) => (h.match(/class="chat-bubble">([^<]*)</) || [])[1]);
  console.log(`第 ${round + 1} 次进出后：共 ${snap.length} 行`, JSON.stringify(names));
}

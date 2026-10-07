const { api, storage, document, ctx } = require('./harness');
const H = 'h1'; api.setHandle(H);
function textLine(dir, text, at) {
  const stamp = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line ${dir}" data-message-kind="text"${stamp}><div class="chat-message-avatar"></div><div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;
}
function redCard(at, id) {
  const stamp = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line incoming"${stamp}><div class="chat-message-avatar partner-avatar"></div><div class="chat-message-content"><div class="chat-bubble chat-red-envelope-bubble" data-red-id="${id}"></div><div class="chat-message-meta">刚刚</div></div></div>`;
}
const T0 = Date.UTC(2026, 9, 1, 10, 0, 0);
api.setSettings(H, { deletedSpecialMessageIds: [], deletedChatLineKeys: [], redEnvelopes: [{ id: 'red-legacy', time: '刚刚' }], transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: [] });
const lines = [textLine('incoming','早',T0), redCard(0,'red-legacy'), textLine('outgoing','晚上见',T0+60000), textLine('incoming','好',T0+120000)];
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({ storageVersion: 4, updatedAt: T0, lines }));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));
const short = (h) => (h.includes('red-id') ? '红包卡' : (h.match(/class="chat-bubble">([^<]*)</) || [])[1]);
console.log('初始 ', JSON.stringify(api.getChatHistorySnapshot(H).lines.map(short)));
console.log('repair ->', api.repairStoredChatHistoryLayout(H));
console.log('修复后', JSON.stringify(api.getChatHistorySnapshot(H).lines.map(short)));
const body = document.getElementById('chatThreadBody');
api.restoreChatHistory(H, {});
console.log('渲染后 DOM', JSON.stringify([...body.querySelectorAll('.chat-message-line')].map((l)=>l.querySelector('.chat-bubble')?.textContent || '卡')));
console.log('渲染后快照', JSON.stringify(api.getChatHistorySnapshot(H).lines.map(short)));
ctx.restoringChatHistory = false;
api.saveChatHistoryForHandle(H, { reason: 'test' });
console.log('写盘后', JSON.stringify(api.getChatHistorySnapshot(H).lines.map(short)));

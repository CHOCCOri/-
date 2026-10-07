/* 场景⑧：端到端 —— 一个「什么毛病都有」的房间，连续进出 4 次，
   期望：真实消息条数稳定、老消息不会被复制、老卡片不会漂到最新一端、第二遍修复不再改东西。 */
const { api, storage, document, ctx } = require('./harness');
const H = 'h1';
api.setHandle(H);
const T0 = Date.UTC(2026, 9, 1, 10, 0, 0);
const now = Date.UTC(2026, 9, 7, 12, 0, 0);
function textLine(dir, text, at) {
  const s = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line ${dir}" data-message-kind="text"${s}><div class="chat-message-avatar ${dir === 'incoming' ? 'partner-avatar' : 'self-avatar'}"></div><div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;
}
function redCard(id, at) {
  const s = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line incoming" data-message-kind="red-envelope"${s}><div class="chat-message-avatar partner-avatar"></div><div class="chat-message-content"><div class="chat-bubble chat-red-envelope-bubble" data-red-id="${id}" data-red-direction="in" data-red-amount="8.88" data-red-note="心意"><div class="chat-red-envelope-footer"><span>09:41</span><strong>已收到</strong></div></div><div class="chat-message-meta">09:41</div></div></div>`;
}
api.setSettings(H, { deletedSpecialMessageIds: [], deletedChatLineKeys: [], redEnvelopes: [{ id: 'red-real', direction: 'in', amount: '8.88', createdAt: T0 + 90000, time: '10:01' }], transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: [] });
const real = [textLine('outgoing', '早', T0), textLine('incoming', '早呀', T0 + 60000), redCard('red-real', now - 7200e3), textLine('outgoing', '中午吃什么', T0 + 150000), textLine('incoming', '都行', T0 + 210000)];
const legacy = ['很久以前的甲', '很久以前的乙', '很久以前的丙'].map((t, i) => textLine(i % 2 ? 'incoming' : 'outgoing', t, 0));
const legacyCard = redCard('red-ancient', 0);
const brokenCopies = ['很久以前的甲', '很久以前的乙', '很久以前的丙'].map((t, i) => textLine(i % 2 ? 'incoming' : 'outgoing', t, now - 3600e3 + i));
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({ storageVersion: 4, updatedAt: now, lines: [...real, ...brokenCopies, legacyCard, ...legacy] }));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));
const body = document.getElementById('chatThreadBody');
const names = (arr) => JSON.stringify(arr.map((h) => (h.match(/data-red-id="([^"]*)"/) ? `红包:${(h.match(/data-red-id="([^"]*)"/) || [])[1]}` : (h.match(/class="chat-bubble">([^<]*)</) || [])[1])));
for (let round = 1; round <= 4; round += 1) {
  const changed = api.repairStoredChatHistoryLayout(H);
  body.innerHTML = '<div id="chatTyping"></div>';
  ctx.restoringChatHistory = false;
  api.restoreChatHistory(H, {});
  ctx.restoringChatHistory = false;
  api.saveChatHistoryForHandle(H, { reason: 'test' });
  const snap = api.getChatHistorySnapshot(H).lines;
  const counts = {};
  snap.forEach(h => { const t = (h.match(/data-red-id="([^"]*)"/) || [])[1] || (h.match(/class="chat-bubble">([^<]*)</) || [])[1]; counts[t] = (counts[t] || 0) + 1; });
  const maxCount = Math.max(...Object.values(counts));
  console.log(`第 ${round} 次：行数=${snap.length} repair changed=${changed} 最大重复份数=${maxCount}`);
  if (round === 1) console.log('   ', names(snap));
}
console.log('（期望：行数稳定在 10，最大重复份数 1，之后的 repair 都返回 0）');

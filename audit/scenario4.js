/* 场景④：卡片行（没有时间戳、记录里也没有时间）在「进房间 → 写盘」后会不会漂到最新一端。
   这对应「之前的特殊卡片反复出现在最新的消息点」。 */
const { api, storage, document, ctx } = require('./harness');

const H = 'h1';
api.setHandle(H);

function textLine(dir, text, at) {
  const stamp = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line ${dir}" data-message-kind="text"${stamp}>`
    + `<div class="chat-message-avatar ${dir === 'incoming' ? 'partner-avatar' : 'self-avatar'}"></div>`
    + `<div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;
}
function redCard(at, id) {
  const stamp = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line incoming"${stamp}>`
    + `<div class="chat-message-avatar partner-avatar"></div>`
    + `<div class="chat-message-content"><div class="chat-bubble chat-red-envelope-bubble" data-red-id="${id}"><div class="chat-red-envelope-note">愿你今天也被温柔接住</div></div><div class="chat-message-meta">刚刚</div></div></div>`;
}
function groupCard(at) {
  const stamp = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line incoming"${stamp}>`
    + `<div class="chat-message-avatar partner-avatar"></div>`
    + `<div class="chat-message-content"><div class="chat-bubble group-v2-special-bubble">群决策卡</div><div class="chat-message-meta">刚刚</div></div></div>`;
}
function komoCard(at) {
  const stamp = at ? ` data-created-at="${at}"` : '';
  return `<div class="chat-message-line incoming" data-komo-flow-id="order-123"${stamp}>`
    + `<div class="chat-message-avatar partner-avatar"></div>`
    + `<div class="chat-message-content"><div class="chat-komo-flow-bubble">ORDER · 已送达</div><div class="chat-message-meta">刚刚</div></div></div>`;
}

const T0 = Date.UTC(2026, 9, 1, 10, 0, 0);
api.setSettings(H, {
  deletedSpecialMessageIds: [], deletedChatLineKeys: [],
  /* 红包记录存在，但只有「刚刚」这种没有钟点的显示时间 —— chatSpecialCardTimeInfo 会跳过它 */
  redEnvelopes: [{ id: 'red-legacy', time: '刚刚' }],
  transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: []
});

const lines = [
  textLine('incoming', '早', T0),
  redCard(0, 'red-legacy'),                                  /* 老红包卡：没有时间戳、记录里也没时间 */
  groupCard(0),                                              /* 群卡片：同样没有时间戳 */
  komoCard(0),                                               /* KOMO 卡片：本来就设计成不带时间戳 */
  textLine('outgoing', '晚上见', T0 + 60000),
  textLine('incoming', '好', T0 + 120000)
];
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({ storageVersion: 4, updatedAt: T0 + 120000, lines }));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));

const body = document.getElementById('chatThreadBody');
const nameOf = (h) => (h.match(/>([^<>]*)\)?<\/(?:div|strong)>/) || [])[1];
const short = (h) => (h.includes('red-id') ? '红包卡' : h.includes('group-v2-special-bubble') ? '群卡' : h.includes('komo-flow') ? 'KOMO卡' : (h.match(/class="chat-bubble">([^<]*)</) || [])[1]);

console.log('写盘前：', JSON.stringify(api.getChatHistorySnapshot(H).lines.map(short)));
body.innerHTML = '<div id="chatTyping"></div>';
api.restoreChatHistory(H, {});
ctx.restoringChatHistory = false;
api.saveChatHistoryForHandle(H, { reason: 'test' });
console.log('写盘后：', JSON.stringify(api.getChatHistorySnapshot(H).lines.map(short)));

/* 再进一次房间，看看有没有继续漂 */
body.innerHTML = '<div id="chatTyping"></div>';
api.restoreChatHistory(H, {});
ctx.restoringChatHistory = false;
api.saveChatHistoryForHandle(H, { reason: 'test' });
console.log('再进一次：', JSON.stringify(api.getChatHistorySnapshot(H).lines.map(short)));

/* 顺带验证 insertChatLineByTime：比窗口里所有行都老的卡片会插到哪儿 */
body.innerHTML = '<div id="chatTyping"></div>';
body.insertAdjacentHTML('beforeend', textLine('incoming', '窗口里的第一行', T0 + 600000) + textLine('outgoing', '窗口里的第二行', T0 + 660000));
const oldCard = document.createElement('div');
oldCard.className = 'chat-message-line incoming';
oldCard.dataset.createdAt = String(T0 - 999999);
oldCard.innerHTML = '<div class="chat-message-content"><div class="chat-bubble">很老的一张卡</div></div>';
api.insertChatLineByTime(oldCard, T0 - 999999);
console.log('老卡片插入后 DOM 顺序：', JSON.stringify([...body.querySelectorAll('.chat-message-line')].map((l) => l.querySelector('.chat-bubble')?.textContent)));

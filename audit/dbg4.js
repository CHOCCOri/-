const H_ = require('./harness');
const { api, storage, document, ctx } = H_;
const H='h1'; api.setHandle(H);
function textLine(dir,text,at){const st=at?` data-created-at="${at}"`:'';return `<div class="chat-message-line ${dir}"${st}><div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;}
function redCard(at,id){const st=at?` data-created-at="${at}"`:'';return `<div class="chat-message-line incoming"${st}><div class="chat-message-content"><div class="chat-bubble chat-red-envelope-bubble" data-red-id="${id}">红包</div><div class="chat-message-meta">刚刚</div></div></div>`;}
const T0=Date.UTC(2026,9,1,10,0,0);
api.setSettings(H,{deletedSpecialMessageIds:[],deletedChatLineKeys:[],redEnvelopes:[{id:'red-legacy',time:'刚刚'}],transferRecords:[],checkHistory:[],decisionRecords:[],inviteHistory:[]});
const stored=[textLine('incoming','早',T0), redCard(0,'red-legacy'), textLine('outgoing','晚上见',T0+60000), textLine('incoming','好',T0+120000)];
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({storageVersion:4,updatedAt:T0,lines:stored}));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));
const body=document.getElementById('chatThreadBody');
api.restoreChatHistory(H,{});
ctx.restoringChatHistory=false;
api.saveChatHistoryForHandle(H,{reason:'t'});
const label=(h)=>(h.includes('red-id')?'红包':(h.match(/class="chat-bubble">([^<]*)</)||[])[1]||'?');
const state = api.loadChatHistoryState();
console.log('内存 state:', JSON.stringify((state.h1?.lines||[]).map(label)));
console.log('磁盘 shard:', JSON.stringify((JSON.parse(storage.get('dream-messenger:chat-history:room:h1')).lines||[]).map(label)));
console.log('快照:', JSON.stringify((api.getChatHistorySnapshot(H).lines||[]).map(label)));
console.log('红包行有没有 data-created-at:', /data-created-at/.test(storage.get('dream-messenger:chat-history:room:h1')));

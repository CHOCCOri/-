const H_ = require('./harness');
const { api, storage, document, ctx } = H_;
const H='h1'; api.setHandle(H);
function textLine(dir,text,at){const st=at?` data-created-at="${at}"`:'';return `<div class="chat-message-line ${dir}"${st}><div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;}
function redCard(at,id){const st=at?` data-created-at="${at}"`:'';return `<div class="chat-message-line incoming"${st}><div class="chat-message-content"><div class="chat-bubble chat-red-envelope-bubble" data-red-id="${id}"></div><div class="chat-message-meta">刚刚</div></div></div>`;}
const T0=Date.UTC(2026,9,1,10,0,0);
api.setSettings(H,{deletedSpecialMessageIds:[],deletedChatLineKeys:[],redEnvelopes:[{id:'red-legacy',time:'刚刚'}],transferRecords:[],checkHistory:[],decisionRecords:[],inviteHistory:[]});
const stored=[textLine('incoming','早',T0), redCard(0,'red-legacy'), textLine('outgoing','晚上见',T0+60000), textLine('incoming','好',T0+120000)];
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({storageVersion:4,updatedAt:T0,lines:stored}));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));
const body=document.getElementById('chatThreadBody');
const short=(h)=>(h.includes('red-id')?'红包卡':(h.match(/class="chat-bubble">([^<]*)</)||[])[1]);
/* 包一层 persistChatHistoryState / normalize，看每一步之后的顺序 */
const origPersist = ctx.persistChatHistoryState;
ctx.persistChatHistoryState = function(key){ try{ const s=H_.api.getChatHistorySnapshot(key); console.log('  [persist]', key, JSON.stringify((s&&s.lines||[]).map(short))); }catch(e){ console.log('  [persist-err]', e.message); } return origPersist.apply(this, arguments); };
const origNormalize = ctx.normalizeStoredChatSpecialLines;
if (origNormalize) ctx.normalizeStoredChatSpecialLines = function(handle, lines){ const out = origNormalize.apply(this, arguments); if (JSON.stringify(out)!==JSON.stringify(lines)) console.log('  [normalize 改了顺序]', JSON.stringify(lines.map(short)), '->', JSON.stringify(out.map(short))); return out; };
api.restoreChatHistory(H,{});
console.log('渲染后快照:', JSON.stringify(api.getChatHistorySnapshot(H).lines.map(short)));
ctx.restoringChatHistory=false;
api.saveChatHistoryForHandle(H,{reason:'t'});
console.log('写盘后:', JSON.stringify(api.getChatHistorySnapshot(H).lines.map(short)));

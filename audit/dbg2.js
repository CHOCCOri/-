const { api, storage, document, ctx } = require('./harness');
const H='h1'; api.setHandle(H);
function textLine(dir,text,at){const st=at?` data-created-at="${at}"`:'';return `<div class="chat-message-line ${dir}"${st}><div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;}
function redCard(at,id){const st=at?` data-created-at="${at}"`:'';return `<div class="chat-message-line incoming"${st}><div class="chat-message-content"><div class="chat-bubble chat-red-envelope-bubble" data-red-id="${id}"></div><div class="chat-message-meta">刚刚</div></div></div>`;}
const T0=Date.UTC(2026,9,1,10,0,0);
api.setSettings(H,{deletedSpecialMessageIds:[],deletedChatLineKeys:[],redEnvelopes:[{id:'red-legacy',time:'刚刚'}],transferRecords:[],checkHistory:[],decisionRecords:[],inviteHistory:[]});
const stored=[textLine('incoming','早',T0), redCard(0,'red-legacy'), textLine('outgoing','晚上见',T0+60000), textLine('incoming','好',T0+120000)];
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({storageVersion:4,updatedAt:T0,lines:stored}));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));
const body=document.getElementById('chatThreadBody');
api.restoreChatHistory(H,{});
ctx.restoringChatHistory=false;
/* 手动重现 save 的两步：先 stamp（写盘路径），再合并 */
const domLines=[...body.querySelectorAll(':scope > .chat-message-line')];
console.log('DOM 里的红包卡 createdAt（stamp 前）:', domLines[1]?.dataset.createdAt || '无');
domLines.forEach((l)=>api.stampChatMessageLine(l));
console.log('DOM 里的红包卡 createdAt（stamp 后）:', domLines[1]?.dataset.createdAt);
const serialized = domLines.map((l)=>l.outerHTML);
const merged = api.mergeChatHistoryLineLists(stored, serialized, new Set());
const short=(h)=>(h.includes('red-id')?'红包卡':(h.match(/class="chat-bubble">([^<]*)</)||[])[1]);
console.log('合并结果:', JSON.stringify(merged.map(short)));
console.log('红包卡弱身份:', api.chatLineWeakKey(merged.find(h=>h.includes('red-id'))||''), '强身份:', JSON.stringify(api.chatLineIdentityKeys(merged.find(h=>h.includes('red-id'))||'')));
console.log('红包卡是否 plain:', api.chatLineIsPlainBubble(new DOMParser().parseFromString(merged.find(h=>h.includes('red-id'))||'<div></div>','text/html').body.firstElementChild));

/* 写盘路径的 forEach 下标当时间戳：卡片行（修复管不到的）会拿到 data-created-at="1" */
const H_ = require('./harness');
const { api, storage, document, ctx } = H_;
const H='h1'; api.setHandle(H);
function textLine(dir,text,at){const st=at?` data-created-at="${at}"`:'';return `<div class="chat-message-line ${dir}"${st}><div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;}
function redCard(at,id){const st=at?` data-created-at="${at}"`:'';return `<div class="chat-message-line incoming"${st}><div class="chat-message-content"><div class="chat-bubble chat-red-envelope-bubble" data-red-id="${id}">红包</div><div class="chat-message-meta">刚刚</div></div></div>`;}
const T0=Date.UTC(2026,9,1,10,0,0);
api.setSettings(H,{deletedSpecialMessageIds:[],deletedChatLineKeys:[],redEnvelopes:[{id:'red-legacy',time:'刚刚'}],transferRecords:[],checkHistory:[],decisionRecords:[],inviteHistory:[]});
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({storageVersion:4,updatedAt:T0,lines:[textLine('incoming','早',T0), redCard(0,'red-legacy'), textLine('outgoing','晚上见',T0+60000), textLine('incoming','好',T0+120000)]}));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));
const body=document.getElementById('chatThreadBody');
api.restoreChatHistory(H,{});
ctx.restoringChatHistory=false;
api.saveChatHistoryForHandle(H,{reason:'t'});
console.log('写盘后（按存储顺序）：');
api.getChatHistorySnapshot(H).lines.forEach((h,i)=>{
  const at=(h.match(/data-created-at="(\d+)"/)||[])[1]||'无';
  const t=h.includes('red-id')?'红包卡':(h.match(/class="chat-bubble">([^<]*)</)||[])[1];
  console.log(`  ${i}. ${t}  data-created-at=${at}`);
});

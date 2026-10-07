/* 直查：写盘路径 lines.forEach(stampChatMessageLine) 把「数组下标」当成了时间戳 */
const H_ = require('./harness');
const { api, storage, document, ctx } = H_;
const H='h1'; api.setHandle(H);
function textLine(dir,text,at){const st=at?` data-created-at="${at}"`:'';return `<div class="chat-message-line ${dir}"${st}><div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;}
const T0=Date.UTC(2026,9,1,10,0,0);
api.setSettings(H,{deletedSpecialMessageIds:[],deletedChatLineKeys:[],redEnvelopes:[],transferRecords:[],checkHistory:[],decisionRecords:[],inviteHistory:[]});
/* 老消息 3 条没有时间戳，夹在带时间戳的消息里 */
storage.set('dream-messenger:chat-history:room:h1', JSON.stringify({storageVersion:4,updatedAt:T0,lines:[textLine('incoming','早',T0), textLine('outgoing','老消息A'), textLine('incoming','老消息B'), textLine('outgoing','晚上见',T0+60000)]}));
storage.set('dream-messenger:chat-history:rooms', JSON.stringify(['h1']));
const body=document.getElementById('chatThreadBody');
api.restoreChatHistory(H,{});
/* 逐行打印 DOM 里的 index 与写盘后拿到的 createdAt */
const domLines=[...body.querySelectorAll(':scope > .chat-message-line')];
domLines.forEach((l,i)=>console.log(`DOM[${i}] ${l.querySelector('.chat-bubble')?.textContent}  现有时间戳=${l.dataset.createdAt||'无'}`));
ctx.restoringChatHistory=false;
api.saveChatHistoryForHandle(H,{reason:'t'});
const rows=api.getChatHistorySnapshot(H).lines;
console.log('\n写盘后（按存储顺序）:');
rows.forEach((h,i)=>{const at=(h.match(/data-created-at="(\d+)"/)||[])[1]||'无';const t=(h.match(/class="chat-bubble">([^<]*)</)||[])[1];console.log(`  ${i}. ${t}  data-created-at=${at}`);});

const { api, storage, document } = require('./harness');
const H='h1';
api.setHandle(H);
api.setSettings(H,{deletedSpecialMessageIds:[],deletedChatLineKeys:[],redEnvelopes:[],transferRecords:[],checkHistory:[],decisionRecords:[],inviteHistory:[]});
function textLine(dir,text,at){const s=at?` data-created-at="${at}"`:'';return `<div class="chat-message-line ${dir}" data-message-kind="text"${s}><div class="chat-message-avatar ${dir==='incoming'?'partner-avatar':'self-avatar'}"></div><div class="chat-message-content"><div class="chat-bubble">${text}</div><div class="chat-message-meta">刚刚</div></div></div>`;}
const T0=Date.UTC(2026,9,1,10,0,0), now=Date.UTC(2026,9,7,12,0,0);
const L=['今天下雨了','那你带伞了吗','带了','晚饭吃什么','随便','那别吃了','生气啦？','没有','真的？','真的','好吧','那就吃面'];
function block(at){return L.map((t,i)=>textLine(i%2?'incoming':'outgoing',t,at+i));}
const modern=Array.from({length:5},(_,i)=>textLine(i%2?'incoming':'outgoing',`新消息 ${i+1}`,T0+i*60000));
const damaged=[...modern,...block(now-3*3600e3),...block(now-2*3600e3),...block(now-1*3600e3)];
storage.set('dream-messenger:chat-history:room:h1',JSON.stringify({storageVersion:4,updatedAt:now,lines:damaged}));
storage.set('dream-messenger:chat-history:rooms',JSON.stringify(['h1']));
const rows=damaged.map((html,index)=>{
  const wrap=document.createElement('div'); wrap.innerHTML=html; const line=wrap.firstElementChild;
  const identity=api.chatSpecialIdentityFromLine(line);
  return {index,identity,plain:!identity&&api.chatLineIsPlainBubble(line),key:identity?`id:${identity}`:api.chatPlainLineRepeatKey(line)};
});
console.log('plain count', rows.filter(r=>r.plain).length, 'identity count', rows.filter(r=>r.identity).length);
const runKeyAt=rows.map(r=>r.plain?r.key:'\u0000');
console.log('keys sample', runKeyAt.slice(5,8));
const drops=new Set(); const pairAt=new Map();
for(let i=0;i+1<rows.length;i+=1){ if(runKeyAt[i]==='\u0000'||runKeyAt[i+1]==='\u0000')continue; const p=`${runKeyAt[i]}\u0001${runKeyAt[i+1]}`; const l=pairAt.get(p); if(l)l.push(i);else pairAt.set(p,[i]); }
pairAt.forEach((list,p)=>{
  if(list.length<2)return;
  console.log('pair',JSON.stringify(p),'at',JSON.stringify(list));
  for(let a=0;a<list.length;a+=1){ if(drops.has(list[a]))continue;
    for(let b=a+1;b<list.length;b+=1){ if(drops.has(list[b])){console.log('   skip a=',list[a],'b=',list[b],'(already dropped)');continue;}
      let length=0;
      while(list[a]+length<list[b]&&list[b]+length<rows.length&&runKeyAt[list[a]+length]!=='\u0000'&&runKeyAt[list[a]+length]===runKeyAt[list[b]+length])length+=1;
      console.log('   try a=',list[a],'b=',list[b],'len=',length);
      if(length<2)continue;
      const first=list[b];
      for(let k=0;k<length;k+=1)drops.add(list[b]+k);
      console.log('  drop a=',list[a],'b=',first,'len=',length,'-> rows',first,'..',first+length-1);
      b+=length-1;
    }
  }
});
console.log('drops', drops.size, 'survivors', rows.length-drops.size);
console.log('dropped indices', [...drops].sort((a,b)=>a-b).join(','));

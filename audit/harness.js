/* 聊天记录顺序/卡片位置 与 字号缩放 的行为测试台（jsdom）。
   从 index.html 抽取真实函数源码，在受控环境里跑「进房间 → 写盘」的循环，
   观察是否出现「老消息漂到最新一端」「老卡片顶着最新消息」「同一条重复成多份」。 */
const { JSDOM } = require('jsdom');
const { extractFunction } = require('./extract');

const dom = new JSDOM('<!doctype html><html><body><div id="appScreen"><div id="chatApp"><div id="chatThreadBody"><div id="chatTyping"></div></div></div></div></body></html>', { pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
global.CSS = window.CSS || { escape: (s) => String(s).replace(/["\\]/g, '\\$&') };
global.Node = window.Node;
global.MutationObserver = window.MutationObserver;

/* ---------- 抽取被测函数 ---------- */
const NAMES = [
  'chatHistoryLineStampHTML', 'chatClockText', 'chatRecordTrustedTime', 'chatRecordTimeValue', 'chatSpecialCardTimeInfo',
  'chatSpecialIdentityAttrs', 'chatBubbleTextOf', 'chatLineIdentityKeys', 'chatLineMergeKey', 'chatLineWeakKey',
  'chatLineDeleteKeys', 'chatLineDeleteKey', 'mergeChatHistoryLineLists', 'chatSpecialIdentityFromLine',
  'chatPlainLineRepeatKey', 'chatLineIsPlainBubble', 'isKomoCardChatLine', 'stripKomoCardMeta',
  'repairStoredChatHistoryLayout', 'normalizeStoredChatSpecialLines', 'dedupeChatSpecialCardsInDom',
  'insertChatLineByTime', 'chatHistoryShardKey', 'loadChatHistoryState', 'getChatHistorySnapshot', 'persistChatHistoryState',
  'stampChatMessageLine', 'saveChatHistoryForHandle', 'formatChatMessageTimestamp', 'updateChatLineReceipt',
  'setDeliveryIndicator', 'isChatThreadDomForHandle', 'markChatSnapshotStale', 'isChatSnapshotStale',
  'readChatSnapshotStaleRooms', 'clearChatSnapshotStaleMark', 'chatSpecialCardPresentInHistory', 'retireLegacyMonolithChatHistory',
  'scheduleSaveChatHistory', 'rememberDeletedChatLine', 'chatViewWindowSize', 'rememberChatViewWindow', 'loadChatViewWindowMap',
  'restoreChatHistory', 'sanitizeChatQuoteBlocks', 'sanitizeGlyphRequestBubbles', 'countStoredChatHistoryLines',
  'isGlobalFontScaleTarget', 'globalFontScaleSensitivity', 'getHarmonizedGlobalFontBaseSize', 'getHarmonizedGlobalFontMultiplier',
  'applyGlobalFontScaleToTree', 'applyGlobalFontScale', 'observeGlobalFontScale'
];
let src = NAMES.map((n) => { try { return extractFunction(n); } catch (e) { return `/* 缺失：${n} */`; } }).join('\n\n');
if (process.env.DBG) {
  src = src.replace('const state = loadChatHistoryState();\n      const previous = getChatHistorySnapshot(key);',
    `const state = loadChatHistoryState();
      const LBL = (arr) => JSON.stringify((arr||[]).map(h => h.includes('red-id') ? '红包' : ((h.match(/class="chat-bubble"[^>]*>([^<]*)</)||[])[1] || '?')));
      console.log('  [save] previous =', LBL(previous && previous.lines));`);
  src = src.replace('const sanitizedMergedLines = normalizeStoredChatSpecialLines(key, mergedLines);',
    `const sanitizedMergedLines = normalizeStoredChatSpecialLines(key, mergedLines);
      console.log('  [save] serialized =', LBL(serialized), ' merged =', LBL(mergedLines), ' normalized =', LBL(sanitizedMergedLines));
      if (process.env.DBG2) { console.log('  [save] previous 明细 =', JSON.stringify((previous&&previous.lines||[]).map(h=>((h.match(/data-created-at="(\\d+)"/)||[])[1]||'无')+':'+(h.includes('red-id')?'红包':'文'))) ); }`);
}

/* ---------- 被测环境的状态与桩 ---------- */
const storage = new Map();
let chatHistoryState = null;
let activeChatHandle = 'h1';
let currentPartnerHandle = 'h1';
let restoringChatHistory = false;
let chatHistorySwitching = false;
let chatHistoryMutationIgnoreUntil = 0;
let chatHistoryPersistTimer = 0;
let chatHistoryObserver = null;
let monolithRetireChecked = false;
const CHAT_HISTORY_STORAGE_KEY = 'dream-messenger:chat-history';
const CHAT_HISTORY_SHARD_PREFIX = 'dream-messenger:chat-history:room:';
const CHAT_HISTORY_SHARD_INDEX_KEY = 'dream-messenger:chat-history:rooms';
const CHAT_RECEIPT_LABELS = { delivered: '已送达', unread: '未读', read: '已读', readNoReply: '已读不回' };
const CHAT_RECEIPT_ICONS = { delivered: '✓', unread: '✓', read: '✓✓', readNoReply: '✓✓⊘' };
let ALL_SETTINGS = {};
const persisted = [];

function getChatSettings(handle = currentPartnerHandle) {
  if (!ALL_SETTINGS[handle]) ALL_SETTINGS[handle] = { deletedSpecialMessageIds: [], deletedChatLineKeys: [], redEnvelopes: [], transferRecords: [], checkHistory: [], decisionRecords: [], inviteHistory: [] };
  return ALL_SETTINGS[handle];
}
function setActiveHandle(h) { activeChatHandle = h; currentPartnerHandle = h; }
function readDreamJSON(key, fallback) { return storage.has(key) ? JSON.parse(storage.get(key)) : fallback; }
function writeDreamJSON(key, value) { storage.set(key, JSON.stringify(value)); return true; }
function removeDreamStorage(key) { storage.delete(key); }
const globalAppSettingsStub = { fontScale: 100, receiptStyle: 'icon', readReceipt: true };
function loadGlobalAppSettings() { return globalAppSettingsStub; }
let globalFontScaleObserver = null;
let globalFontScaleApplyVersion = 0;
const GLOBAL_FONT_SCALE_TEXT_SELECTOR = 'button,input,textarea,select,option,label,a,span,strong,small,p,h1,h2,h3,h4,h5,h6,li,time,code,output,legend,summary,section,article,header,footer,main,aside,nav,div';
const GLOBAL_FONT_SCALE_FIXED_SELECTOR = '.chat-media-viewer-emoji,.chat-sticker-emoji,.sticker-emoji-preview,.warm-anni-num,.feature-red-claim-amount,.feature-red-total strong';
function isChatConversationBeingRead() { return true; }
function decompressDreamJSONString(v) { return v; }
function dreamStorageSafetyKey(...a) { return a.join(':'); }
function getDreamStorageRecoveryRaw() { return null; }
function applyChatHistoryState() {}
const defaultChatThreadMarkup = '<div id="chatTyping"></div>';
const CHAT_VIEW_WINDOW_KEY = 'dream-chat-view-window:v1';
const CHAT_VIEW_WINDOW_MIN = 100;
const CHAT_VIEW_WINDOW_MAX = 400;
function hydrateDreamMediaTree() {}
function rehydrateStoredChatAvatars() {}
function bindChatVoiceBubbleInteractions() {}
function createChatPokeNotice() { return null; }
function sanitizeChatQuoteBlocks() {}
function sanitizeGlyphRequestBubbles() {}
const lucide = { createIcons() {} };
window.lucide = lucide;
window.ensureChatHistoryLoadEarlierButton = function () {};

const ctx = {
  document, window, CSS, Node, MutationObserver,
  getChatSettings, readDreamJSON, writeDreamJSON, removeDreamStorage, loadGlobalAppSettings,
  isChatConversationBeingRead, defaultChatThreadMarkup, decompressDreamJSONString, dreamStorageSafetyKey,
  getDreamStorageRecoveryRaw, applyChatHistoryState,
  CHAT_HISTORY_STORAGE_KEY, CHAT_HISTORY_SHARD_PREFIX, CHAT_HISTORY_SHARD_INDEX_KEY,
  CHAT_RECEIPT_LABELS, CHAT_RECEIPT_ICONS, CHAT_VIEW_WINDOW_KEY, CHAT_VIEW_WINDOW_MIN, CHAT_VIEW_WINDOW_MAX,
  GLOBAL_FONT_SCALE_TEXT_SELECTOR, GLOBAL_FONT_SCALE_FIXED_SELECTOR, globalAppSettingsStub,
  get globalFontScaleObserver() { return globalFontScaleObserver; },
  set globalFontScaleObserver(v) { globalFontScaleObserver = v; },
  get globalFontScaleApplyVersion() { return globalFontScaleApplyVersion; },
  set globalFontScaleApplyVersion(v) { globalFontScaleApplyVersion = v; },
  hydrateDreamMediaTree, rehydrateStoredChatAvatars, bindChatVoiceBubbleInteractions, createChatPokeNotice,
  sanitizeChatQuoteBlocks, sanitizeGlyphRequestBubbles, lucide,
  isChatSnapshotStale: () => false, clearChatSnapshotStaleMark: () => {},
  get activeChatHandle() { return activeChatHandle; },
  set activeChatHandle(v) { activeChatHandle = v; },
  get currentPartnerHandle() { return currentPartnerHandle; },
  set currentPartnerHandle(v) { currentPartnerHandle = v; },
  get restoringChatHistory() { return restoringChatHistory; },
  set restoringChatHistory(v) { restoringChatHistory = v; },
  get chatHistorySwitching() { return chatHistorySwitching; },
  set chatHistorySwitching(v) { chatHistorySwitching = v; },
  get chatHistoryMutationIgnoreUntil() { return chatHistoryMutationIgnoreUntil; },
  set chatHistoryMutationIgnoreUntil(v) { chatHistoryMutationIgnoreUntil = v; },
  get chatHistoryState() { return chatHistoryState; },
  set chatHistoryState(v) { chatHistoryState = v; },
  get chatHistoryPersistTimer() { return chatHistoryPersistTimer; },
  set chatHistoryPersistTimer(v) { chatHistoryPersistTimer = v; },
  get chatHistoryObserver() { return chatHistoryObserver; },
  set chatHistoryObserver(v) { chatHistoryObserver = v; },
  get monolithRetireChecked() { return monolithRetireChecked; },
  set monolithRetireChecked(v) { monolithRetireChecked = v; },
  window,
  settingsMap: ALL_SETTINGS,
  storageMap: storage
};

const wrapped = `with (ctx) {\n${src}\n
return {
  mergeChatHistoryLineLists, repairStoredChatHistoryLayout, normalizeStoredChatSpecialLines, saveChatHistoryForHandle,
  restoreChatHistory, getChatHistorySnapshot, dedupeChatSpecialCardsInDom, insertChatLineByTime, chatLineIdentityKeys,
  loadChatHistoryState, persistChatHistoryState, stampChatMessageLine, formatChatMessageTimestamp, updateChatLineReceipt,
  setHandle: (h) => { activeChatHandle = h; currentPartnerHandle = h; },
  setSettings: (h, s) => { ctx.settingsMap[h] = s; },
  getSettings: (h) => ctx.settingsMap[h],
  setFlag: (k, v) => { if (k === 'restoringChatHistory') restoringChatHistory = v; if (k === 'chatHistorySwitching') chatHistorySwitching = v; },
  mergeChatHistoryLineLists, chatLineIdentityKeys, chatSpecialIdentityAttrs, chatLineWeakKey, chatPlainLineRepeatKey, chatLineIsPlainBubble, isKomoCardChatLine, insertChatLineByTime, chatSpecialCardTimeInfo, chatSpecialIdentityFromLine, chatHistoryLineStampHTML, chatRecordTimeValue, chatRecordTrustedTime,
  applyGlobalFontScaleToTree, applyGlobalFontScale, isGlobalFontScaleTarget, globalAppSettingsStub
};\n}`;
const factory = new Function('ctx', wrapped);
const api = factory(ctx);
/* 抽取出来的函数彼此引用：回填进 ctx（with 是运行时查找，回填即可生效） */
ctx.formatChatMessageTimestamp = api.formatChatMessageTimestamp;
ctx.updateChatLineReceipt = api.updateChatLineReceipt;
ctx.restoreChatHistory = api.restoreChatHistory;
ctx.stampChatMessageLine = api.stampChatMessageLine;
ctx.getChatHistorySnapshot = api.getChatHistorySnapshot;
ctx.persistChatHistoryState = api.persistChatHistoryState;
ctx.loadChatHistoryState = api.loadChatHistoryState;
ctx.saveChatHistoryForHandle = api.saveChatHistoryForHandle;
ctx.scheduleSaveChatHistory = () => {};
window.persistChatMessagesIndividually = async (handle, lines) => { persisted.push({ handle, count: lines.length }); return true; };

module.exports = {
  api, ctx, storage, window, document, ALL_SETTINGS,
  resetState() { chatHistoryState = null; },
  getActive: () => ({ activeChatHandle, currentPartnerHandle, restoringChatHistory })
};

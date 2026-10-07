/* 场景⑥：全局字号 —— ① 同一比例重复应用必须幂等（不再逐格变大）；
   ② 新插入的节点按当前比例即时生效，老节点不受影响；
   ③ applyGlobalFontScaleToTree 的读-写分离：一次调用里读到的都是「写之前」的布局。 */
const { api, document, ctx } = require('./harness');
const win = document.defaultView;
const screen = document.getElementById('appScreen');
const style = document.createElement('style');
style.textContent = '.fs-a{font-size:16px}.fs-b{font-size:20px}.fs-c{font-size:11px}';
document.head.appendChild(style);
screen.innerHTML = '<div class="fs-a">甲组文字</div><div class="fs-b"><span class="fs-c">嵌套文字</span><span class="fs-a">乙组文字</span></div>';

api.globalAppSettingsStub.fontScale = 115;   // 用户把字号调大了
const sizeOf = (sel) => parseFloat(win.getComputedStyle(document.querySelector(sel)).fontSize);
const snap = () => [sizeOf('.fs-a'), sizeOf('.fs-b > .fs-c'), sizeOf('.fs-b > .fs-a')].map(v => Math.round(v * 100) / 100);

api.applyGlobalFontScale();
const first = snap();
api.applyGlobalFontScale();
const second = snap();
api.applyGlobalFontScale();
const third = snap();
console.log('115% 第一次 =', JSON.stringify(first));
console.log('115% 第二次 =', JSON.stringify(second), '（必须与第一次相同）');
console.log('115% 第三次 =', JSON.stringify(third), '（必须与第一次相同）');

const node = document.createElement('div');
node.className = 'fs-a';
node.textContent = '新来的消息';
document.querySelector('.fs-b').appendChild(node);
api.applyGlobalFontScale();
console.log('新节点字号 =', parseFloat(win.getComputedStyle(node).fontSize).toFixed(2), '（应与 .fs-a 一致 =', sizeOf('.fs-a').toFixed(2), '）');
console.log('插新节点后老节点 =', JSON.stringify(snap()), '（必须不变）');

/* 换一个比例：必须按「基础字号」重算，不能在上一次的结果上再乘一次 */
api.globalAppSettingsStub.fontScale = 100;
api.applyGlobalFontScale();
console.log('调回 100% =', JSON.stringify(snap()), '（应回到 16 / 11 / 16）');

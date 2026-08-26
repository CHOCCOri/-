Möbius 部署包
================================================
生成日期：2026-08-26 · sw.js CACHE_VERSION = v4 · 分类备份 backupVersion = 3

【目录结构】必须保持这个层级
    index.html                        主程序
    sw.js                             Service Worker（必须与 index.html 同级）
    manifest.webmanifest              PWA 清单
    icons/                            7 个图标

【关键要求】
1. 必须 HTTPS（localhost 除外），否则 SW / 通知 / persist 全失效
2. sw.js 必须与 index.html 同层
3. 服务器对 sw.js 返回 Cache-Control: no-cache
4. 每次更新 index.html 或图标，把 sw.js 的 CACHE_VERSION 递增（v4 → v5）

【备份说明】
- 迁移 / 换设备：用「流式全量备份」（覆盖全部数据）
- 分类备份已于 backupVersion 3 补齐 AI 配置、账号昵称、答案之书、
  通知中心、主动事件调度共 5 项；旧版 v2 档案仍可正常导入。

【平台限制（非缺陷）】
- iOS：需先「添加到主屏幕」才能用通知；persist() 常返回 false
- 国内安卓：本应用走本地通知，不受 FCM 不可用影响；
       建议引导用户开启自启动与电池不受限
- HarmonyOS NEXT：ArkWeb 内核，需真机验证

【数据说明】
数据全部存在浏览器本地，无服务端。更换域名会导致数据无法访问，
迁移前务必让用户用「流式全量备份」导出。

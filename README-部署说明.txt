Möbius 部署包
================================================
生成日期：2026-08-26 · CACHE_VERSION = v7 · backupVersion = 3

【目录结构】必须保持层级
    index.html / sw.js / manifest.webmanifest / icons/(7个图标)

【关键要求】
1. 必须 HTTPS（localhost 除外）
2. sw.js 必须与 index.html 同层
3. 服务器对 sw.js 返回 Cache-Control: no-cache
4. 每次更新 index.html 或图标，CACHE_VERSION 递增（v7 → v8）

【本次修复】
- 设置保存后偶尔回退：V3 镜像写入加了失败重试与页面隐藏前兜底刷写
  （对所有本地数据生效，不止全局设置）

【打包成 APP（ToApp / WebToApp / HBuilderX 等）】
- 键盘适配已做成平台无关，自定义 UA 也能正常工作
- 若外壳可配置，建议 Android 侧设 windowSoftInputMode="adjustResize"
- 打包后实测：进入聊天 → 点输入框 → 底部栏应自动让位

【备份选择 · 重要】
- 有一起听 MP3 歌单 / 大量语音字卡 → 必须用「流式全量备份」
- 分类备份适合只搬某几类文字数据

【平台限制（非缺陷）】
- iOS：需先「添加到主屏幕」才能用通知；persist() 常返回 false
       iOS 存储 7 天未访问可能被回收，建议定期导出备份
- 国内安卓：走本地通知，不受 FCM 不可用影响
- HarmonyOS NEXT：ArkWeb 内核，需真机验证

【数据说明】
数据全部存在浏览器本地，无服务端。更换域名会导致数据无法访问，
迁移前务必先用「流式全量备份」导出。

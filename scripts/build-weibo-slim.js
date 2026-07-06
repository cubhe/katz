// 生成首页用的瘦身微博数据 data/weibo-slim.json：
// 合并 weibo.json + weibo2.json，只保留首页渲染用到的 createdAt / text 字段
// （全量文件 ~2MB，瘦身后 ~300KB；同时避免把 favorites/followings/user
//   等无关个人数据下发到首页）。
// 用法：node scripts/build-weibo-slim.js
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const pick = (file) => {
    const d = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
    return (d.weibo || []).map(w => ({ createdAt: w.createdAt, text: w.text }));
};

const weibo = [...pick('weibo.json'), ...pick('weibo2.json')];
const out = path.join(dataDir, 'weibo-slim.json');
fs.writeFileSync(out, JSON.stringify({ weibo }));
console.log(`weibo-slim.json: ${weibo.length} entries, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);

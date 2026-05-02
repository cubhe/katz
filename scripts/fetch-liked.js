// 拉"我喜欢的音乐"全部曲目（分页）+ 输出统计
// 复用 .cookie，不需要重扫码

const api = require('NeteaseCloudMusicApi');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const COOKIE_PATH = path.join(SCRIPT_DIR, '.cookie');
const RAW = path.join(SCRIPT_DIR, 'playlists-raw.json');
const OUT_FULL = path.join(SCRIPT_DIR, 'liked-full.json');
const OUT_TRIM = path.join(SCRIPT_DIR, 'liked.json');
const OUT_STATS = path.join(SCRIPT_DIR, 'liked-stats.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    if (!fs.existsSync(COOKIE_PATH)) {
        console.error('找不到 .cookie，请先跑 fetch-netease.js 登录');
        process.exit(1);
    }
    const cookie = fs.readFileSync(COOKIE_PATH, 'utf8').trim();

    const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
    // 网易云的"我喜欢的音乐"标记是 specialType === 5
    const liked = raw.find(p => p.specialType === 5)
                || raw.find(p => /喜欢的音乐$/.test(p.name));
    if (!liked) {
        console.error('找不到"我喜欢的音乐"歌单');
        process.exit(2);
    }
    console.log(`歌单: ${liked.name}  id=${liked.id}  trackCount=${liked.trackCount}`);

    // 分页拉
    const PAGE = 500;
    const all = [];
    for (let offset = 0; offset < liked.trackCount; offset += PAGE) {
        const r = await api.playlist_track_all({
            id: liked.id, limit: PAGE, offset, cookie
        });
        const songs = (r.body && r.body.songs) || [];
        all.push(...songs);
        process.stdout.write(`\r  offset ${offset.toString().padStart(5)}: +${songs.length}  累计 ${all.length}/${liked.trackCount}`);
        if (songs.length === 0) break;
        await sleep(500);
    }
    console.log();

    // 保存完整数据（含网易云返回的所有字段）
    fs.writeFileSync(OUT_FULL, JSON.stringify(all, null, 2));
    console.log(`完整数据 → ${OUT_FULL} (${(fs.statSync(OUT_FULL).size / 1024).toFixed(0)} KB)`);

    // 保存精简版
    const trim = all.map(t => ({
        id: t.id,
        title: t.name,
        artist: (t.ar || []).map(a => a.name).join(' / '),
        album: t.al?.name || '',
        duration: t.dt || 0,
        publishTime: t.publishTime || 0
    }));
    fs.writeFileSync(OUT_TRIM, JSON.stringify(trim, null, 2));
    console.log(`精简版 → ${OUT_TRIM} (${(fs.statSync(OUT_TRIM).size / 1024).toFixed(0)} KB)`);

    // ===== 统计 =====
    const stats = {
        total: trim.length,
        totalDurationMs: trim.reduce((s, t) => s + t.duration, 0),
        topArtists: [],
        topAlbums: [],
        byYear: {},
        avgDurationSec: 0
    };
    stats.totalDurationHours = +(stats.totalDurationMs / 3600000).toFixed(1);
    stats.avgDurationSec = Math.round(stats.totalDurationMs / 1000 / trim.length);

    const artistCount = {};
    const albumCount = {};
    trim.forEach(t => {
        t.artist.split(' / ').filter(a => a).forEach(a => {
            artistCount[a] = (artistCount[a] || 0) + 1;
        });
        if (t.album) {
            albumCount[t.album] = (albumCount[t.album] || 0) + 1;
        }
        if (t.publishTime) {
            const year = new Date(t.publishTime).getUTCFullYear();
            if (year >= 1900 && year <= 2030) {
                stats.byYear[year] = (stats.byYear[year] || 0) + 1;
            }
        }
    });
    stats.topArtists = Object.entries(artistCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 50)
        .map(([name, count]) => ({ name, count }));
    stats.topAlbums = Object.entries(albumCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 30)
        .map(([name, count]) => ({ name, count }));

    fs.writeFileSync(OUT_STATS, JSON.stringify(stats, null, 2));

    console.log();
    console.log(`总计: ${stats.total} 首 / ${stats.totalDurationHours} 小时 / 平均 ${stats.avgDurationSec} 秒`);
    console.log();
    console.log('Top 20 艺人:');
    stats.topArtists.slice(0, 20).forEach((a, i) => {
        console.log(`  ${(i + 1).toString().padStart(2)}. ${a.count.toString().padStart(4)}  ${a.name}`);
    });
    console.log();
    console.log('按年份分布 (前 15):');
    Object.entries(stats.byYear)
        .sort((a, b) => +b[0] - +a[0]).slice(0, 15)
        .forEach(([y, c]) => console.log(`  ${y}: ${c}`));
    console.log();
    console.log(`统计 → ${OUT_STATS}`);
})().catch(e => { console.error('FAIL:', e); process.exit(3); });

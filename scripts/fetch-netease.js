// 一次性脚本：扫码登录网易云 → 拉取你的所有歌单 → 保存到 playlists-raw.json
// 用法：cd scripts && node fetch-netease.js

const api = require('NeteaseCloudMusicApi');
const QR = require('qrcode');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const PNG_PATH = path.join(SCRIPT_DIR, 'qr.png');
const COOKIE_PATH = path.join(SCRIPT_DIR, '.cookie');
const RAW_OUT = path.join(SCRIPT_DIR, 'playlists-raw.json');
const TRACKS_OUT = path.join(SCRIPT_DIR, 'playlists-with-tracks.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function login() {
    // 复用已有 cookie（如果还有效）
    if (fs.existsSync(COOKIE_PATH)) {
        const c = fs.readFileSync(COOKIE_PATH, 'utf8').trim();
        try {
            const status = await api.login_status({ cookie: c });
            const uid = status?.body?.data?.account?.id || status?.body?.data?.profile?.userId;
            if (uid) {
                console.log('沿用已有 cookie，userId =', uid);
                return c;
            }
        } catch (e) { /* fall through to QR login */ }
    }

    // 1) 拿 unikey
    const keyRes = await api.login_qr_key({});
    const unikey = keyRes.body.data.unikey;

    // 2) 生成 QR url
    const qrRes = await api.login_qr_create({ key: unikey, qrimg: false });
    const qrUrl = qrRes.body.data.qrurl;

    // 3) 存 PNG 和 ASCII
    await QR.toFile(PNG_PATH, qrUrl, { width: 400, margin: 2 });
    console.log('\n二维码已保存到：', PNG_PATH);
    console.log('用网易云音乐 app 扫这张图（或扫下面的 ASCII）');
    console.log();
    const ascii = await QR.toString(qrUrl, { type: 'terminal', small: true });
    console.log(ascii);
    console.log('等你扫码 + 在 app 上确认登录...（最多 90 秒）');

    // 4) 轮询
    for (let i = 0; i < 90; i++) {
        await sleep(2000);
        const check = await api.login_qr_check({ key: unikey });
        const code = check.body.code;
        const label = ({ 800: '过期', 801: '等待扫码', 802: '已扫码 等确认', 803: '登录成功!' }[code]) || '';
        process.stdout.write(`\r[${i + 1}/90] code=${code} ${label}                  `);
        if (code === 800) {
            console.log('\n二维码过期，请重新运行脚本');
            process.exit(1);
        }
        if (code === 803) {
            console.log();
            const cookie = check.body.cookie;
            fs.writeFileSync(COOKIE_PATH, cookie, { mode: 0o600 });
            console.log('cookie 已保存（注意：含 session token，用完可删）');
            return cookie;
        }
    }
    console.log('\n超时');
    process.exit(1);
}

(async () => {
    try {
        const cookie = await login();

        // 5) 拿 userId
        const acc = await api.user_account({ cookie });
        const profile = acc.body.profile;
        if (!profile) {
            console.error('无法获取 profile，body:', JSON.stringify(acc.body).slice(0, 300));
            process.exit(2);
        }
        const userId = profile.userId;
        console.log(`登录用户：${profile.nickname}（uid=${userId}）`);

        // 6) 拉所有歌单
        const pls = await api.user_playlist({ uid: userId, limit: 200, cookie });
        const lists = pls.body.playlist || [];
        console.log(`\n共 ${lists.length} 个歌单：`);
        lists.forEach((p, i) => {
            const owner = p.creator?.userId === userId ? '(自建)' : '(收藏)';
            console.log(`  ${String(i + 1).padStart(2)}. ${p.name}  [${p.trackCount} 首] ${owner}`);
        });

        // 7) 保存原始数据
        fs.writeFileSync(RAW_OUT, JSON.stringify(lists, null, 2));
        console.log(`\n原始歌单元数据 → ${RAW_OUT}`);

        // 8) 拉每个自建歌单的曲目
        const ownPlaylists = lists.filter(p => p.creator?.userId === userId);
        console.log(`\n开始拉 ${ownPlaylists.length} 个自建歌单的曲目...`);
        const out = [];
        for (const p of ownPlaylists) {
            try {
                const detail = await api.playlist_detail({ id: p.id, cookie });
                const tracks = (detail.body.playlist?.tracks || []).map(t => ({
                    name: t.name,
                    artist: (t.ar || []).map(a => a.name).join(' / '),
                    album: t.al?.name || '',
                    duration: t.dt
                }));
                out.push({
                    id: p.id,
                    name: p.name,
                    description: p.description || '',
                    coverImgUrl: p.coverImgUrl,
                    trackCount: p.trackCount,
                    tracks
                });
                console.log(`  ✓ ${p.name}: ${tracks.length} 首`);
                await sleep(400); // be nice to NE
            } catch (e) {
                console.log(`  ✗ ${p.name}: ${e.message}`);
            }
        }
        fs.writeFileSync(TRACKS_OUT, JSON.stringify(out, null, 2));
        console.log(`\n带曲目的自建歌单 → ${TRACKS_OUT}`);
    } catch (e) {
        console.error('脚本失败：', e);
        process.exit(3);
    }
})();

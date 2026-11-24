// Labels stay local to the installable mod and follow the host panel locale.
export const label = (zh, en, indonesian) => ({ 'zh-CN': zh, en, in: indonesian || en });

const messages = {
    'zh-CN': {
        title: 'Wallpaper Engine', refresh: '刷新壁纸库', loading: '读取壁纸库…', chooseSong: '选歌', returnDesktop: '回到桌面',
        follow: '跟随 WE 当前壁纸', manual: '手动选择', saved: 'WE 已保存的设置',
        preset: '预设', fps: '捕获上限', original: '沿用 WE', interaction: '壁纸鼠标交互',
        ready: '已接入原生画面', opening: '正在打开 WE 原壁纸…', idle: '选择壁纸后在播放页显示',
        error: 'WE 画面接入失败', reload: '载入原生画面模块', reloadHint: '首次启用需要重新载入 Folia 页面。',
        empty: 'WE 壁纸库中没有可用的项目', properties: '壁纸原属性',
        native: '场景与组件由 Wallpaper Engine 原样运行', unknown: '没有可用的壁纸',
        pause: '窗口隐藏时暂停画面', weSettings: '在模组设置中调整当前壁纸的原属性',
        choose: '选择壁纸', scene: '场景', video: '视频', web: '网页', application: '应用', paused: '画面已暂停', desktop: '显示到桌面',
        settingsLocation: '壁纸、预设、帧率和鼠标交互统一在「歌词样式 → 背景 → Wallpaper Engine 原生画面」调整。',
        advancedHint: '当前壁纸的主题色等高级原属性保留在本页的「WE 原属性」中。',
        fpsHint: '此项只设置捕获上限，不修改 WE 帧率。高帧率需同时在 WE 中设置；视频受源帧率限制。30 FPS 更省资源，默认沿用 WE。',
    },
    en: {
        title: 'Wallpaper Engine', refresh: 'Refresh library', loading: 'Reading wallpaper library…', chooseSong: 'Choose music', returnDesktop: 'Return to desktop',
        follow: 'Follow the current WE wallpaper', manual: 'Choose a wallpaper', saved: 'Saved WE settings',
        preset: 'Preset', fps: 'Capture limit', original: 'Use WE setting', interaction: 'Wallpaper mouse interaction',
        ready: 'Native wallpaper connected', opening: 'Opening the original WE wallpaper…', idle: 'Choose a wallpaper to show on the player page',
        error: 'Could not connect the WE wallpaper', reload: 'Load native wallpaper module', reloadHint: 'Reload the Folia page once to finish enabling the module.',
        empty: 'No usable projects were found in the WE library', properties: 'Original wallpaper properties',
        native: 'Wallpaper Engine runs the original scene and components', unknown: 'No wallpaper available',
        pause: 'Pause while the window is hidden', weSettings: 'Edit the original wallpaper properties in mod settings',
        choose: 'Choose wallpaper', scene: 'Scene', video: 'Video', web: 'Web', application: 'Application', paused: 'Wallpaper paused', desktop: 'Show on desktop',
        settingsLocation: 'Choose wallpapers, presets, frame rate and mouse interaction under Lyrics style → Background → Wallpaper Engine native.',
        advancedHint: 'Advanced properties such as the current wallpaper’s scheme colour remain in WE properties on this page.',
        fpsHint: 'This sets the capture limit without changing WE. Set a higher rate in WE as well; videos remain limited by their source rate. 30 FPS uses fewer resources. The default follows WE.',
    },
    in: {
        title: 'Wallpaper Engine', refresh: 'Muat ulang pustaka', loading: 'Membaca pustaka wallpaper…', chooseSong: 'Pilih lagu', returnDesktop: 'Kembali ke desktop',
        follow: 'Ikuti wallpaper WE saat ini', manual: 'Pilih wallpaper', saved: 'Pengaturan WE tersimpan',
        preset: 'Prasetel', fps: 'Batas tangkapan', original: 'Gunakan pengaturan WE', interaction: 'Interaksi tetikus wallpaper',
        ready: 'Wallpaper asli terhubung', opening: 'Membuka wallpaper WE asli…', idle: 'Pilih wallpaper untuk halaman pemutar',
        error: 'Gagal menghubungkan wallpaper WE', reload: 'Muat modul wallpaper asli', reloadHint: 'Muat ulang halaman Folia sekali untuk mengaktifkan modul.',
        empty: 'Tidak ada proyek yang dapat digunakan di pustaka WE', properties: 'Properti asli wallpaper',
        native: 'Wallpaper Engine menjalankan adegan dan komponen asli', unknown: 'Wallpaper tidak tersedia',
        pause: 'Jeda saat jendela tersembunyi', weSettings: 'Ubah properti asli wallpaper di pengaturan mod',
        choose: 'Pilih wallpaper', scene: 'Adegan', video: 'Video', web: 'Web', application: 'Aplikasi', paused: 'Wallpaper dijeda', desktop: 'Tampilkan di desktop',
        settingsLocation: 'Pilih wallpaper, prasetel, laju bingkai dan interaksi tetikus melalui Gaya lirik → Latar belakang → Wallpaper Engine asli.',
        advancedHint: 'Properti lanjutan seperti warna tema tetap ada di Properti WE pada halaman ini.',
        fpsHint: 'Ini hanya mengatur batas tangkapan tanpa mengubah WE. Atur laju lebih tinggi di WE juga; video dibatasi laju sumbernya. 30 FPS lebih hemat sumber daya. Secara bawaan mengikuti WE.',
    },
};

export function translator(locale = document.documentElement.lang) {
    const key = locale?.startsWith('zh') ? 'zh-CN' : locale === 'in' || locale?.startsWith('id') ? 'in' : 'en';
    return name => messages[key][name] || name;
}

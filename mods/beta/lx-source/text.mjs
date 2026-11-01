// Localized Folium command labels; Folium selects these using the application's current language.
const label = (zh, en, id) => ({ 'zh-CN': zh, en, in: id });
export const text = {
    consent: label('我信任并确认执行自行提供的脚本', 'I trust and confirm execution of my chosen script', 'Saya percaya dan menyetujui eksekusi skrip pilihan saya'),
    consentHint: label('脚本会联网并可能向第三方发送歌曲信息；启用后重启会运行保存的副本。模组不提供音源脚本。', 'Scripts can contact third parties and send song information. Enabled copies run again after restart. No source script is supplied.', 'Skrip dapat mengirim informasi lagu ke pihak ketiga. Salinan aktif dijalankan kembali setelah mulai ulang. Skrip sumber tidak disertakan.'),
    consentRequired: label('请先确认你信任并同意运行该脚本。', 'Confirm that you trust and agree to run this script first.', 'Konfirmasikan kepercayaan dan persetujuan menjalankan skrip terlebih dahulu.'),
    importUrl: label('LX 音源：从链接导入', 'LX source: import URL', 'Sumber LX: impor URL'),
    importFile: label('LX 音源：导入本地脚本', 'LX source: import script file', 'Sumber LX: impor berkas skrip'),
    url: label('脚本链接（HTTP / HTTPS）', 'Script URL (HTTP / HTTPS)', 'URL skrip (HTTP / HTTPS)'),
    importHint: label('导入并启用可信的 LX JavaScript 脚本，成功后替换当前脚本。', 'Import and enable a trusted LX JavaScript source; replaces the current script on success.', 'Impor dan aktifkan skrip LX tepercaya; ganti skrip saat ini setelah berhasil.'),
    enable: label('LX 音源：启用已导入脚本', 'LX source: enable saved script', 'Sumber LX: aktifkan skrip tersimpan'),
    disable: label('LX 音源：停用', 'LX source: disable', 'Sumber LX: nonaktifkan'),
    remove: label('LX 音源：移除脚本', 'LX source: remove script', 'Sumber LX: hapus skrip'),
    status: label('LX 音源：查看状态', 'LX source: status', 'Sumber LX: status'),
    enabled: label('已启用，切换到 LX 音源后搜索播放', 'Enabled. Select an LX source to search and play.', 'Aktif. Pilih sumber LX untuk mencari dan memutar.'),
    disabled: label('已停用', 'Disabled', 'Dinonaktifkan'),
    removed: label('脚本已移除', 'Script removed', 'Skrip dihapus'),
    empty: label('尚未导入脚本', 'No script imported', 'Belum ada skrip yang diimpor'),
    cancelled: label('已取消', 'Cancelled', 'Dibatalkan'),
};
export function t(labels) {
    const locale = document.documentElement.lang || navigator.language;
    return labels[locale] ?? (locale.startsWith('zh') ? labels['zh-CN'] : locale.startsWith('id') ? labels.in : labels.en);
}


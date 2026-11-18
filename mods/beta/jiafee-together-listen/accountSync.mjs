// Read public account presentation only; installation-local accountKey is never sent to peers.
export function getLocalUserProfile(folium) {
    for (const provider of ['netease', 'qq']) {
        const account = folium.account?.getState(provider);
        if (account?.status === 'signed-in' && account.user) {
            let avatar = 'default:signal';
            try {
                const url = new URL(account.user.avatarUrl);
                if (url.protocol === 'https:' && !url.username && !url.password) avatar = url.href;
            } catch {}
            return { name: account.user.nickname || '已登录用户', avatar };
        }
    }
    return { name: '未登录用户', avatar: 'default:signal' };
}

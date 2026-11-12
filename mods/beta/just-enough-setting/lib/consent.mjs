// mods/Just-Enough-Setting/lib/consent.mjs
// 「接管宿主界面」的用户同意记录。
//
// 为什么同意不放进模组设置：宿主的 settings 会随「视觉配置」导入导出（paramStore 里写得很清楚，
// the whole map rides along in visual config import/export）。同意是**这台机器上这一次安装**的事，
// 塞进设置就等于：别人分享一份配置给你，你一导入就替自己点了同意。
//
// 所以它存在渲染进程的 localStorage：不随配置导出，也不会被导入覆盖，卸载 / 清数据即失效。
// 撤销时直接把键删掉，不写 `'false'`——读不到就是没同意，没有第三种状态。

const CONSENT_KEY = 'jes:host-takeover:v1';

/** 用户是否已经同意模组接管宿主界面。读不到（隐私模式、存储被禁用）一律算没同意。 */
export const readHostConsent = () => {
  try {
    return globalThis.localStorage?.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
};

/** 记下 / 撤销同意。返回是否落盘成功：失败了调用方要如实告诉用户「这次只在本会话生效」。 */
export const writeHostConsent = (granted) => {
  try {
    if (granted) globalThis.localStorage?.setItem(CONSENT_KEY, 'granted');
    else globalThis.localStorage?.removeItem(CONSENT_KEY);
    return true;
  } catch {
    return false;
  }
};

# folium-compound

Folia 的官方模组与通过审查的第三方模组，连同它们的签名。

这里每个模组目录都带一个 `folium.sig.json`：Folium 维护者用签名私钥（Ed25519）对模组内容做的签名。
Folia 用内置的公钥校验它，校验通过的模组在应用里标为「官方认证」。没有签名的模组照样能装、能用，只显示为
「未验证」；签名校验失败（例如签名后文件被改过）显示为「签名不匹配」。

签名只是来源与完整性的标识：它证明「Folium 审查过这些字节，之后没被改动」。认证过的模组启用时仍要用户确认，
启用后也仍然拥有应用的完整权限。模组平台本身的规范见 Folia 仓库的 `mods/README.md`。

## 目录

```
mods/
  official/<mod-id>/     Folium 维护者编写的模组
  community/<mod-id>/    通过审查的第三方模组
keys/
  trusted-keys.json      签名公钥（与 Folia 的 electron/modSystem/trustedKeys.cjs 保持一致）
  revoked-mods.json      已撤回的模组（按签名摘要）
index.json               由 tools/build-index.mjs 生成：所有模组的 id、版本、来源、签名摘要
tools/                   签名、校验、生成索引、生成密钥的脚本（只依赖 Node 20+，无第三方依赖）
test/                    签名格式的测试向量，以及对整个仓库的校验
```

`official` 和 `community` 的模组用同一把密钥签名，在应用里都显示为「官方认证」；目录只记录来源，写进 `index.json`。

## 常用命令

```sh
npm run verify                    # 按 Folia 的规则校验所有模组的签名
npm run verify -- --strict        # 未签名的模组也算失败（main 分支用）
npm run verify -- --list mods/official/visualizer52hz   # 列出签名覆盖的文件（sha256sum 格式）
npm run sign -- --key ~/.config/folium-signing/folium-2026-1.key.json mods/community/<id>
npm run sign -- --key <key file> --all                 # 全部重新签名
npm run index                     # 重新生成 index.json
npm test                          # 测试向量 + 仓库校验
```

## 收录第三方模组

1. 作者提交 PR，把模组放进 `mods/community/<mod-id>/`，不带签名。CI 只跑非严格校验，未签名不算失败。
2. 维护者审查。至少确认：
   - `mod.json` 是 Folium 1 清单，`id` 全局唯一，版本号合理；
   - 通读 `main` 与 `client` 的全部代码，以及它们能 import 或加载的一切文件（包括 `vendor/` 里的第三方库，
     核对来源与许可证）；
   - 声明的 `permissions`、`embedOrigins`、`experimental` 与实际用途相符，没有多余的权限；
   - 不上传用户数据、不下载并执行远程代码、不读写模组目录与数据目录以外的文件（除非这正是它声明的功能）；
   - 用 `npm run verify -- --list <dir>` 看一遍签名将覆盖的文件，确认没有夹带审查范围外的东西。
3. 审查通过后，维护者在本地签名、更新索引并提交：
   ```sh
   npm run sign -- --key <key file> mods/community/<mod-id>
   npm run index
   npm test
   ```
4. 模组之后的任何改动（包括只改版本号）都要重新审查、重新签名。

## 签名规则

签名覆盖模组目录下的所有普通文件，**除了**根目录的 `folium.sig.json`，以及任意位置的 `.DS_Store`、`Thumbs.db`、
`desktop.ini`。每个文件一行 `<文件的 sha256> <相对路径>`（路径以 `/` 分隔、NFC 规范化、按码元顺序排序），整份清单
的 sha256 就是签名摘要。被签名的消息是固定格式的几行文本，包含格式版本、模组 id、版本号、签名摘要、密钥 id 与签名时间。
目录里有符号链接或特殊文件时拒绝签名。

实现在 `tools/lib/signing.mjs`，与 Folia 的 `electron/modSystem/modSignature.cjs` 必须逐字节一致；两边的测试钉住同一组
测试向量（`test/signing.test.mjs`）。改算法时两边一起改，并提升格式版本号。

仓库的 `.gitattributes` 关闭了所有换行符转换：签名针对的是确切的字节，Windows 上检出时把 LF 换成 CRLF 会让所有签名失效。
不要删掉它。

## 密钥

- 私钥**永远不进仓库**（`.gitignore` 已排除 `*.key.json`）。当前私钥在维护者本机的 `~/.config/folium-signing/`，
  权限 600。要在 CI 里签名，把私钥文件内容放进 secret，以 `FOLIUM_SIGNING_KEY_JSON` 传给 `tools/sign.mjs`。
- 公钥同时写在这里的 `keys/trusted-keys.json` 和 Folia 的 `electron/modSystem/trustedKeys.cjs`。宿主没有联网查询，
  新密钥、吊销、撤回都要随 Folia 新版本发布才生效。
- **轮换**：`npm run keygen -- --key-id folium-<年>-<序号>` 生成新密钥 → 把公钥加进两处列表并发布 Folia → 用新密钥
  重新签名全部模组 → 把旧密钥标为 `"revoked": true`（两处都改）。用已吊销密钥做的签名在应用里显示为签名不匹配。
- **泄露**：立即把该密钥标为吊销并发布 Folia，再用新密钥重签。
- **撤回某个模组版本**：把它的签名摘要（`index.json` 里的 `digest`）加进 `keys/revoked-mods.json` 和 Folia 的
  `REVOKED_MOD_DIGESTS`。

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
site/assets/             模组市场页面的样式、脚本和图标（页面由 tools/site/ 在构建时生成）
tools/                   签名、校验、生成索引、生成密钥的脚本（只依赖 Node 20+，无第三方依赖）
test/                    签名格式的测试向量、CI 规则、站点构建，以及对整个仓库的校验
community.json           社区模组的 owner 与来源（源码仓库、目录、commit）
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
npm run site                      # 生成模组市场站点到 dist/
npm test                          # 测试向量、CI 规则、站点构建 + 仓库校验
```

## 收录第三方模组

作者不需要 fork 本仓库，只需要把模组放在自己的公开源码仓库里（GitHub、GitLab、Codeberg 等任意 https 仓库）。
整个流程由 CI 驱动，维护者只做审查和一条评论。

**作者提交新模组**

1. 在自己的仓库里准备好模组（可以在仓库根目录，也可以在某个子目录），打一个 tag（推荐）。模组必须带一张介绍图片：
   在 `mod.json` 里写 `"preview": "preview.jpg"`，指向模组目录里的 PNG / JPG / WebP，推荐 1280×720（接近 16:9，
   至少 640×360，不超过 1 MB），它会显示在模组市场的卡片顶部，也随模组一起签名。
2. 按「模组提交」模板开 issue：模组 id、源码仓库地址、版本（tag / 分支 / 完整 commit）、模组目录、权限说明、许可证。
3. CI（`submission-check.yml`）把版本解析成具体的 commit，只取回这一个提交，按导入规则整理出模组目录并检查
   （清单按 Folia 的规则校验、id 与目录一致、入口文件存在、介绍图片的格式 / 尺寸 / 比例 / 体积、不含符号链接和签名文件、
   体积上限），然后在 issue 里回复：
   - 通过：「格式检查通过，请等待维护者审查」，附源码链接、将要签名的完整文件清单（`sha256 路径`）和签名摘要，
     加标签 `awaiting-review`；
   - 未通过：列出问题，加标签 `needs-changes`。作者修改后编辑 issue（例如换成新 tag），会自动重新检查。

   以 `.` 开头的文件和目录（`.git`、`.github`、编辑器配置等）和 `node_modules` 不会被收录，其余文件原样收录。

**维护者审查并签名**

4. 打开检查结果里的源码链接，审查**那个 commit** 的模组目录。至少确认：
   - 通读 `main` 与 `client` 的全部代码，以及它们能 import 或加载的所有文件（包括 `vendor/` 里的第三方库，
     核对来源与许可证）；
   - 声明的 `permissions`、`embedOrigins`、`experimental` 与 issue 里的说明、与实际用途相符；
   - 不上传用户数据，不下载并执行远程代码，不读写模组目录和数据目录以外的文件（除非这正是它声明的功能）。
5. 在 issue 里评论 **`/sign <审查过的提交>`**（至少 7 位，检查结果里给出了这条命令）。CI（`sign.yml`）会：
   - 确认评论者有 write 及以上权限，并重新解析版本：tag 被移动过、或 issue 改成了别的版本，都会拒绝；
   - 重新取回同一个 commit、重跑检查，把整理好的文件复制进 `mods/community/<模组 id>/`，用 CI 密钥签名，
     把作者登记为 owner 并记录来源（`community.json`：仓库、目录、commit、版本），重建 `index.json`，
     跑全仓库校验和测试，然后**一次**推送到 main（提交带 `Co-authored-by` 署名作者）；
   - 在 issue 里回复结果并关闭 issue。任何一步失败都会说明原因，main 不会有任何改动。

   签名绑定的是 commit，不是 tag：审查之后作者再移动 tag，签下的仍然是审查过的内容，或者直接被拒绝。
   本仓库保存的是审查过的那份文件副本，站点与签名都以它为准，不受作者仓库之后变化的影响。

**后续更新**

6. 作者发布新版本（新 tag，`mod.json` 的版本号必须提升）后，按「模组更新」模板开 issue，只需填模组 id 和版本。
   源码仓库和目录沿用登记的那一个；只有登记的 owner（或仓库维护者）的更新会被接受。
7. CI 同样检查并回复，附上与上一个签名版本的**对比链接**。维护者审查差异后评论 `/sign <commit>`，新版本替换旧版本
   （上游删掉的文件这里也会删掉），签名后发布。

更换源码仓库或目录、增减 owner：维护者直接修改 `community.json` 并推送。

`resign.yml` 在每次推送 main 时运行：维护者直接在 main 上改动的模组（包括官方模组）会被自动续签，
密钥轮换后旧签名也会被自动换新；它同时是 main 分支的严格校验。被撤回的模组（`keys/revoked-mods.json`）永远不会被重新签名。

社区模组不通过 PR 提交；本仓库的 PR 只用于工具、流程和官方模组本身的改动。

**安全边界**：第三方代码从不被执行，也从不出现在持有密钥之外的权限里。作者仓库只在检查和签名时被浅取回一个提交
（不运行 hook、不取子模块和 LFS），文件只被读取、哈希和复制；所有脚本都来自本仓库的 main。签名密钥只存在于
GitHub 的 `signing` 环境里，只有 `sign.yml` 的签名任务（通过授权检查之后）和 `resign.yml` 能读到，且环境只允许
main 分支使用。

## 模组市场站点

`vercel.json` 把本仓库部署成模组市场页面，供人下载 zip 打包的模组。每次推送 main（包括 CI 的签名与续签推送）都会重新部署。

- `node tools/site/build.mjs`（`npm run site`）生成 `dist/`：
  - `index.html`：构建时渲染的页面，含搜索、官方 / 社区筛选、中英切换，每个模组显示介绍图片、权限、签名信息与 zip 的 SHA-256；
  - `previews/<id>-<版本>.<扩展名>`：每个模组的介绍图片（`mod.json` 的 `preview`），仓库里的每个模组都必须有；
  - `downloads/<id>-<版本>.zip`：顶层一个 `<id>/` 文件夹（Folia 安装器要求的结构），模组文件与签名原样打包，
    拖进 Folia 的模组面板即可安装，安装后显示为「官方认证」；
  - `catalog.json`：机器可读的目录（下载地址、大小、SHA-256、权限、签名），允许跨域读取。
- zip 是确定性的：同样的内容总是同样的字节。发布前每个 zip 都会被解压并重新校验签名。
- 只发布完全通过校验的仓库：`should-build.mjs` 作为 Vercel 的 ignore 步骤，在仓库里有签名失效的模组时跳过部署，
  线上保留上一个版本，等 CI 续签后的提交再部署；构建本身也会拒绝发布任何未通过校验的模组。
- 第三方文本在构建时全部转义，源码链接只接受 https；CSP 禁止内联脚本与样式，不加载任何外部资源。
- 本地预览：`npm run site`，然后用任意静态服务器打开 `dist/`。

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

受信任的公钥写在这里的 `keys/trusted-keys.json` 和 Folia 的 `electron/modSystem/trustedKeys.cjs`，两处必须一致。
宿主没有联网查询，新密钥、吊销、撤回都要随 Folia 新版本发布才生效。

| 密钥 | 保管 | 用途 |
| --- | --- | --- |
| `folium-2026-1`（Folium official） | 维护者本机 `~/.config/folium-signing/`，权限 600，不进任何仓库 | 手动签名、应急 |
| `folium-ci-2026-1`（Folium CI） | GitHub 环境 `signing` 的 secret `FOLIUM_SIGNING_KEY_JSON` | `sign.yml` 与 `resign.yml` 自动签名 |

- 私钥**永远不进仓库**（`.gitignore` 已排除 `*.key.json`）。
- **轮换**：`npm run keygen -- --key-id folium-<用途>-<年>-<序号>` 生成新密钥 → 把公钥加进两处列表并发布 Folia →
  换掉 secret（`gh secret set FOLIUM_SIGNING_KEY_JSON --env signing < 新密钥文件`）→ 把旧密钥标为 `"revoked": true`
  （两处都改）。推送后 `resign.yml` 会用新密钥重签所有旧密钥签过的模组。
- **CI 密钥泄露**：立即在两处把它标为吊销、发布 Folia，并按上面的步骤换新密钥。官方密钥不受影响。
- **撤回某个模组版本**：把它的签名摘要（`index.json` 里的 `digest`）加进 `keys/revoked-mods.json` 和 Folia 的
  `REVOKED_MOD_DIGESTS`，并从仓库里删除或替换这个版本。

## GitHub 配置

- 环境 `signing`：部署分支只允许 `main`；secret `FOLIUM_SIGNING_KEY_JSON` 为 CI 密钥文件的内容。
- 标签：`mod-submission`、`mod-update`（issue 模板自动添加）、`awaiting-review`、`needs-changes`、`signed`。
- 如果以后给 main 加分支保护，需要允许 GitHub Actions 推送（`sign.yml` 与 `resign.yml` 直接推送 main）。

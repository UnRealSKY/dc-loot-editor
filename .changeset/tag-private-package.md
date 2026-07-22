---
"dc-loot-editor": patch
---

修正發版不產生 git tag 的問題：private 套件在 changeset 預設下不被打 tag，
於 config.json 設 `privatePackages: { version: true, tag: true }`；並將
`changeset tag` 移到 `# Version` commit 之後，使版本 tag 指向 package.json
已是新版號的 commit。

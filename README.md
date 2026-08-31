# muticode

> **Electron 桌面应用：把多个 Claude Code / Codex 终端并排放在可调宽度的列里，实时显示每个 agent 的状态。**

## 项目定位 / 背景

`muticode` 解决一个具体问题——同时跑多个 AI 编程 agent 时，开 N 个终端窗口来回切很痛。它用 **Electron 43** + **React 19** + **xterm.js 6** + **react-resizable-panels** + **zustand 5** 实现一个桌面端"多列终端"：每列跑一个本地 shell，并在 shell 里 type 启动命令（默认 `claude` 或 `codex`），下面的状态徽章会根据 PTY 输出自动从 `starting → busy → waiting → idle → done/error` 切换。

`electron-vite ^5` 负责主进程 / preload / renderer 三段构建，`@xterm/xterm` + `node-pty ^1.1.0` 跑真实 PTY（不是伪终端模拟），所以别名、PATH、交互式 prompt 都能用。每列宽用 `react-resizable-panels` 拖拽，布局和 agent 列表都持久化在 `userData/muticode.json` 里（`Store` 抽象，JSON 读写）。

应用退出时弹同步确认对话框——"确定退出 muticode 吗？所有终端会话及其中运行的任务都会被终止。"——避免按错 ⌘Q 杀掉所有正在跑的 agent。

## 仓库结构

```
muticode/
├── package.json                # muticode v0.1.0 (MIT)
├── electron.vite.config.ts     # 三段构建：main / preload / renderer
├── electron-builder.yml        # mac arm64 打包配置
├── tsconfig.{json,node,web}.json
├── scripts/
│   ├── .status-detector.cjs    # 状态识别器构建产物
│   ├── .status-detector.mjs
│   ├── smoke.cjs / .mjs        # 烟测
├── src/
│   ├── main/                   # Electron 主进程
│   │   ├── index.ts            # BrowserWindow + 关闭确认 + will-quit 释放 PTY
│   │   ├── ipc.ts              # registerIpc：把 IPC 通道接到 store + manager
│   │   ├── pty-manager.ts      # 多 PTY 生命周期 + backlog
│   │   ├── status-detector.ts  # 正则匹配 TUI 状态行
│   │   └── store.ts            # JSON 持久化（userData/muticode.json）
│   ├── preload/
│   │   └── index.ts            # contextBridge 暴露 MutiApi
│   ├── renderer/               # React 19 UI
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── global.d.ts
│   │       ├── styles.css
│   │       ├── state/
│   │       │   ├── agents.ts   # zustand store
│   │       │   └── grid.ts     # 面板布局
│   │       └── components/
│   │           ├── AddAgentDialog.tsx
│   │           ├── Column.tsx
│   │           ├── ConfirmDialog.tsx
│   │           ├── StatusBadge.tsx
│   │           ├── TerminalView.tsx
│   │           └── Toolbar.tsx
│   └── shared/
│       └── types.ts            # Agent / AgentStatus / AgentKind / DEFAULT_COMMAND / MutiApi / IPC
```

## 技术栈

| 类别 | 选型 | 版本 |
| --- | --- | --- |
| 桌面壳 | Electron | 43.1.1 |
| 构建 | electron-vite | 5.0.0 |
| 打包 | electron-builder | 26.15.3 |
| 原生重建 | @electron/rebuild | 4.2.0 |
| UI 框架 | React / react-dom | 19.2.0 |
| 终端 | @xterm/xterm、@xterm/addon-fit、@xterm/addon-web-links | 6.0.0 / 0.11.0 / 0.12.0 |
| PTY | node-pty | 1.1.0 |
| 面板 | react-resizable-panels | 4.12.2 |
| 状态 | zustand | 5.0.0 |
| 类型 | TypeScript | 5.9.3 |
| 测试 | smoke.cjs / smoke.mjs（手测脚本，无 jest） | — |
| 跨端类型 | @types/react、@types/react-dom、@types/node | 19.2.0 / 19.2.0 / 22.10.0 |
| Vite | vite + @vitejs/plugin-react | 7.3.6 / 5.2.0 |

## 核心模块 / 特性

- **`PtyManager`**（`src/main/pty-manager.ts`）：核心类。`spawn(agent)` 用 `node-pty` 起一个 `xterm-256color` 的 login shell（macOS 取 `$SHELL`，Windows 用 `powershell.exe`），`cwd = agent.cwd`，`env` 注入 `TERM`。`proc.write(agent.command + '\r')` 把启动命令 type 进 shell——故意走"真实 TTY 路径"，让别名 / PATH / 函数 / rc 文件都生效。`proc.onData` 触发后：把新数据追加到 `backlog`（环形封顶 256 KB，方便新挂载的终端重画），通过 IPC `pty:data:<id>` 推给 renderer；并喂给 `StatusTracker` 更新状态。`proc.onExit` 走 `tracker.markExit(exitCode)`，清掉轮询定时器。500ms 轮询一次 `tracker.evaluate()`，把"沉默→等待"和"busy→idle"做衰减。
- **`StatusTracker`**（`src/main/status-detector.ts`）：根据 `patternsForKind(kind)` 拿到的正则匹配最近一段输出，把 TUI 的状态行解析成 `AgentStatus`（`starting/busy/waiting/idle/done/error`）。`markExit` 把 `done` 与 `error` 区分开（exit code 0 = done，非 0 = error）。
- **`Store`**（`src/main/store.ts`）：把 `PersistedState = { agents: Agent[], columnLayout: Record<id, percent> }` 落到 `userData/muticode.json`，启动时 `load()`，变更时回写。`getAgents()` 供主进程在 `ready-to-show` 时 `manager.restore(agent)` 重连。
- **`VDSEngine` 风格的主进程**（`src/main/index.ts`）：`BrowserWindow` 1600×900 起步、隐藏标题栏、contextIsolation+sandbox 设置；`webContents.setWindowOpenHandler` 一律 `shell.openExternal`；`close` 事件用 `dialog.showMessageBoxSync` 做退出确认（**只对有 agent 的情况弹**）；`will-quit` / `window-all-closed` 都会调 `manager.disposeAll()`，幂等。
- **IPC 协议**（`src/shared/types.ts`）：`MutiApi` 用 interface 描述 renderer → main 的全部能力（`listAgents / createAgent / removeAgent / restartAgent / writeToAgent / resizeAgent / pickDirectory / getBacklog / getColumnLayout / saveColumnLayout / onData / onStatus / onAgentExit`）。`IPC` 常量集中所有 channel 名，前缀 `pty:data:` 用于按 agent id 动态拼 channel。
- **Preload 桥**：`contextBridge` 把 `MutiApi` 注入到 `window.muti`，renderer 端 TypeScript 拿到完整类型。
- **Renderer**：`react-resizable-panels` 把窗口横切成 N 列；每列一个 `TerminalView`（xterm.js）+ `StatusBadge`。`agents.ts` 用 zustand 维护 agent 列表与布局；`AddAgentDialog` 选目录 + 选 kind（claude / codex）；`ConfirmDialog` 处理删除/重启二次确认。
- **状态判定**：`patternsForKind` 为 `claude` / `codex` 各准备一套正则（识别 "esc to interrupt"、"Press enter to send"、"..." 等），`StatusTracker` 用滑动窗口匹配。

## 已完成 / 进行中

- ✅ Electron + electron-vite 三段构建
- ✅ node-pty 真实 PTY，多 agent 并发
- ✅ zustand + react-resizable-panels 多列布局
- ✅ xterm.js + backlog 重连重画
- ✅ Claude / Codex 状态识别 + 实时徽章
- ✅ JSON 持久化（agent 列表 + 列宽）
- ✅ 退出确认 + will-quit 释放 PTY
- ⏳ Windows 上 ConPTY 兼容性打磨
- ⏳ 全局快捷键、托盘图标
- ⏳ 单元测试（仅有 `smoke.cjs`）

## 本地开发

```bash
# 一次性安装 + 重建 node-pty 原生模块
npm install         # postinstall 会自动 electron-rebuild node-pty

# 跑 dev 模式（Vite HMR + Electron）
npm run dev         # 用 env -u ELECTRON_RUN_AS_NODE 启 electron-vite

# 类型检查（主进程 + 渲染进程分别 tsc）
npm run typecheck

# 打 mac arm64 包
npm run package     # electron-vite build && electron-builder --mac --arm64
```

## 状态

v0.1.0，**多 agent 并排监控可用**，支持 Claude Code 与 Codex 两种 TUI；下一步重点是 Windows 兼容 + 全局快捷键。

## License

MIT。

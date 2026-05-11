## 背景

M5 的 `_evaluate_qa_result` 在 QA 失败时将 parent 设为 `blocked` + 添加 comment。M3 的 `claim_task_with_binding` 总是创建新 worktree（`create_worktree=True`）。M4 的执行策略路由只在 execute 调用时触发，不自动。现有 dispatcher（`kb.dispatch_once`）是按需调用的，无持久循环。`last_heartbeat_at` 和 `claim_expires` 字段已存在于任务模型中但未被主动监控。

## 目标 / 非目标

**目标：**
- QA 失败 + retries < max → parent task 自动回 `ready` 而非 `blocked`
- retry 计数存储在 `result` JSON（`qa_retries` 键）
- max retries 后升级为 blocked + clarify
- `ExecutionScheduler` 持久后台线程：周期扫描 ready 任务 → dispatch
- Worker pool 限制并发（`max_concurrent` 配置，默认 4）
- 超时执行器检查 `max_runtime_seconds` + `claim_expires`
- `/api/execution/status` 返回实时监控数据
- 修复 M4 Playwright SSE mock（3 个 failing tests）

**非目标：**
- 分布式多节点调度（单进程内调度，足够本地/单服务器场景）
- 外部消息队列（Redis/RabbitMQ）
- Agent 代码自动生成修复方案（coder agent 自行决定如何修复）

## 设计决策

### D1：QA retry 逻辑在 `_evaluate_qa_result` 中实现

**原因：** `_evaluate_qa_result` 已是 QA 失败的唯一处理点。在此函数内检查 retry 计数并决定 `blocked` vs `ready` 是最小改动。`qa_retries` 存储在 parent 任务的 `result` JSON 中（与 `qa_task_id` 同级）。

### D2：重试 claim 复用 worktree 通过 `create_worktree=False`

**原因：** 任务已有 `workspace_path`。dispatcher 在 re-claim 时检测 `workspace_path` 已存在则跳过 worktree 创建（M4 的 execute 已实现 `create_worktree=False` 路径）。无需额外机制。

### D3：ExecutionScheduler 作为后台守护线程，在 server.py 启动

**原因：** Hermes WebUI 是长运行进程。在 `server.py` 启动后开一个 daemon thread 定时调用 `dispatch_once` + 健康检查，比 cron 更可靠（不依赖外部调度器）。通过 `config.yaml execution.enabled` 开关控制。

### D4：Worker pool = Hermes Agent subprocess（统一运行时，不引入 SDK）

**原因：** Hermes Agent 已使用相同的 custom Claude 模型（`bedrock-claude-4-6-opus-1m` via LiteLLM proxy），拥有完整的工具系统（terminal、file、web、85 skills）、memory 管理、SOUL.md 人设、conversation compression。引入 Claude Code SDK 会重复实现这些能力，且需要重新对接 WebUI 的 session/SSE/streaming 基础设施。

**统一运行时策略：** planning 和 execution 都使用 hermes-agent subprocess，通过 profile 区分行为：
- `planner` profile：SOUL.md 指导生成 plan/proposal，skill 注入 `opsx:propose_v2`
- `coder` profile：SOUL.md 指导编码，skill 注入 `code-review`、`simplify`
- `qa` profile：SOUL.md 指导测试执行，skill 注入 `feature-validate-qa`

**Worker pool** 只需计数当前 `running` 状态任务数 < `max_concurrent` 即可。不需要预分配进程——每次 dispatch 就是一次 subprocess spawn。

### D5：2 个人工确认门控（Plan Approval + Release Gate）

**原因：** 在 plan 确认和 merge 确认之间，agent 完全自主执行（code → test → QA loop 最多 3 次），无中途人工确认。这最大化了自动化效率，同时保留了两个关键审计点：
- **Gate 1（Plan Approval）**：medium/large 任务在执行前需人工确认方向正确
- **Gate 2（Release Gate）**：代码变更合并主分支前需人工确认质量达标

Small 任务跳过 Gate 1（直接执行），但仍经过 Gate 2（merge 审批）。

### D6：Playwright SSE mock 修复使用 `page.evaluate` 注入

**原因：** SSE stream mock 在 Playwright 中不稳定（连接/断开时序问题）。直接调用 `showClarifyCard({kind:"plan",...})` 绕过 SSE，测试 UI 渲染逻辑。这是最可靠的方案。

## 风险 / 权衡

- **[无限循环]** → 缓解：`max_qa_retries`（默认 3）硬限制 + 每次重试递增计数 + 达上限后 `blocked`
- **[Scheduler 线程卡死]** → 缓解：独立 daemon thread，`try/except` 包裹每次循环，异常记录日志但不退出
- **[并发 dispatch 竞争]** → 缓解：`kb.claim_task` 已有 `claim_lock` CAS 保护，并发 dispatch 不会重复认领
- **[超时 kill 丢失进度]** → 缓解：kill 前将 task 设为 `blocked` 并记录 "timeout exceeded" comment
- **[Playwright evaluate 绕过真实流程]** → 缓解：backend 逻辑已由 pytest 覆盖；E2E 仅验证 UI 渲染

## 迁移计划

- 纯增量：新增 `api/execution.py` 模块 + `/api/execution/status` 端点
- `config.yaml` 新增 `execution:` 段（默认 `enabled: false`）
- QA retry 逻辑修改 `_evaluate_qa_result` 内部分支
- Playwright 修复不影响 backend
- 部署：拉取分支，重启服务端；默认 scheduler 未启用，需在 config 中 `execution.enabled: true`
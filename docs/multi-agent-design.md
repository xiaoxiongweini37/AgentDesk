# 多智能体系统设计参考：从 Mavis Team 反推架构

> 这份文档不是教程，是**设计拆解 + 实现模式合集**。  
> 你拿它去造自己的多智能体系统时，挑你用得上的部分落地就行。

---

## 目录

1. [核心设计哲学](#1-核心设计哲学)
2. [角色拆分原则](#2-角色拆分原则)
3. [会话模型：Root vs Branch](#3-会话模型root-vs-branch)
4. [工作流：Cycle 制 + 显式决策](#4-工作流cycle-制--显式决策)
5. [成本与边界控制](#5-成本与边界控制)
6. [失败处理与人工介入点](#6-失败处理与人工介入点)
7. [跨会话通信：Scratchpad 模式](#7-跨会话通信scratchpad-模式)
8. [配置文件：Plan YAML 模板](#8-配置文件plan-yaml-模板)
9. [实现要点速查](#9-实现要点速查)
10. [常见反模式](#10-常见反模式)

---

## 1. 核心设计哲学

### 1.1 一句话定位

> **一个长存的 Owner + 多个短命的 Workers + 对抗验证 + 循环决策。**

不是一个"超级智能体 + 工具"，也不是"一堆平等的 agent 互相聊"。
是**层级化 + 流程化**的系统，模拟一个小型工程团队。

### 1.2 三个不可妥协的原则

| 原则 | 反面 | 为什么必须坚持 |
|------|------|----------------|
| **职责分离** | 一个 agent 又写又审 | 自我审查 = 没有审查 |
| **决策权在 Owner** | 让 Verifier 拍板 | 程序不能决定产品走向 |
| **流程显式** | agent 之间自由聊天 | 隐式流程 = 不可控、不可调试 |

### 1.3 与常见架构的对比

| 架构 | 特点 | 痛点 |
|------|------|------|
| **Monolithic Agent** | 一个大模型干所有事 | 上下文爆炸，质量随任务复杂度下降 |
| **Multi-Agent Chat** | 平等 agent 自由对话 | 容易跑偏，token 浪费，结论难追溯 |
| **Hierarchical + Workflow** ✅ | Owner 调度 + 显式流程 | 启动成本高，但可控可验证 |
| **Swarm** | 群体智能、去中心化 | 适合搜索/优化，不适合交付物生产 |

---

## 2. 角色拆分原则

### 2.1 最小可用角色集

```text
Owner (1)     — 长存、决策、跟用户对齐
Producer (1-N) — 写代码 / 写文档 / 做研究
Verifier (0-N) — 独立验证，不重做工作
```

**General 角色**：当任务没有专业 agent 时兜底。它不是"啥都会"的超人，而是**调度系统的安全网**——"找不到专家就让我先顶上，但别让 General 干专家活儿"。

### 2.2 命名原则：按**职责**，不按**职级**

| ❌ 别这样 | ✅ 应该这样 |
|----------|------------|
| `senior-dev` | `payments-expert` |
| `junior-tester` | `migration-verifier` |
| `helper-1` | `security-reviewer` |

理由：决策可追溯——"这个结论谁给的"必须一眼能看出来。

### 2.3 每个角色的**Stop Condition**

每个角色必须有一个**可验证的完成条件**。

| ✅ 好 | ❌ 差 |
|-----|-----|
| "tests pass, MR opened" | "user is happy" |
| "deliverable.md 包含 X 章节" | "感觉差不多" |
| "代码覆盖率 ≥ 80%" | "写得不错" |

Stop condition 是**Owner 判断 worker 是否干完**的唯一标准。

---

## 3. 会话模型：Root vs Branch

### 3.1 为什么要分 Root 和 Branch？

| 会话类型 | 生命周期 | 上下文 | 角色 |
|---------|---------|--------|------|
| **Root** | 长存（跟用户生命周期一致） | 累积用户历史 | Owner |
| **Branch** | 短命（一个任务一个） | 干净独立 | Worker |

**关键不变量**：
- 只有 Root 持有用户级记忆
- Branch 之间**不直接通信**，必须经 Root 中转
- Branch 退出后上下文**全部丢失**（除非显式落盘到 scratchpad）

### 3.2 实现模式

```python
# 伪代码：会话树
class SessionTree:
    root: Session           # 长存
    branches: dict[str, Session]  # 临时

def spawn_branch(parent: Session, agent_name: str, task: Task) -> Session:
    """从 root 派生一个 branch session，注入任务 prompt"""
    branch = Session(
        parent_id=parent.id,
        agent_name=agent_name,
        system_prompt=load_agent(agent_name).system_prompt,
        context_overlay=task.prompt,  # 把任务当 first user message 注入
    )
    branch.run()  # 异步跑
    return branch
```

### 3.3 Branch 注入任务的两种方式

| 方式 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **Prompt 注入** | 任务自包含、worker 自主 | 简单 | 无法中途改方向 |
| **Steer 注入** | 长任务需要中途调整 | 灵活 | 实现复杂 |

推荐：**第一次 prompt 注入 + 必要时 steer**。

---

## 4. 工作流：Cycle 制 + 显式决策

### 4.1 Cycle 的定义

```
Cycle N:
  1. Producer 执行任务 → 产出 deliverable
  2. Verifier 独立验证 → PASS / FAIL + 报告
  3. Owner 收到 CycleReport → 做决策
  4. 决策结果决定下一轮
```

### 4.2 四种 Verdict

```yaml
verdicts:
  accept:
    含义: 收工
    触发: Verifier PASS + Owner 同意
    
  reject:
    含义: 小修（小问题、命名、格式）
    操作: 同 session 重做
    
  manual_retry:
    含义: 方向对，活儿糙
    操作: 同 session 重新执行，附 reason
    
  override_accept:
    含义: Verifier FAIL 但 Owner 判断没那么严重
    操作: 强收，记录 reason
```

**Verdict 选择流程**：

```text
                    ┌─ 同意 → accept
                    │
Verifier PASS ─────┤
                    │
                    └─ 不同意 → manual_retry（怎么改）

                    ┌─ 有道理 → reject / manual_retry
                    │
Verifier FAIL ─────┤
                    │
                    └─ 吹毛求疵 → override_accept
```

### 4.3 决策的最小数据契约

```typescript
type Decision = {
  last_cycle: Array<{
    task_id: string;
    verdict: "accept" | "reject" | "manual_retry" | "override_accept";
    reason: string;  // 给 worker 看的反馈
  }>;
  next_cycle: Array<TaskSpec>;  // 这一轮要跑什么
  plan_complete: boolean;       // 整个 plan 是否结束
  message_to_user?: string;     // 透传给用户的话
};
```

**Owner 决策的关键约束**：
- 决策**必须显式**，不能超时自动 accept
- reason 字段是给 worker 看的，**要具体到能改**
- 不要在一次 decision 里同时 retry 旧任务 + 加新任务

---

## 5. 成本与边界控制

### 5.1 路由原则

```text
                    用户问进来
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    简单对话         中等任务           复杂任务
    (秒级)          (分钟级)          (数十分钟)
        │                │                │
        ▼                ▼                ▼
   Owner 直接答     1 个 Worker      Producer
                                     + Verifier
                                     + 多轮 cycle
```

**Owner 的判断启发式**：
- 用户问"什么是 X" → 直接答
- 用户问"帮我改 X" → 1 个 Coder
- 用户问"调研 X 领域给我一个报告" → Researcher + Verifier
- 用户问"做 X，要可靠" → 多 cycle，强制 Verifier

### 5.2 超时控制

| 资源 | 上限 | 原因 |
|------|------|------|
| 单个 Worker 任务 | 30 分钟 | 逼着拆任务，30 分钟是复杂任务的合理上限 |
| 单次超时延长 | +15 分钟/次 | 避免无限拖延 |
| 同一 plan 总轮数 | 不设硬上限 | 但 Owner 自觉，太长该 cancel |

**为什么是 30 分钟？**
- LLM 长任务质量会下降
- 用户等太久会离开
- 逼着 Owner 拆细 → 任务可并行 → 速度提升

### 5.3 任务拆分的 Granularity

```yaml
# 反例：一个大任务
- title: "做整个电商系统"
  prompt: "..."
  
# 正例：拆成可独立验证的子任务
- title: "设计数据模型"
  verified_by: verifier
  verify_prompt: "检查 schema 是否覆盖所有需求点"
  
- title: "实现 API 层"
  depends_on: ["task-1"]
  verified_by: verifier
  
- title: "写单元测试"
  depends_on: ["task-2"]
```

---

## 6. 失败处理与人工介入点

### 6.1 Owner 的 6 个干预动作

| 动作 | 触发场景 | 工具调用 |
|------|---------|---------|
| **steer** | 方向错了，立刻改 | `team.steer(plan_id, message)` |
| **extend-timeout** | Worker 接近超时 | `team.extend-timeout(task_id, +15min)` |
| **unblock** | 依赖图配错 | `team.unblock(task_id)` |
| **cancel** | 救不回来了 | `team.cancel(plan_id)` |
| **decision** | 任何 cycle 结束 | `team.decision(verdict)` |
| **take over** | Owner 自己上 | 取消 plan，亲自干 |

### 6.2 决策树

```text
Worker 卡住 >5 分钟？
  ├─ 是 → 看是"等外部"还是"真卡了"
  │        ├─ 等外部 → 强令 worker 立即退出，Owner 等
  │        └─ 真卡了 → steer 给方向 / cancel 重来
  │
  └─ 否 → 继续观察

Worker 接近 30 分钟？
  ├─ 是 → extend-timeout（一次）
  └─ 否 → 不动

Verifier FAIL？
  ├─ 结论可靠 → reject / manual_retry
  └─ 结论夸张 → override_accept
```

### 6.3 禁止 Worker 做的事

| 行为 | 原因 |
|------|------|
| 轮询 CI / 外部系统 | 浪费 30 分钟预算 |
| 等用户回复 | 阻塞整个 plan |
| 自己决定 plan 完成 | 越权 |
| 跨 session 直接 communicate | 破坏流程 |

---

## 7. 跨会话通信：Scratchpad 模式

### 7.1 为什么需要 Scratchpad？

- Branch session 退出后上下文**全丢**
- 多 cycle 之间需要**累积证据**
- Owner 决策时需要**全局视图**

### 7.2 Scratchpad 的最小实现

```python
# 共享文件路径：$MAVIS_SCRATCHPAD (环境变量)
import os
SCRATCHPAD = os.environ["MAVIS_SCRATCHPAD"]

def write_scratchpad(section: str, content: str):
    """追加写入，带分隔符"""
    with open(SCRATCHPAD, "a") as f:
        f.write(f"\n\n## {section}\n{content}\n")

def read_scratchpad() -> str:
    if os.path.exists(SCRATCHPAD):
        with open(SCRATCHPAD) as f:
            return f.read()
    return ""
```

### 7.3 典型用法

```text
Worker A 完成 → write_scratchpad("research-findings", "...")
                  ↓
Worker B 启动 → 读 scratchpad，拿到上下文
                  ↓
Verifier 启动 → 读 scratchpad + 独立验证
                  ↓
Owner 决策 → 读完整 scratchpad
```

**关键**：
- 写 scratchpad 是**主动动作**，不是自动的
- 每个 worker 写之前**先读**，避免覆盖
- 内容要**结构化**（markdown sections）

---

## 8. 配置文件：Plan YAML 模板

### 8.1 最小可用 Plan

```yaml
plan:
  name: "用户能看到的 plan 名"
  tasks:
    - task_id: "task-1"
      title: "短标题"
      assigned_to: "coder"           # 哪个 agent
      prompt: |
        任务详细描述。
        Worker 拿到这个 prompt 就该知道做什么。
      verified_by: "verifier"        # 谁验
      verify_prompt: |
        独立验证的具体步骤。
        不要只读 producer 的 diff，要重新跑命令。
      timeout_ms: 1800000             # 30 分钟
```

### 8.2 进阶：依赖 + 并行

```yaml
plan:
  name: "做研究报告"
  tasks:
    # 三路并行调研
    - task_id: "research-market"
      assigned_to: "general"
      title: "调研市场"
      prompt: "..."
      
    - task_id: "research-tech"
      assigned_to: "general"
      title: "调研技术"
      prompt: "..."
      
    - task_id: "research-competitors"
      assigned_to: "general"
      title: "调研竞品"
      prompt: "..."
      
    # 综合产出报告
    - task_id: "write-report"
      assigned_to: "general"
      title: "综合写报告"
      depends_on: ["research-market", "research-tech", "research-competitors"]
      prompt: |
        读 scratchpad 里三路调研结果，
        综合写一份报告。
      verified_by: "verifier"
      verify_prompt: |
        独立检查：报告是否覆盖三路调研的关键发现？
        引用是否准确？
```

### 8.3 验证的多角度写法

```yaml
# 单 verifier
verified_by: "verifier"
verify_prompt: "..."

# 多 verifier（都过才算 PASS）
verified_by:
  - "code-reviewer"
  - "tester"
verify_prompt:
  code-reviewer: "检查代码风格和架构..."
  tester: "跑测试，检查覆盖率..."
```

---

## 9. 实现要点速查

### 9.1 启动一个 Plan 的最小代码

```python
# 伪代码
def launch_plan(plan_yaml_path: str) -> str:
    """返回 plan_id"""
    plan = load_yaml(plan_yaml_path)
    plan_id = generate_id()
    
    # 给每个 ready 任务 spawn branch session
    for task in plan.tasks:
        if task.is_ready():
            session = spawn_branch(
                parent=root_session,
                agent_name=task.assigned_to,
                task=task,
            )
            schedule(task, session)
    
    return plan_id
```

### 9.2 监控 Cycle 完成

```python
async def watch_plan(plan_id: str):
    """每 5 分钟检查一次"""
    while not is_complete(plan_id):
        await asyncio.sleep(300)
        report = get_cycle_report(plan_id)
        if report:
            # 给 Owner 推送
            await notify_owner(report)
            # 等待 Owner 决策
            await wait_for_decision(plan_id)
```

### 9.3 Owner 决策循环

```python
async def owner_decision_loop(plan_id: str):
    while not is_complete(plan_id):
        report = wait_for_cycle_report(plan_id)
        
        # Owner 审阅
        decision = await owner_review(report)
        
        # 提交决策
        submit_decision(plan_id, decision)
        
        if decision.plan_complete:
            break
```

### 9.4 心跳机制

```python
# Owner 端：5 分钟一次心推向用户
async def heartbeat(plan_id: str):
    while True:
        status = get_status(plan_id)
        if status.stuck > 5 * 60:  # 5 分钟没进展
            await notify_user("Worker 卡住了，正在介入...")
        await asyncio.sleep(300)
```

---

## 10. 常见反模式

### 10.1 角色划分反模式

| 反模式 | 问题 | 修正 |
|--------|------|------|
| 一个 agent 干所有事 | 没有对抗验证 | 强制拆 Producer / Verifier |
| 角色按职级命名 | 不可追溯 | 按职责命名 |
| 角色没有 Stop Condition | Owner 不知道何时收 | 每个角色必须有可验证的完成条件 |

### 10.2 工作流反模式

| 反模式 | 问题 | 修正 |
|--------|------|------|
| Worker 之间直接聊天 | 流程失控 | 必须经 Owner 中转 |
| 决策时同时 retry + 新任务 | 执行顺序混乱 | 一次 decision 只做一类事 |
| 决策不写 reason | Worker 不知道怎么改 | reason 必须具体 |
| Verifier 自己拍板 | 越过 Owner | Verifier 只能 fail，Owner 决定 |

### 10.3 任务设计反模式

| 反模式 | 问题 | 修正 |
|--------|------|------|
| 一个 Worker 干 30 分钟的活 | 质量下降、无法并行 | 拆成可独立验证的子任务 |
| Worker 轮询外部系统 | 浪费预算 | 强令"produce and exit" |
| 任务之间循环依赖 | 死锁 | DAG，不允许环 |
| 验证 prompt 只读 producer 报告 | 没有独立验证 | 强制重新跑命令 / 回到原数据 |

### 10.4 沟通反模式

| 反模式 | 问题 | 修正 |
|--------|------|------|
| Owner 重复问用户"你确定吗" | 浪费用户时间 | 决策权在 Owner，重大问题才问 |
| Worker 频繁打扰用户 | 用户体验差 | 一切通过 Owner 转发 |
| 错误信息只给 worker 不给用户 | 用户失去掌控感 | 关键 milestone 同步给用户 |

---

## 附录 A：关键术语表

| 术语 | 含义 |
|------|------|
| **Root Session** | 长存、跟用户对齐的会话，是 Owner 的载体 |
| **Branch Session** | 短命、Worker 的载体，跑完即退 |
| **Owner** | Root 里的主 agent，负责决策 |
| **Worker** | Branch 里的 agent，负责执行 |
| **Producer** | 写东西的 Worker |
| **Verifier** | 挑刺的 Worker |
| **Cycle** | 一轮"执行 + 验证" |
| **CycleReport** | 一轮跑完后的总结报告 |
| **Verdict** | Owner 对 CycleReport 的决策（accept/reject/manual_retry/override_accept） |
| **Scratchpad** | 跨 session 共享的文件 |
| **Plan** | 一次多智能体协作的完整 YAML 配置 |
| **Steer** | Owner 中途给 Worker 改方向 |
| **Deliverable** | Worker 的最终产出物 |

---

## 附录 B：你落地时要决定的事

把这套搬到你自己的系统里，**这些决策点必须想清楚**：

1. **会话生命周期**：你的 agent 框架有没有"长存 vs 短命"的概念？
2. **跨 agent 通信**：是共享文件、消息队列、还是数据库？
3. **决策机制**：是 Owner agent 自动决策，还是真人审批？
4. **超时与取消**：你的 framework 是否支持 task-level timeout？
5. **可观测性**：cycle 状态、verifier 输出、worker 日志，存哪里？
6. **成本控制**：每轮 cycle 的 token 预算怎么算？
7. **失败恢复**：worker 崩溃后能从哪一步恢复？

---

## 附录 C：参考实现路径

如果你是从零开始：

```text
Phase 1: 单 Owner 单 Worker，跑通一次"任务派发 + 接收结果"
Phase 2: 加 Verifier 角色，实现 cycle 循环
Phase 3: 加多 Worker 并行
Phase 4: 加 steer / extend-timeout / unblock
Phase 5: 加可观测性 + 心跳
Phase 6: 加跨 session 状态管理
```

**别一上来就搞复杂**。Phase 1-2 已经能解决 80% 的"AI 输出不靠谱"问题。

---

**最后一句话**：多智能体系统的核心不是 agent 多，是**流程显式 + 决策点明确 + 验证独立**。把这三点做扎实，比堆 10 个 agent 强。

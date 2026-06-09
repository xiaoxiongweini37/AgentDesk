# AgentDesk 开发指南

## 开发环境搭建

### 1. 系统要求

- **操作系统**: Windows 10/11, macOS 10.15+, Linux
- **Node.js**: 18.0 或更高版本
- **Rust**: 最新稳定版
- **Git**: 2.30 或更高版本

### 2. 依赖安装

#### Windows

```bash
# 安装 Node.js
winget install OpenJS.NodeJS.LTS

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Visual Studio Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools

# 安装 Tauri CLI
cargo install tauri-cli
```

#### macOS

```bash
# 安装 Node.js
brew install node

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Xcode Command Line Tools
xcode-select --install

# 安装 Tauri CLI
cargo install tauri-cli
```

#### Linux (Ubuntu/Debian)

```bash
# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装系统依赖
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libappindicator3-dev librsvg2-dev patchelf

# 安装 Tauri CLI
cargo install tauri-cli
```

### 3. 项目克隆

```bash
# 克隆仓库
git clone https://github.com/xiaoxiongweini37/AgentDesk.git
cd AgentDesk

# 安装依赖
npm install
```

## 开发流程

### 1. 启动开发服务器

```bash
# 启动代理服务器（后台运行）
node proxy.cjs &

# 启动 Tauri 开发服务器
npm run tauri dev
```

开发服务器会：
- 启动前端开发服务器（Vite）
- 启动 Tauri 开发服务器
- 监听文件变化，自动刷新
- 打开桌面应用窗口

### 2. 代码修改

#### 前端代码

前端代码位于 `src/` 目录：

```
src/
├── components/          # React 组件
├── hooks/              # 自定义 Hook
├── styles/             # 样式文件
├── App.jsx             # 主应用
└── main.jsx            # 入口文件
```

修改后会自动热更新，无需手动刷新。

#### 后端代码

后端代码位于 `src-tauri/` 目录：

```
src-tauri/
├── src/
│   └── main.rs        # Rust 入口
├── Cargo.toml         # Rust 依赖
└── tauri.conf.json    # Tauri 配置
```

修改后需要重新构建：

```bash
npm run tauri build -- --no-bundle
```

#### 代理服务器

代理服务器代码为 `proxy.cjs`：

```bash
# 重启代理服务器
pkill -f "node proxy.cjs"
node proxy.cjs &
```

### 3. 调试技巧

#### 前端调试

1. **浏览器开发者工具**: 在 Tauri 窗口中按 F12 打开
2. **React DevTools**: 安装浏览器扩展
3. **Console 日志**: 使用 `console.log` 调试

#### 后端调试

1. **Rust 日志**: 使用 `println!` 或 `log` crate
2. **Tauri 日志**: 查看终端输出
3. **错误处理**: 使用 `Result` 类型处理错误

#### 代理服务器调试

```bash
# 查看代理服务器日志
node proxy.cjs

# 测试 API 接口
curl http://localhost:3001/api/session-id
curl http://localhost:3001/api/dashboard
```

## 代码规范

### 1. JavaScript/React

- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 使用函数组件和 Hooks
- 避免使用 class 组件

```javascript
// 好的示例
function MyComponent() {
  const [count, setCount] = useState(0)
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}

// 不好的示例
class MyComponent extends React.Component {
  state = { count: 0 }
  
  render() {
    return (
      <button onClick={() => this.setState({ count: this.state.count + 1 })}>
        Count: {this.state.count}
      </button>
    )
  }
}
```

### 2. CSS

- 使用 CSS 变量定义主题
- 使用 BEM 命名规范
- 避免使用 !important
- 使用 Flexbox 或 Grid 布局

```css
/* 好的示例 */
.card {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 16px;
}

.card__title {
  font-size: 18px;
  font-weight: bold;
}

/* 不好的示例 */
.card {
  background: #0f3460 !important;
  border-radius: 8px;
  padding: 16px;
}
```

### 3. Rust

- 使用 `rustfmt` 进行代码格式化
- 使用 `clippy` 进行代码检查
- 使用 `Result` 类型处理错误
- 使用 `derive` 宏减少样板代码

```rust
// 好的示例
#[derive(Debug, Clone)]
struct Config {
    name: String,
    value: i32,
}

fn load_config() -> Result<Config, Box<dyn std::error::Error>> {
    // 加载配置
    Ok(Config {
        name: "test".to_string(),
        value: 42,
    })
}

// 不好的示例
struct Config {
    name: String,
    value: i32,
}

fn load_config() -> Config {
    Config {
        name: "test".to_string(),
        value: 42,
    }
}
```

## 测试

### 1. 单元测试

```bash
# 运行前端测试
npm test

# 运行后端测试
cd src-tauri && cargo test
```

### 2. 集成测试

```bash
# 运行集成测试
npm run test:integration
```

### 3. 端到端测试

```bash
# 运行端到端测试
npm run test:e2e
```

## 构建与发布

### 1. 开发构建

```bash
# 构建前端
npm run build

# 构建桌面应用（不打包）
npm run tauri build -- --no-bundle
```

### 2. 生产构建

```bash
# 构建桌面应用（包含安装包）
npm run tauri build
```

### 3. 发布流程

1. 更新版本号
2. 更新 CHANGELOG.md
3. 创建 Git 标签
4. 构建发布包
5. 上传到 GitHub Releases

```bash
# 更新版本号
npm version patch  # 或 minor, major

# 创建 Git 标签
git tag v0.1.0
git push origin v0.1.0

# 构建发布包
npm run tauri build
```

## 常见问题

### 1. 构建失败

**问题**: `error: linker 'link.exe' not found`

**解决**: 安装 Visual Studio Build Tools

```bash
winget install Microsoft.VisualStudio.2022.BuildTools
```

### 2. 依赖安装失败

**问题**: `npm install` 失败

**解决**: 清除缓存重试

```bash
rm -rf node_modules package-lock.json
npm install
```

### 3. 开发服务器启动失败

**问题**: `npm run tauri dev` 失败

**解决**: 检查端口是否被占用

```bash
# 检查端口占用
netstat -ano | findstr :1420

# 杀死占用进程
taskkill /PID <PID> /F
```

### 4. 代理服务器连接失败

**问题**: 无法连接到代理服务器

**解决**: 检查代理服务器是否运行

```bash
# 检查代理服务器
curl http://localhost:3001/health

# 重启代理服务器
pkill -f "node proxy.cjs"
node proxy.cjs &
```

## 贡献指南

### 1. Fork 仓库

```bash
# Fork 仓库到个人账号
# 克隆个人 Fork
git clone https://github.com/your-username/AgentDesk.git
cd AgentDesk

# 添加上游仓库
git remote add upstream https://github.com/xiaoxiongweini37/AgentDesk.git
```

### 2. 创建分支

```bash
# 同步上游代码
git fetch upstream
git checkout main
git merge upstream/main

# 创建功能分支
git checkout -b feature/new-feature
```

### 3. 提交代码

```bash
# 添加文件
git add .

# 提交更改
git commit -m "feat: 添加新功能"

# 推送到个人 Fork
git push origin feature/new-feature
```

### 4. 创建 Pull Request

1. 访问 GitHub 仓库页面
2. 点击 "New Pull Request"
3. 填写 PR 描述
4. 等待代码审查

### 5. 代码审查

- 确保代码符合规范
- 添加必要的测试
- 更新相关文档
- 响应审查意见

## 社区

### 1. 问题反馈

- 使用 GitHub Issues 报告问题
- 提供详细的问题描述
- 附上错误日志和截图

### 2. 功能建议

- 使用 GitHub Discussions 讨论新功能
- 描述使用场景和需求
- 讨论技术方案

### 3. 文档贡献

- 改进现有文档
- 添加示例代码
- 翻译文档

## 资源

### 官方文档

- [Tauri 文档](https://tauri.app/)
- [React 文档](https://react.dev/)
- [GSAP 文档](https://gsap.com/)
- [Hermes Agent 文档](https://hermes-agent.nousresearch.com/)

### 社区资源

- [Tauri Discord](https://discord.gg/tauri)
- [React 社区](https://react.dev/community)
- [GSAP 论坛](https://gsap.com/community/)

### 工具推荐

- [VS Code](https://code.visualstudio.com/) - 代码编辑器
- [Figma](https://www.figma.com/) - 设计工具
- [Postman](https://www.postman.com/) - API 测试工具
- [GitKraken](https://www.gitkraken.com/) - Git 图形化工具

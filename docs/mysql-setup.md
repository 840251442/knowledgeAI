# 本地 MySQL 安装与启动（macOS）

你当前环境：

- Homebrew 可用，但目录权限异常（`/usr/local` 多个目录不可写）
- Docker 已安装但 daemon 未启动

下面给两种最稳的方式，推荐优先用 Docker（不污染系统目录、可随时删容器重来）。

## 方案 A（推荐）：Docker 本地 MySQL

1. 启动 Docker Desktop（确保 Docker daemon 运行）
2. 在项目根目录执行：

```bash
bash scripts/dev-mysql-docker.sh
```

它会输出 `DATABASE_URL=...`，把它写入你的 `.env`：

```bash
DATABASE_URL="mysql://knowledgeai:knowledgeai_dev@localhost:3306/knowledgeai"
AUTH_SECRET="replace-with-a-long-random-string"
```

3. 初始化数据库：

```bash
npm run db:migrate
npm run db:seed
```

## 方案 B：修复 Homebrew 权限后安装 MySQL（系统级）

如果你坚持用 Homebrew 的 MySQL，需要先修复权限（需要 sudo）：

```bash
sudo chown -R "$USER" /usr/local/Cellar /usr/local/Frameworks /usr/local/Homebrew /usr/local/bin /usr/local/etc /usr/local/etc/bash_completion.d /usr/local/include /usr/local/lib /usr/local/lib/pkgconfig /usr/local/opt /usr/local/sbin /usr/local/share /usr/local/share/doc /usr/local/share/info /usr/local/share/man /usr/local/share/man/man1 /usr/local/share/man/man3 /usr/local/share/man/man5 /usr/local/share/man/man7 /usr/local/share/man/man8 /usr/local/share/zsh /usr/local/share/zsh/site-functions /usr/local/var/homebrew/linked /usr/local/var/homebrew/locks /usr/local/var/log
chmod u+w /usr/local/Cellar /usr/local/Frameworks /usr/local/Homebrew /usr/local/bin /usr/local/etc /usr/local/etc/bash_completion.d /usr/local/include /usr/local/lib /usr/local/lib/pkgconfig /usr/local/opt /usr/local/sbin /usr/local/share /usr/local/share/doc /usr/local/share/info /usr/local/share/man /usr/local/share/man/man1 /usr/local/share/man/man3 /usr/local/share/man/man5 /usr/local/share/man/man7 /usr/local/share/man/man8 /usr/local/share/zsh /usr/local/share/zsh/site-functions /usr/local/var/homebrew/linked /usr/local/var/homebrew/locks /usr/local/var/log
```

然后安装并启动：

```bash
brew install mysql@8.4
brew services start mysql@8.4
mysql --version
```

接着创建数据库与用户，再把 `DATABASE_URL` 写入 `.env`。

# Issue #27 合并后隔离环境清理回执

时间：2026-10-15，Asia/Singapore。执行者：独立验收子 agent `review_27`。主 agent 已确认 PR #28 合并，merge commit `8b447bb7c5c39f8c925c814e8bb85f7787297dba`，授权清理本轮命名隔离环境。

**PASS：本轮 API/Web 已停止，隔离数据库及全部专属临时配置/标识/存储路径已删除；已提交验收工件完整保留。** 没有操作用户既有站点 Cookie、既有标签页或其他数据库，没有生产部署。

## 清理范围与实际操作

1. `lsof -nP -iTCP:4027 -iTCP:3027 -sTCP:LISTEN` 定位本轮 API PID 6499 和 Web PID 8059。`ps -p 6499,8059 -o pid,ppid,args` 确认 API 使用本轮 worktree 的脚本及专属 env-file，Web 是本轮端口的 Next server。
2. 执行 `kill -TERM 6499 8059`。复核这两个 PID 与 API 父进程 PID 6493 均已消失。
3. 仅在本地 `deploy-postgres-1` 的 postgres 管理库执行：

   ```sh
   docker exec deploy-postgres-1 psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
     -c 'DROP DATABASE yoryon_issue27_20261015;'
   ```

   回执：`DROP DATABASE`。
4. 用 Python `shutil.rmtree(Path('/tmp/yoryon-issue27-20261015'))` 删除唯一授权的专属临时目录。目录包含 runtime.env、发布源文件和三个临时浏览器事件/身份关联文件；此前记录的专属 storage 子路径也随目录删除。没有读取或输出其中敏感内容，没有删除工件目录。

## 清理后复核

实际执行数据库查询：

```sql
SELECT count(*) AS isolated_database_remaining
FROM pg_database WHERE datname='yoryon_issue27_20261015';
```

回执：`isolated_database_remaining = 0`。

对端口分别执行 `lsof -nP -iTCP:<port> -sTCP:LISTEN` 并统计监听记录；对目标路径执行 `Path.exists()`；用 `git ls-files -z artifacts/issue-27-20261015` 逐项核对已提交工件是否存在。脱敏结果：

```text
port_4027_listener_count=0
port_3027_listener_count=0
/tmp/yoryon-issue27-20261015: exists=False
/private/tmp/yoryon-issue27-20261015: exists=False
tracked_artifact_count=19
tracked_artifacts_missing=0
known_API_Web_and_API_parent_processes_remaining=0
```

没有新建其他临时敏感文件；本轮全部临时身份/事件关联文件都在已删除的专属目录下。浏览器故障模拟在前一验收轮关闭本任务新建标签页时已解除；本次清理没有浏览器操作。

本文件仅含脱敏清理命令与回执，不含 visitor UUID、token、连接串或凭证。按主 agent 指令不 commit、不 push，交由主 agent 复制到最终集成工件。

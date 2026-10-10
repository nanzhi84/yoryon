# ADR-0002：统一权益模型 —— append-only Entitlement 与兑换幂等

状态：已接受（2026-10-11 修订）

## 背景

平台有三种付费形态：单篇解锁、合集解锁、长期订阅。若为三者各建权限系统，校验逻辑会分叉且难以组合。同时激活码兑换存在两个正确性风险：

1. 同一用户重复兑换同一激活码：先加计数再插入唯一约束的 Redemption，会在唯一约束冲突时无法返回幂等成功。
2. 并发兑换同一码时 `used_count` 可能超过 `max_uses`。
3. 重复兑换订阅时，有效期是延长还是保持原值需要明确定义。

## 决策

**统一模型**：单篇/合集/订阅全部收敛为 `entitlements` 表的 `scope_type`（`content` / `collection` / `subscription`），唯一校验入口为 `canAccess()`（packages/core 唯一实现）。

**授予事实不可变**：每次兑换各自插入一条 Entitlement（与 Redemption 1:1）；行不删除、区间不修改。撤销以单调状态字段表达（`revoked_at` / `revoked_by` / `revoke_reason`，NULL → 值、不可逆），不声称整表严格 append-only。

- 订阅权益为独立区间 `[valid_from, valid_until]`。兑换时 `base = max(now, 用户未撤销订阅权益的 max(valid_until))`（无则 `now`；已存在永久权益则 `base = now`，新区间仅作事实记录），`valid_from = base`、`valid_until = base + grant_days`，重复兑换自然**接续延长**。
- 有效订阅 = 未撤销订阅区间对 `now` 的覆盖（区间并集语义，非全局 MAX）。
- 撤销粒度 = 单次兑换对应的权益区间，其余区间不重排、不重算。
- 合集授权**动态解析**合集当前成员，合集新增内容自动被既有授权覆盖（产品语义已确认）；不做成员快照。

**兑换事务**（防超发 + 幂等）：

```
BEGIN;
SELECT id FROM users WHERE id = ? FOR UPDATE;                 -- 串行化同一用户的所有兑换（不同码并发安全）
SELECT ... FROM activation_codes WHERE code = ? FOR UPDATE;   -- 串行化同一码的并发兑换
校验码状态/有效期
SELECT ... FROM redemptions WHERE code_id=? AND user_id=?;    -- 先查重
  → 已存在：COMMIT，返回已有权益（幂等成功，不动计数）
UPDATE activation_codes SET used_count=used_count+1
  WHERE id=? AND used_count < max_uses;                       -- 条件更新防超发
  → 0 行：ROLLBACK，返回已兑完
INSERT redemption;
INSERT entitlement（订阅：base = max(now, 未撤销订阅 max(valid_until))，
  valid_from = base，valid_until = base + grant_days）；
COMMIT;
唯一约束 (code_id, user_id) 兜底：捕获 23505 → 重查并按幂等成功返回
```

## 后果

- 正面：审计轨迹完整（每笔权益可追溯到具体兑换）；撤销安全；并发与重试语义明确；订阅叠加无需特殊代码。
- 代价：`canAccess` 的合集分支需要 join `collection_items`（合集成员量大时需关注索引；个人博客规模无虞）。
- 约束：任何新付费形态必须复用 Entitlement 模型，不得另建权限表。

## 修订记录（2026-10-11）：订阅区间链接续、并发串行化与 append-only 措辞修正

变更原因：

1. 原文"有效期 = MAX(valid_until)"且未定义接续 base：连续兑换两个 30 天订阅只得到约 30 天（两区间重叠而非接续）；且撤销中间一笔后，全局 MAX 会掩盖空洞，语义错误。
2. 原文称"绝不修改既有行"，但实际允许更新 `revoked_at`，自相矛盾。
3. 不同激活码的并发兑换锁的是不同码行，订阅 base 计算存在丢失更新风险。

修正内容：

- **订阅区间链**：兑换时以 `max(now, 未撤销订阅 max(valid_until))` 为 base 接续，两个 30 天码正确得到 60 天覆盖；`canAccess` 按区间覆盖（并集）判断，不用全局 MAX。
- **撤销语义**：区间独立，撤销中间一笔不影响后续区间的绝对时间（可能产生空洞）；需要整体缩短时由管理员逐笔撤销或 CLI 手动授予补偿。
- **永久与限时共存**：存在未撤销永久订阅权益（`valid_until IS NULL`）时订阅即有效；期间新兑换仍记录区间（无实际效果，运营上应避免继续售卖）；永久权益被撤销后回落到剩余区间并集。
- **并发串行化**：兑换事务增加 `SELECT ... FROM users WHERE id=? FOR UPDATE`，串行化同一用户的所有兑换，不同码并发兑换不再丢失有效期。
- **措辞修正**：授予事实不可变（行不删、区间不改）；`revoked_at`/`revoked_by`/`revoke_reason` 为单调状态字段（NULL → 值、不可逆），不再声称整表严格 append-only。不引入独立撤销事件表——撤销是不可逆单射，状态字段已记录 who/when/why，事件表仅在需要多次状态翻转历史时才有价值，当前无此需求。
- **数据模型同步**：撤销状态单一来源在 `entitlements`（含 `revoked_by`/`revoke_reason`）；`redemptions` 不再保留 `revoked_at`（展示层经 1:1 join 推导）。`activation_codes.subscription_days` 泛化为 `grant_days`（subscription 必填；content/collection 为 NULL 表示长期）。

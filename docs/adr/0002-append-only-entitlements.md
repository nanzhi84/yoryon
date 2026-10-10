# ADR-0002：统一权益模型 —— append-only Entitlement 与兑换幂等

状态：已接受

## 背景

平台有三种付费形态：单篇解锁、合集解锁、长期订阅。若为三者各建权限系统，校验逻辑会分叉且难以组合。同时激活码兑换存在两个正确性风险：

1. 同一用户重复兑换同一激活码：先加计数再插入唯一约束的 Redemption，会在唯一约束冲突时无法返回幂等成功。
2. 并发兑换同一码时 `used_count` 可能超过 `max_uses`。
3. 重复兑换订阅时，有效期是延长还是保持原值需要明确定义。

## 决策

**统一模型**：单篇/合集/订阅全部收敛为 `entitlements` 表的 `scope_type`（`content` / `collection` / `subscription`），唯一校验入口为 `canAccess()`（packages/core 唯一实现）。

**append-only**：每次兑换各自插入一条 Entitlement（与 Redemption 1:1），绝不修改既有行。

- 用户有效订阅期 = 其所有未撤销订阅权益的 `MAX(valid_until)`；重复兑换订阅自然实现**叠加延长**。
- 撤销粒度 = 单次兑换（revoke redemption → 对应 entitlement 标记 `revoked_at`），不影响该用户其他来源的权益。
- 合集授权**动态解析**合集当前成员，合集新增内容自动被既有授权覆盖（产品语义已确认）；不做成员快照。

**兑换事务**（防超发 + 幂等）：

```
BEGIN;
SELECT ... FROM activation_codes WHERE code = ? FOR UPDATE;   -- 串行化同一码的并发兑换
校验码状态/有效期
SELECT ... FROM redemptions WHERE code_id=? AND user_id=?;    -- 先查重
  → 已存在：COMMIT，返回已有权益（幂等成功，不动计数）
UPDATE activation_codes SET used_count=used_count+1
  WHERE id=? AND used_count < max_uses;                       -- 条件更新防超发
  → 0 行：ROLLBACK，返回已兑完
INSERT redemption; INSERT entitlement;
COMMIT;
唯一约束 (code_id, user_id) 兜底：捕获 23505 → 重查并按幂等成功返回
```

## 后果

- 正面：审计轨迹完整（每笔权益可追溯到具体兑换）；撤销安全；并发与重试语义明确；订阅叠加无需特殊代码。
- 代价：`canAccess` 的合集分支需要 join `collection_items`（合集成员量大时需关注索引；个人博客规模无虞）。
- 约束：任何新付费形态必须复用 Entitlement 模型，不得另建权限表。

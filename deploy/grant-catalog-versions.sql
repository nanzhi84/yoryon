-- 先执行数据库迁移 0015，再以迁移 owner 授予目录门禁/写入所需的最小权限。
-- API 只读取；CLI 在内容事务中推进范围版本，不允许删除版本（会恢复旧零版本 key）。
GRANT SELECT ON TABLE public.catalog_versions TO yoryon_api;
GRANT SELECT, INSERT, UPDATE ON TABLE public.catalog_versions TO yoryon_cli;

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApiError {
  error?: { code?: string; message?: string };
}

export function LoginForm() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emailOrUsername, password }),
      });
      const data = (await res.json()) as ApiError;
      if (!res.ok) {
        setError(data.error?.message ?? "登录失败");
        return;
      }
      // 硬导航：登录后需要完整重建服务端渲染状态（Cookie 已种）
      window.location.assign("/");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="emailOrUsername" className="text-sm font-medium">邮箱或用户名</label>
        <Input id="emailOrUsername" autoComplete="username" value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">密码</label>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "登录中…" : "登录"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        没有账号？<Link href="/register" className="underline underline-offset-4">注册</Link>
        {" · "}
        <Link href="/reset-password" className="underline underline-offset-4">忘记密码</Link>
      </p>
    </form>
  );
}

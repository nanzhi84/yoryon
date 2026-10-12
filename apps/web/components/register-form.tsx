"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApiError {
  error?: { code?: string; message?: string };
}

/** 注册两步：填写资料发码 → 输入验证码完成注册（验证成功即登录，BFF 已种 Cookie）。 */
export function RegisterForm() {
  const [step, setStep] = useState<"form" | "code">("form");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function post(path: string, body: unknown): Promise<{ ok: boolean; message: string | undefined }> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as ApiError;
    return { ok: res.ok, message: data.error?.message };
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await post("/api/auth/register", { email, username, password });
      if (!r.ok) {
        setError(r.message ?? "注册失败");
        return;
      }
      setStep("code");
      setNotice(`验证码已发送至 ${email}，10 分钟内有效。`);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await post("/api/auth/verify-email", { email, code });
      if (!r.ok) {
        setError(r.message ?? "验证失败");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError(null);
    setNotice(null);
    const r = await post("/api/auth/resend-code", { email, purpose: "register" });
    if (!r.ok) setError(r.message ?? "发送失败");
    else setNotice("验证码已重新发送。");
  }

  if (step === "code") {
    return (
      <form onSubmit={onVerify} className="space-y-4">
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        <div className="space-y-2">
          <label htmlFor="code" className="text-sm font-medium">验证码</label>
          <Input id="code" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="6 位数字" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "验证中…" : "完成注册"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          没收到？<button type="button" onClick={onResend} className="underline underline-offset-4">重新发送</button>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={onRegister} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">邮箱</label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium">用户名</label>
        <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">密码（至少 8 位）</label>
        <Input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "发送验证码…" : "注册"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        已有账号？<Link prefetch={false} href="/login" className="underline underline-offset-4">登录</Link>
      </p>
    </form>
  );
}

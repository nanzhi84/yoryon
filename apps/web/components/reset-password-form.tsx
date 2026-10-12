"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** 密码重置两步：发码 → 验证码 + 新密码（成功后全部会话被撤销，回到登录页）。 */
export function ResetPasswordForm() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function post(body: unknown): Promise<{ ok: boolean; message: string | undefined }> {
    const res = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: res.ok, message: data.error?.message };
  }

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await post({ email });
      if (!r.ok) {
        setError(r.message ?? "发送失败");
        return;
      }
      setStep("reset");
      setNotice("如果该邮箱已注册，验证码已发送，10 分钟内有效。");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await post({ email, code, newPassword });
      if (!r.ok) {
        setError(r.message ?? "重置失败");
        return;
      }
      window.location.assign("/login");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  if (step === "reset") {
    return (
      <form onSubmit={onReset} className="space-y-4">
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        <div className="space-y-2">
          <label htmlFor="code" className="text-sm font-medium">验证码</label>
          <Input id="code" inputMode="numeric" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <label htmlFor="newPassword" className="text-sm font-medium">新密码（至少 8 位）</label>
          <Input id="newPassword" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </div>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "重置中…" : "重置密码"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onRequest} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">注册邮箱</label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "发送中…" : "发送验证码"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        想起来了？<Link prefetch={false} href="/login" className="underline underline-offset-4">登录</Link>
      </p>
    </form>
  );
}

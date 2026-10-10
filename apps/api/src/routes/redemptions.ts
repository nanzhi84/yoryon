/** 兑换与权益查询路由。 */
import { Hono } from "hono";
import { z } from "zod";
import { RATE_LIMITS } from "@yoryon/config";
import { listUserEntitlements, redeemCode, type RedeemError } from "@yoryon/core";
import type { AppDeps } from "../deps";
import { errorResponse } from "../errors";
import { requireAuth, type AppVariables } from "../middleware/auth";
import { checkRate } from "./auth";

const redeemSchema = z.object({ code: z.string().min(1).max(128) });

const REDEEM_ERROR_HTTP: Record<RedeemError, { status: 400 | 409; message: string }> = {
  invalid_code: { status: 400, message: "激活码无效" },
  code_disabled: { status: 400, message: "激活码已停用" },
  code_expired: { status: 400, message: "激活码已过期" },
  code_exhausted: { status: 409, message: "激活码已被兑完" },
  grant_target_invalid: { status: 409, message: "激活码对应的权益目标已失效" },
};

export function redemptionRoutes(deps: AppDeps) {
  const app = new Hono<{ Variables: AppVariables }>();

  app.post("/redemptions", async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const limited = checkRate(deps, c, [
      { key: `redeem:user:${auth.user.id}`, limit: RATE_LIMITS.redeemPerUserPerMinute, windowMs: 60_000 },
      { key: `redeem:ip:${c.get("clientIp").ip}`, limit: RATE_LIMITS.redeemPerIpPerMinute, windowMs: 60_000 },
    ]);
    if (limited) return limited;

    const body = redeemSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return errorResponse(c, 400, "invalid_request", "参数错误");

    const result = await redeemCode(deps.db, { userId: auth.user.id, code: body.data.code });
    c.header("Cache-Control", "private, no-store");
    if (!result.ok) {
      const mapped = REDEEM_ERROR_HTTP[result.error];
      return errorResponse(c, mapped.status, result.error, mapped.message);
    }
    return c.json({
      ok: true,
      idempotent: result.idempotent,
      redemptionId: result.redemption.id,
      entitlement: {
        id: result.entitlement.id,
        scopeType: result.entitlement.scopeType,
        scopeId: result.entitlement.scopeId,
        validFrom: result.entitlement.validFrom.toISOString(),
        validUntil: result.entitlement.validUntil?.toISOString() ?? null,
      },
    });
  });

  app.get("/me/entitlements", async (c) => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const views = await listUserEntitlements(deps.db, auth.user.id);
    c.header("Cache-Control", "private, no-store");
    return c.json({
      items: views.map(({ entitlement: e, scopeTitle }) => ({
        id: e.id,
        scopeType: e.scopeType,
        scopeId: e.scopeId,
        scopeTitle,
        validFrom: e.validFrom.toISOString(),
        validUntil: e.validUntil?.toISOString() ?? null,
        revokedAt: e.revokedAt?.toISOString() ?? null,
        revokeReason: e.revokeReason || null,
        redemptionId: e.redemptionId,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  });

  return app;
}

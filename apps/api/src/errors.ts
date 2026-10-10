/** 统一错误格式：{ error: { code, message } }（架构 §7）。 */
import type { Context } from "hono";
import type { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";

export class ApiError extends Error {
  constructor(
    public status: StatusCode,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

export const Errors = {
  unauthorized: () => new ApiError(401, "unauthorized", "需要登录"),
  forbidden: () => new ApiError(403, "forbidden", "无权访问"),
  notFound: (what = "资源") => new ApiError(404, "not_found", `${what}不存在`),
  badRequest: (code: string, message: string) => new ApiError(400, code, message),
  rateLimited: () => new ApiError(429, "rate_limited", "请求过于频繁，请稍后再试"),
};

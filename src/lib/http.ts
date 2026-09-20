import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import type { ZodType } from "zod";

/** Throw this from library code to produce a clean JSON error response. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Parse and validate a JSON body. Throws HttpError(400) with a readable message. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HttpError(400, issue?.message ?? "Invalid request");
  }
  return result.data;
}

/** Validate URL search params against a schema. */
export function readQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  const result = schema.safeParse(obj);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HttpError(400, issue?.message ?? "Invalid query");
  }
  return result.data;
}

/**
 * Basic CSRF protection for state-changing requests: cookies are SameSite=Lax
 * and we additionally reject cross-site requests whose Origin header does not
 * match the request host.
 */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetches without Origin and CLI tools are allowed
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Invalid origin");
  }
  if (originHost !== host) {
    throw new HttpError(403, "Cross-site request blocked");
  }
}

/**
 * Resolve the client address from a source we actually trust.
 *
 * X-Forwarded-For and X-Real-IP are plain request headers: a client can send
 * any value, so using them for rate limiting lets an attacker spread attempts
 * across unlimited buckets. We therefore only read them when the platform sets
 * them (Vercel's edge injects x-vercel-forwarded-for and strips client copies)
 * or when the operator opts in with TRUST_PROXY_HEADERS=1.
 *
 * Returns null when no trustworthy address is available. Callers must then
 * skip IP-based limits and rely on the identity-based ones, rather than
 * lumping every visitor into one shared bucket.
 */
export function getClientIp(req: Request): string | null {
  const fromPlatform = req.headers.get("x-vercel-forwarded-for");
  if (fromPlatform) return normalizeIp(fromPlatform);

  if (env.trustProxyHeaders) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return normalizeIp(forwarded);
    const real = req.headers.get("x-real-ip");
    if (real) return normalizeIp(real);
  }
  return null;
}

function normalizeIp(headerValue: string): string | null {
  // Left-most entry is the client as recorded by the trusted proxy.
  const first = headerValue.split(",")[0]?.trim() ?? "";
  if (!first || first.length > 45) return null;
  return /^[0-9a-fA-F.:]+$/.test(first) ? first : null;
}

type RouteHandler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

/** Wrap a route handler so thrown HttpErrors become JSON responses. */
export function route<Ctx = unknown>(handler: RouteHandler<Ctx>): RouteHandler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return jsonError(err.status, err.message, err.extra);
      }
      console.error("Unhandled route error:", err);
      return jsonError(500, "Something went wrong");
    }
  };
}

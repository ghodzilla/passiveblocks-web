import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// IP allowlist for private surfaces. Comma-separated env var.
// Default: Pritesh's home IP (matches yield-dashboard ALLOWED_IPS).
function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || '';
}

function isIpAllowed(ip: string): boolean {
  const raw = process.env.ALLOWED_IPS || '';
  // If no allowlist is configured, fail closed for /drafts (never expose publicly).
  if (!raw.trim()) return false;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(ip);
}

// Protect /drafts — IP-allowlist only (private review surface)
export function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // /drafts — IP allowlist gate. No auth. Never indexable.
  if (pathname.startsWith('/drafts')) {
    const ip = getClientIp(request);
    if (!isIpAllowed(ip)) {
      return new NextResponse('Not Found', {
        status: 404,
        headers: {
          'content-type': 'text/plain',
          'x-robots-tag': 'noindex, nofollow',
        },
      });
    }
    response.headers.set('x-robots-tag', 'noindex, nofollow');
    return response;
  }

  return response;
}

export const config = {
  matcher: ['/drafts', '/drafts/:path*'],
};

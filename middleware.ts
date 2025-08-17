import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/stores/:store']
};

export default async function middleware(req: NextRequest) {
  const store = req.nextUrl.pathname.split('/')[2];
  const url = `${req.nextUrl.origin}/stores/${store}/index.html`;

  const res = await fetch(url);
  if (!res.ok) return new NextResponse('Store not found', { status: 404 });

  const html = await res.text();
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

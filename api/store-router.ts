import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

export const config = {
  matcher: ['/stores/:store']
};

export default async function handler(req: NextRequest) {
  const store = req.nextUrl.pathname.split('/')[2];
  const filePath = path.join(process.cwd(), 'stores', store, 'index.html');

  try {
    const html = readFileSync(filePath, 'utf8');
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (err) {
    return new NextResponse('Store not found', { status: 404 });
  }
}

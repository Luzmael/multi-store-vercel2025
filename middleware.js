export const config = {
  matcher: ['/stores/:store']
};

export default function middleware(request) {
  const { pathname, origin } = request.nextUrl;
  const store = pathname.split('/')[2];

  return Response.redirect(`${origin}/stores/${store}/index.html`);
}

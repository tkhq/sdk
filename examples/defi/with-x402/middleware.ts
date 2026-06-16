import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export const middleware = async (request: NextRequest) => {
  // This middleware will intercept requests to the protected route(s). It checks for the presence of a "payment-session" cookie,
  // which indicates that the user has made a valid payment. If the cookie is not present, the user is redirected to the paywall page.

  // TODO: In a production app, you would also want to verify the validity of the cookie here using an x402 validator.
  const paymentHeader = request.cookies.get("payment-session");
  if (!paymentHeader) {
    return NextResponse.rewrite(new URL("/paywall", request.url));
  }

  return NextResponse.next();
};

// Configure which paths the middleware should run on
export const config = {
  matcher: ["/protected/:path*"],
};

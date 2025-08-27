import { NextResponse } from "next/server";
import { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

export async function POST(req: Request) {
    const body = await req.json();
    if (!body?.auth_code) {
        return NextResponse.json({ error: "Missing auth_code" }, { status: 400 });
    }

    if (!body?.state) {
        return NextResponse.json({ error: "Missing state" }, { status: 400 });
    }

    const turnkeyClient = new TurnkeySDKClient({
        apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
        defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const oauth2AuthenticateResponse = turnkeyClient.apiClient()

    // in production your should check the state parameter to ensure that it matches what was generated
    // if state != generated stated {
    //      return some failure
    // }


    return NextResponse.json({ ok: true, greeting: `Hello, ${body.name}!` });
}
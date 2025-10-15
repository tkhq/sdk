import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  Turnkey as TurnkeySDKServer
} from "@turnkey/sdk-server";

import { refineNonNull } from "../utils";

async function main() {
  console.log("Sending a new dashboard invitation...\n");

  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });
    
    const receiverUserName = "<Invitation receiver user name>"
    const receiverUserEmail = "<Invitation receiver email>"
    const receiverUserTags: string[] = []// A list of tags assigned to the Invitation recipient. This field, if not needed, should be an empty array in your request body.,
    const accessType=  "ACCESS_TYPE_WEB" 
    const senderUserId =  "<Sender user ID>"


    const invitation = await turnkeyClient.apiClient().createInvitations({
      invitations:[{ 
        receiverUserName,
        receiverUserEmail,
        receiverUserTags,
        accessType,
        senderUserId
      }]
     
    })

    const invitationId = refineNonNull(invitation.invitationIds)
    //success
    console.log(`Invitation with ID ${invitationId} sent succesfully`)

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
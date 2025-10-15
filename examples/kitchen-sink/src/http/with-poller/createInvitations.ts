import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { refineNonNull } from "../../utils";

async function main() {
  console.log("Sending a new dashboard invitation...\n");

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    }),
  );

   const receiverUserName = "<Invitation receiver user name>"
   const receiverUserEmail = "<Invitation receiver email>"
   const receiverUserTags: string[] = []// A list of tags assigned to the Invitation recipient. This field, if not needed, should be an empty array in your request body.,
   const accessType=  "ACCESS_TYPE_WEB" 
   const senderUserId =  "<Sender user ID>"

   const { activity } = await turnkeyClient.createInvitations({
     type: "ACTIVITY_TYPE_CREATE_INVITATIONS",
     timestampMs: String(Date.now()),
     organizationId: process.env.ORGANIZATION_ID!,
     parameters: {
        invitations: [
            {
            receiverUserName,
            receiverUserEmail,
            receiverUserTags,
            accessType,
            senderUserId
            }
         ]
        }
    })
  
    const invitationId = refineNonNull(
      activity.result.createInvitationsResult?.invitationIds,
  );

    // Success!
    console.log(`Invitation with ID ${invitationId} sent succesfully`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
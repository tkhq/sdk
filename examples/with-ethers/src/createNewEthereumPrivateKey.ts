import { PublicApiService, init as httpInit } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";

const POLLING_INTERVAL_MS = 250;

export async function createNewEthereumPrivateKey() {
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  console.log(
    "`process.env.PRIVATE_KEY_ID` not found; creating a new Ethereum private key on Turnkey...\n"
  );

  const privateKeyName = `ETH Key ${String(
    Math.floor(Math.random() * 10000)
  ).padStart(4, "0")}`;

  try {
    const privateKeyId = await withPolling(privateKeyName);

    // Success!
    console.log(
      [
        `New Ethereum private key created!`,
        `- Name: ${privateKeyName}`,
        `- Private key ID: ${privateKeyId}`,
        ``,
        "Now you can take the private key ID, put it in `.env.local`, then re-run the script.",
      ].join("\n")
    );
  } catch (error) {
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: "Failed to create a new Ethereum private key",
      cause: error as Error,
    });
  }
}

// Turnkey activities are async by nature (because we fully support consensus),
// so here's a little helper for polling the status
async function withPolling(privateKeyName: string): Promise<string> {
  const organizationId = process.env.ORGANIZATION_ID!;

  let { activity } = await PublicApiService.postCreatePrivateKeys({
    body: {
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
      organizationId,
      parameters: {
        privateKeys: [
          {
            privateKeyName,
            curve: "CURVE_SECP256K1",

            addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
            privateKeyTags: [],
          },
        ],
      },
      timestamp: process.hrtime().join(""), // nanosecond timestamp
    },
  });

  while (true) {
    switch (activity.status) {
      case "ACTIVITY_STATUS_COMPLETED": {
        // Success!
        return refineNonNull(
          activity.result.createPrivateKeysResult?.privateKeyIds?.[0]
        );
      }
      case "ACTIVITY_STATUS_CREATED": {
        // Async pending state -- keep polling
        break;
      }
      case "ACTIVITY_STATUS_PENDING": {
        // Async pending state -- keep polling
        break;
      }
      case "ACTIVITY_STATUS_CONSENSUS_NEEDED": {
        // If the activity requires consensus, we shouldn't be pooling forever.
        // You can store the activity ID and ask for activity status later,
        // But that's out of scope for this simple example for now.
        throw new TurnkeyActivityError({
          message: `Consensus needed for activity ${activity.id}`,
          activityId: activity.id,
          activityStatus: activity.status,
          activityType: activity.type,
        });
      }
      case "ACTIVITY_STATUS_FAILED": {
        // Activity failed
        throw new TurnkeyActivityError({
          message: `Activity ${activity.id} failed`,
          activityId: activity.id,
          activityStatus: activity.status,
          activityType: activity.type,
        });
      }
      case "ACTIVITY_STATUS_REJECTED": {
        // Activity was rejected
        throw new TurnkeyActivityError({
          message: `Activity ${activity.id} was rejected`,
          activityId: activity.id,
          activityStatus: activity.status,
          activityType: activity.type,
        });
      }
      default: {
        // Make sure the switch block is exhaustive
        assertNever(activity.status);
      }
    }

    await sleep(POLLING_INTERVAL_MS);

    // Now fetch the latest activity status
    const response = await PublicApiService.postGetActivity({
      body: {
        activityId: activity.id,
        organizationId,
      },
    });

    activity = response.activity;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function assertNever(input: never, errorMessage?: string): never {
  throw new Error(errorMessage ?? `Unexpected input: ${JSON.stringify(input)}`);
}

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}

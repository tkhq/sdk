import type { Page } from "@playwright/test";
import type { Protocol } from "playwright-core/types/protocol";

const RP_ID = "localhost";

export async function setupWebAuthn(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
}

export type TAuthenticatorTransport = Protocol.WebAuthn.AuthenticatorTransport;

/**
 * - Start with creating an authenticator via `.init()`
 * - To "unplug" an authenticator, call `.deactivate()`
 * - To "plug it in" again, call `.activate()`
 *
 * This is needed because CDP doesn't offer a built-in way to turn on/off authenticators
 */
export class VirtualAuthenticator {
  private options: Protocol.WebAuthn.addVirtualAuthenticatorParameters["options"];
  private _page: Page;
  private authenticatorId: string | null = null;
  private credentialList: Protocol.WebAuthn.Credential[] | null = null;

  constructor(
    page: Page,
    options: Protocol.WebAuthn.addVirtualAuthenticatorParameters["options"],
  ) {
    this._page = page;
    this.options = options;
  }

  public isActive(): boolean {
    return this.authenticatorId != null;
  }

  public async init() {
    if (this.authenticatorId != null) {
      throw new Error(`Authenticator has already been initiated`);
    }

    const client = await this._page.context().newCDPSession(this._page);

    // Create a new Authenticator
    const { authenticatorId } = await client.send(
      "WebAuthn.addVirtualAuthenticator",
      { options: this.options },
    );
    this.authenticatorId = authenticatorId;
  }

  public async activate() {
    if (this.authenticatorId != null) {
      return; // noop
    }

    if (this.credentialList == null) {
      throw new Error(`Cannot find saved credentials to restore`);
    }

    const client = await this._page.context().newCDPSession(this._page);

    // Create a new Authenticator
    const { authenticatorId } = await client.send(
      "WebAuthn.addVirtualAuthenticator",
      { options: this.options },
    );

    // Wipe all new credentials
    await client.send("WebAuthn.clearCredentials", {
      authenticatorId: authenticatorId,
    });

    // Restore saved credentials
    for (const credential of this.credentialList) {
      await client.send("WebAuthn.addCredential", {
        authenticatorId,
        credential: {
          ...credential,
          rpId: RP_ID, // This is required
        },
      });
    }

    this.authenticatorId = authenticatorId;
  }

  public async deactivate() {
    if (this.authenticatorId == null) {
      return; // noop
    }

    const client = await this._page.context().newCDPSession(this._page);

    // Save the credentials
    const { credentials: credentialList } = await client.send(
      "WebAuthn.getCredentials",
      {
        authenticatorId: this.authenticatorId,
      },
    );
    this.credentialList = credentialList;

    // Remove the authenticator
    await client.send("WebAuthn.removeVirtualAuthenticator", {
      authenticatorId: this.authenticatorId,
    });
    this.authenticatorId = null;
  }
}

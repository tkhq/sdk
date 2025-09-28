# Turnkey Example with Porto

This is an example of upgrading a Turnkey EOA to a [Porto](https://porto.sh/) wallet and then doing something with it.


## Setup

1.  **Install Dependencies**: Ensure you have [pnpm](https://pnpm.io/) installed. Then, run:

    ```bash
    pnpm install
    ```

2.  **Environment Variables**: Create a `.env.local` file in the root directory and add the following environment variables:

    ```
    # Your Turnkey organization ID
    ORGANIZATION_ID="..."

    # API public key
    API_PUBLIC_KEY="..."

    # API private key
    API_PRIVATE_KEY="..."

    # The address of your private key. This is the key that will be used to sign transactions.
    SIGN_WITH="..."

    # Base URL for the Turnkey API
    BASE_URL="https://api.turnkey.com"

    # We use Porto's RPC
    RPC_URL="https://rpc.porto.sh"
    ```

## Running the example

To run the example, use the following command:

```bash
pnpm start
```

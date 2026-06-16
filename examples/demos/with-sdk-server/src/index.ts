import { Turnkey } from "@turnkey/sdk-server";
import fs from "fs";

const turnkeyConfig = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const turnkeyServerClient = new Turnkey(turnkeyConfig);
const client = turnkeyServerClient.apiClient();

// Now you can call any method you like. Whoami is the simplest of all:
const response = await client.getWhoami();

// Log the response
console.log("Successfully called Turnkey. Whoami response: ", response);

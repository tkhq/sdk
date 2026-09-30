import { Turnkey, server } from "@turnkey/sdk-server";

export default {
  fetch() {
    return Response.json({
      processType: typeof process,
      turnkeyType: typeof Turnkey,
      actions: Object.keys(server),
    });
  },
};

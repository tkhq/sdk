export const turnkeyConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
  organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  iFrame: {
    export: {
      url: "https://export.turnkey.com",
      containerId: "turnkey-export-iframe-container-id",
    },
    import: {
      url: "https://import.turnkey.com",
      containerId: "turnkey-import-iframe-container-id",
    },
  },
};

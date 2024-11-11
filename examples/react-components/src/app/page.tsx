"use client";

import * as React from "react";
import { useState } from "react";
import { useTurnkey, Auth } from "@turnkey/sdk-react";
import { Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CustomSwitch from "./Switch";
import "./index.css";

// Define types for config and socials
interface SocialConfig {
  enabled: boolean;
  google: boolean;
  apple: boolean;
  facebook: boolean;
}

interface Config {
  email: boolean;
  passkey: boolean;
  phone: boolean;
  socials: SocialConfig;
}

export default function AuthPage() {
  const { authIframeClient } = useTurnkey();
  const [orgData, setOrgData] = useState<any>();

  const handleAuthSuccess = async () => {
    const whoamiResponse = await authIframeClient!.getWhoami({
      organizationId: "51fb75bf-c044-4f9f-903b-4fba6bfedab9",
    });
    setOrgData(whoamiResponse as any);
  };

  const [config, setConfig] = useState<Config>({
    email: true,
    passkey: true,
    phone: true,
    socials: {
      enabled: false,
      google: false,
      apple: false,
      facebook: false,
    },
  });

  const toggleConfig = (key: keyof Config) => {
    setConfig((prev) => {
      const newConfig = { ...prev };

      if (key !== "socials") {
        newConfig[key] = !prev[key];
      }

      return newConfig;
    });
  };

  const toggleSocials = (key: keyof SocialConfig) => {
    setConfig((prev) => {
      if (key === "enabled") {
        const isEnabled = !prev.socials.enabled;
        return {
          ...prev,
          socials: {
            enabled: isEnabled,
            google: isEnabled,
            apple: isEnabled,
            facebook: isEnabled,
          },
        };
      }

      if (prev.socials.enabled) {
        return {
          ...prev,
          socials: {
            ...prev.socials,
            [key]: !prev.socials[key],
          },
        };
      }

      return prev;
    });
  };

  const handleCopyConfig = () => {
    const authConfig = {
      emailEnabled: config.email,
      passkeyEnabled: config.passkey,
      phoneEnabled: config.phone,
      appleEnabled: config.socials.apple,
      googleEnabled: config.socials.google,
      facebookEnabled: config.socials.facebook,
    };
    navigator.clipboard.writeText(JSON.stringify(authConfig, null, 2));
    alert("Auth config copied to clipboard!");
  };

  const authConfig = {
    emailEnabled: config.email,
    passkeyEnabled: config.passkey,
    phoneEnabled: config.phone,
    appleEnabled: config.socials.apple,
    googleEnabled: config.socials.google,
    facebookEnabled: config.socials.facebook,
  };

  return (
    <main className="main">
      {!orgData && (
        <div className="authConfigCard">
          <Typography variant="h6" className="configTitle">
            Authentication config
          </Typography>

          <div className="toggleContainer">
            <div className="toggleRow">
              <div className="labelContainer">
                <img src="/dots.svg" />
                <Typography>Email</Typography>
              </div>
              <CustomSwitch
                checked={config.email}
                onChange={() => toggleConfig("email")}
              />
            </div>

            <div className="toggleRow">
              <div className="labelContainer">
                <img src="/dots.svg" />
                <Typography>Passkey</Typography>
              </div>
              <CustomSwitch
                checked={config.passkey}
                onChange={() => toggleConfig("passkey")}
              />
            </div>

            <div className="toggleRow">
              <div className="labelContainer">
                <img src="/dots.svg" />
                <Typography>Phone</Typography>
              </div>
              <CustomSwitch
                checked={config.phone}
                onChange={() => toggleConfig("phone")}
              />
            </div>
            <div className="socialContainer">
              <div className="toggleSocialRow">
                <div className="labelContainer">
                  <img src="/dots.svg" />
                  <Typography>Socials</Typography>
                </div>
                <CustomSwitch
                  checked={config.socials.enabled}
                  onChange={() => toggleSocials("enabled")}
                />
              </div>
              <div className="toggleSocialIndividualRow">
                <div className="labelContainer">
                  <img src="/google.svg" className="iconSmall" />
                  <Typography>Google</Typography>
                </div>
                <CustomSwitch
                  checked={config.socials.google}
                  onChange={() => toggleSocials("google")}
                />
              </div>
              <div className="toggleSocialIndividualRow">
                <div className="labelContainer">
                  <img src="/apple.svg" className="iconSmall" />
                  <Typography>Apple</Typography>
                </div>
                <CustomSwitch
                  checked={config.socials.apple}
                  onChange={() => toggleSocials("apple")}
                />
              </div>
              <div className="toggleSocialIndividualRow">
                <div className="labelContainer">
                  <img src="/facebook.svg" className="iconSmall" />
                  <Typography>Facebook</Typography>
                </div>
                <CustomSwitch
                  checked={config.socials.facebook}
                  onChange={() => toggleSocials("facebook")}
                />
              </div>
            </div>
          </div>

          <div className="copyConfigButton" onClick={handleCopyConfig}>
            <ContentCopyIcon fontSize="small" />
            <div className="copyConfigText">
              <Typography variant="body2" className="copyText">
                Copy config
              </Typography>
            </div>
          </div>
        </div>
      )}
      {orgData ? (
        <div className="success">
          YOU ARE AUTHENTICATED ON TURNKEY!
          <div>
            <strong>Organization Id:</strong> {orgData.organizationId}
          </div>
          <div>
            <strong>User Id:</strong> {orgData.userId}
          </div>
          <div>
            <strong>Username:</strong> {orgData.username}
          </div>
          <div>
            <strong>Organization Name:</strong> {orgData.organizationName}
          </div>
        </div>
      ) : (
        <div className="authComponent">
          <Auth
            authConfig={authConfig}
            onHandleAuthSuccess={handleAuthSuccess}
          />
        </div>
      )}
    </main>
  );
}

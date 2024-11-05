"use client"

import styles from "./index.module.css";
import * as React from "react";
import { useState } from "react";
import { useTurnkey, Auth, AuthServerWrapper } from "@turnkey/sdk-react";
import { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";
import { Switch, Typography, IconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AppsIcon from '@mui/icons-material/Apps';

// Define types for config and socials
interface SocialConfig {
  enabled: boolean;
  google: boolean;
  apple: boolean;
}

interface Config {
  email: boolean;
  passkey: boolean;
  phone: boolean;
  socials: SocialConfig;
}

interface AuthPageProps {
  turnkeyClientConfig: {
    apiBaseUrl: string;
    defaultOrganizationId: string;
    apiPublicKey: string;
    apiPrivateKey: string;
  };
}

export default function AuthPage({turnkeyClientConfig}: AuthPageProps) {
  const { authIframeClient } = useTurnkey();
  const [orgData, setOrgData] = useState<any>();
  
  const handleAuthSuccess = async () => {
    const whoamiResponse = await authIframeClient!.getWhoami({
      organizationId: "51fb75bf-c044-4f9f-903b-4fba6bfedab9",
    });
    setOrgData(whoamiResponse as any)

  }

  const [config, setConfig] = useState<Config>({
    email: true,
    passkey: true,
    phone: true,
    socials: {
      enabled: true,
      google: true,
      apple: true,
    },
  });

  const toggleConfig = (key: keyof Config) => {
    setConfig((prev) => {
      const newConfig = { ...prev };
  
      if (key === "email") {
        newConfig.email = !prev.email;
        if (!newConfig.email) {
          newConfig.passkey = false; // Ensure passkey is off if email is off
        }
      } else if (key === "passkey") {
        newConfig.passkey = !prev.passkey;
        newConfig.email = newConfig.passkey; // Sync email with passkey's state
      } else if (key !== "socials") {
        newConfig[key] = !prev[key];
      }
  
      return newConfig;
    });
  };
  
  const toggleSocials = (key: keyof SocialConfig) => {
    setConfig((prev) => {
      if (key === 'enabled') {
        const isEnabled = !prev.socials.enabled;
        return {
          ...prev,
          socials: {
            enabled: isEnabled,
            google: isEnabled,
            apple: isEnabled,
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
      googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      appleClientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!,
      appleRedirectURI: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI!
    };
    navigator.clipboard.writeText(JSON.stringify(authConfig, null, 2));
    alert('Auth config copied to clipboard!');
  };

  const authConfig = {
    emailEnabled: config.email,
    passkeyEnabled: config.passkey,
    phoneEnabled: config.phone,
    appleEnabled: config.socials.apple,
    googleEnabled: config.socials.google,
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    appleClientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!,
    appleRedirectURI: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI!
  };

  return (
    <main className={styles.main}>
      {!orgData &&
      <div className={styles.authConfigCard}>
        <Typography variant="h6" className={styles.configTitle}>Authentication config</Typography>
        
        <div className={styles.toggleContainer}>
          <div className={styles.toggleRow}>
            <div className={styles.labelContainer}>
              <AppsIcon sx={{ color: 'var(--Greyscale-40, #D1D5DB)' }}/>
              <Typography>Email</Typography>
            </div>
            <Switch sx={{
              '& .MuiSwitch-switchBase.Mui-checked': {
                color: 'white',
              },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                backgroundColor: 'var(--Greyscale-900, #2b2f33)',
                opacity: 1,
              },
            }} checked={config.email} onChange={() => toggleConfig('email')} />
          </div>

          <div className={styles.toggleRow}>
            <div className={styles.labelContainer}>
              <AppsIcon sx={{ color: 'var(--Greyscale-40, #D1D5DB)' }}/>
              <Typography>Passkey</Typography>
            </div>
            <Switch sx={{
              '& .MuiSwitch-switchBase.Mui-checked': {
                color: 'white',
              },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                backgroundColor: 'var(--Greyscale-900, #2b2f33)',
                opacity: 1,
              },
            }} checked={config.passkey} onChange={() => toggleConfig('passkey')} />
          </div>

          <div className={styles.toggleRow}>
            <div className={styles.labelContainer}>
              <AppsIcon sx={{ color: 'var(--Greyscale-40, #D1D5DB)' }}/>
              <Typography>Phone</Typography>
            </div>
            <Switch sx={{
              '& .MuiSwitch-switchBase.Mui-checked': {
                color: 'white',
              },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                backgroundColor: 'var(--Greyscale-900, #2b2f33)',
                opacity: 1,
              },
            }} checked={config.phone} onChange={() => toggleConfig('phone')} />
          </div>

          <div className={styles.toggleRow}>
            <div className={styles.labelContainer}>
              <AppsIcon sx={{ color: 'var(--Greyscale-40, #D1D5DB)' }}/>
              <Typography>Socials</Typography>
            </div>
            <Switch sx={{
              '& .MuiSwitch-switchBase.Mui-checked': {
                color: 'white',
              },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                backgroundColor: 'var(--Greyscale-900, #2b2f33)',
                opacity: 1,
              },
            }} checked={config.socials.enabled} onChange={() => toggleSocials('enabled')} />
          </div>

          {config.socials.enabled && (
            <>
              <div className={styles.toggleRow}>
                <div className={styles.labelContainer}>
                  <Typography>Google</Typography>
                </div>
                <Switch sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: 'white',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: 'var(--Greyscale-900, #2b2f33)',
                    opacity: 1,
                  },
                }} checked={config.socials.google} onChange={() => toggleSocials('google')} />
              </div>
              <div className={styles.toggleRow}>
                <div className={styles.labelContainer}>
                  <Typography>Apple</Typography>
                </div>
                <Switch sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: 'white',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: 'var(--Greyscale-900, #2b2f33)',
                    opacity: 1,
                  },
                }} checked={config.socials.apple} onChange={() => toggleSocials('apple')} />
              </div>
            </>
          )}
        </div>

        <div className={styles.copyConfigButton} onClick={handleCopyConfig}>
          <ContentCopyIcon fontSize="small" />
          <div className={styles.copyConfigText}>
            <Typography variant="body2" className={styles.copyText}>Copy config</Typography>
          </div>
        </div>
      </div>
}
{orgData ?       

<div className={styles.success}>
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
:
      <div className={styles.authComponent}>
        
        <AuthServerWrapper authConfig={authConfig} onHandleAuthSuccess={handleAuthSuccess} />
      </div>
}
    </main>
  );
}


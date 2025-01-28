"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Auth, useTurnkey } from "@turnkey/sdk-react";
import { Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CustomSwitch from "./components/Switch";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DraggableProvided,
} from "@hello-pangea/dnd";
import "./index.css";
import { useRouter } from "next/navigation";
import Navbar from "./components/Navbar";
import { Toaster, toast } from "sonner";

// Define reusable types for provided props
type DroppableProvidedProps = DroppableProvided;
type DraggableProvidedProps = DraggableProvided;

// Define types for config and socials
interface SocialConfig {
  enabled: boolean;
  providers: {
    google: boolean;
    apple: boolean;
    facebook: boolean;
  };
}

interface Config {
  email: boolean;
  passkey: boolean;
  phone: boolean;
  socials: SocialConfig;
}

export default function AuthPage() {
  const router = useRouter();
  const handleAuthSuccess = async () => {
    router.push("/dashboard");
  };
  const { turnkey } = useTurnkey();
  const [configOrder, setConfigOrder] = useState([
    "socials",
    "email",
    "phone",
    "passkey",
  ]);

  const [config, setConfig] = useState<Config>({
    email: true,
    phone: false,
    passkey: true,
    socials: {
      enabled: true,
      providers: {
        google: true,
        apple: false,
        facebook: false,
      },
    },
  });

  useEffect(() => {
    const manageSession = async () => {
      if (turnkey) {
        const session = await turnkey?.getReadWriteSession();
        if (session && Date.now() < session.expiry) {
          await handleAuthSuccess();
        }
      }
    };
    manageSession();
  }, [turnkey]);

  const toggleConfig = (key: keyof Config) => {
    setConfig((prev) => {
      const newConfig = { ...prev };
      if (key !== "socials") {
        newConfig[key] = !prev[key];
      }
      return newConfig;
    });
  };

  const toggleSocials = (
    key: keyof SocialConfig | keyof SocialConfig["providers"],
  ) => {
    setConfig((prev) => {
      if (key === "enabled") {
        const isEnabled = !prev.socials.enabled;
        return {
          ...prev,
          socials: {
            enabled: isEnabled,
            providers: {
              google: isEnabled,
              apple: isEnabled,
              facebook: isEnabled,
            },
          },
        };
      }

      if (prev.socials.enabled && key in prev.socials.providers) {
        return {
          ...prev,
          socials: {
            ...prev.socials,
            providers: {
              ...prev.socials.providers,
              [key]:
                !prev.socials.providers[key as keyof SocialConfig["providers"]],
            },
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
      appleEnabled: config.socials.providers.apple,
      googleEnabled: config.socials.providers.google,
      facebookEnabled: config.socials.providers.facebook,
    };

    const configToCopy = {
      authConfig,
      configOrder,
    };
    navigator.clipboard.writeText(JSON.stringify(configToCopy, null, 2));
    toast.success("Copied to clipboard!");
  };

  const authConfig = {
    emailEnabled: config.email,
    passkeyEnabled: config.passkey,
    phoneEnabled: config.phone,
    appleEnabled: config.socials.providers.apple,
    googleEnabled: config.socials.providers.google,
    facebookEnabled: config.socials.providers.facebook,
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    if (!destination) return;

    const reorderedConfig = Array.from(configOrder);
    const [movedItem] = reorderedConfig.splice(source.index, 1);
    reorderedConfig.splice(destination.index, 0, movedItem);

    setConfigOrder(reorderedConfig);
  };

  return (
    <main className="main">
      <Navbar />
      <div className="authConfigCard">
        <div className="configTitle">Authentication config</div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="configList">
            {(provided: DroppableProvidedProps) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="toggleContainer"
              >
                {configOrder.map((key, index) =>
                  key === "socials" ? (
                    <Draggable
                      key="socials"
                      draggableId="socials"
                      index={index}
                      isDragDisabled={!config.socials.enabled}
                    >
                      {(provided: DraggableProvidedProps) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="socialContainer"
                        >
                          <div
                            {...(provided.dragHandleProps || {})}
                            className="toggleSocialRow"
                          >
                            <div className="labelContainer">
                              <img src="/dots.svg" alt="Drag handle" />
                              <Typography>Socials</Typography>
                            </div>
                            <CustomSwitch
                              checked={config.socials.enabled}
                              onChange={() => toggleSocials("enabled")}
                            />
                          </div>
                          {Object.entries(config.socials.providers).map(
                            ([provider, enabled]) => (
                              <div
                                key={provider}
                                className="toggleSocialIndividualRow"
                                style={{
                                  borderRadius:
                                    provider === "google"
                                      ? "8px 8px 0 0"
                                      : provider === "facebook"
                                        ? "0 0 8px 8px"
                                        : undefined,
                                }}
                              >
                                <div className="labelContainer">
                                  <img
                                    src={`/${provider}.svg`}
                                    className="iconSmall"
                                  />
                                  <Typography>
                                    {provider.charAt(0).toUpperCase() +
                                      provider.slice(1)}
                                  </Typography>
                                </div>
                                <CustomSwitch
                                  checked={enabled}
                                  onChange={() =>
                                    toggleSocials(
                                      provider as keyof SocialConfig["providers"],
                                    )
                                  }
                                />
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </Draggable>
                  ) : (
                    <Draggable
                      key={key}
                      draggableId={key}
                      index={index}
                      isDragDisabled={
                        key !== "socials" &&
                        (!config[key as keyof Config] as boolean)
                      }
                    >
                      {(provided: DraggableProvidedProps) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...(provided.dragHandleProps || {})}
                          className="toggleRow"
                        >
                          <div className="labelContainer">
                            <img src="/dots.svg" alt="Drag handle" />
                            <Typography>
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                            </Typography>
                          </div>
                          <CustomSwitch
                            checked={config[key as keyof Config] as boolean}
                            onChange={() => toggleConfig(key as keyof Config)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ),
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div className="copyConfigButton" onClick={handleCopyConfig}>
          <ContentCopyIcon fontSize="small" />
          <div className="copyConfigText">
            <Typography variant="body2" className="copyText">
              Copy config
            </Typography>
          </div>
        </div>
      </div>
      <div className="authComponent">
        <Auth
          authConfig={authConfig}
          configOrder={configOrder}
          onAuthSuccess={handleAuthSuccess}
          onError={(errorMessage: string) => toast.error(errorMessage)}
          customSmsMessage={"Your Turnkey Demo OTP is {{.OtpCode}}"}
        />
      </div>
      <div>
        <Toaster
          position="bottom-right"
          toastOptions={{ className: "sonner-toaster", duration: 2500 }}
        />
      </div>
    </main>
  );
}

"use client";

import * as React from "react";
import { useState } from "react";
import { Auth } from "@turnkey/sdk-react";
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
  const router = useRouter();
  const handleAuthSuccess = async () => {
    router.push("/dashboard");
  };

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
      google: true,
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
    appleEnabled: config.socials.apple,
    googleEnabled: config.socials.google,
    facebookEnabled: config.socials.facebook,
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
        <Typography variant="h6" className="configTitle">
          Authentication config
        </Typography>

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
                  )
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
          onHandleAuthSuccess={handleAuthSuccess}
          onError={(errorMessage: string) => toast.error(errorMessage)}
        />
      </div>
      <div>
        <Toaster
          position="bottom-right"
          toastOptions={{ className: "sonner-toaster" }}
        />
      </div>
    </main>
  );
}

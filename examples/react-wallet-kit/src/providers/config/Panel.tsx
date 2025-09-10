import {
  faCheck,
  faGamepad,
  faGears,
  faGripLines,
  faPalette,
  faUserLock,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { Draggable, DragDropContext, Droppable } from "@hello-pangea/dnd";
import { useTurnkeyConfig } from "./ConfigProvider";
import { ToggleSwitch } from "@/components/Switch";
import { SliderField } from "@/components/Slider";
import { ColourPicker } from "@/components/Color";
import { PanelDisclosure } from "@/components/Disclosure";
import { useEffect } from "react";
import { TurnkeyProviderConfig } from "@turnkey/react-wallet-kit";
import ConfigViewer from "@/components/demo/ConfigViewer";
import { completeTheme, textColour } from "@/utils";
import { Button, Checkbox } from "@headlessui/react";
import { DemoConfig } from "@/types";
import {
  AppleSVG,
  DiscordSVG,
  FacebookSVG,
  GoogleSVG,
  TwitterXSVG,
} from "@/components/Svg";

const omitKeys = [
  "apiBaseUrl",
  "authProxyUrl",
  "importIframeUrl",
  "exportIframeUrl",
  "googleClientId",
  "appleClientId",
  "facebookClientId",
  "oauthRedirectUri",
  "walletConfig",
  "renderModalInProvider",
  "oauthOrder",
  "organizationId",
  "authProxyConfigId",
  "createSuborgParams",
  "autoRefreshSession",
  "oauthConfig",
];

interface AuthMethod {
  name: string;
  toggles: {
    toggle: string;
    overrideDisplayName?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  }[];
  order: "socials" | "email" | "sms" | "passkey" | "wallet";
}

const authMethods: AuthMethod[] = [
  {
    name: "OAuth",
    toggles: [
      {
        overrideDisplayName: "Google",
        toggle: "googleOauthEnabled",
        icon: GoogleSVG,
      },
      {
        overrideDisplayName: "Apple",
        toggle: "appleOauthEnabled",
        icon: AppleSVG,
      },
      {
        overrideDisplayName: "Facebook",
        toggle: "facebookOauthEnabled",
        icon: FacebookSVG,
      },
      {
        overrideDisplayName: "X (Twitter)",
        toggle: "xOauthEnabled",
        icon: TwitterXSVG,
      },
      {
        overrideDisplayName: "Discord",
        toggle: "discordOauthEnabled",
        icon: DiscordSVG,
      },
    ],
    order: "socials",
  },
  {
    name: "Email OTP",
    toggles: [{ toggle: "emailOtpAuthEnabled" }],
    order: "email",
  },
  { name: "SMS OTP", toggles: [{ toggle: "smsOtpAuthEnabled" }], order: "sms" },
  {
    name: "Passkey",
    toggles: [{ toggle: "passkeyAuthEnabled" }],
    order: "passkey",
  },
  {
    name: "Wallet",
    toggles: [{ toggle: "walletAuthEnabled" }],
    order: "wallet",
  },
];

export function TurnkeyConfigPanel() {
  const {
    config,
    demoConfig,
    initialConfig,
    hardwareAccelerationEnabled,
    setConfig,
  } = useTurnkeyConfig();

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const currentOrder = config.auth?.methodOrder ?? [];
    const reordered = Array.from(currentOrder);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    handleSetConfig({
      auth: {
        ...config.auth,
        methodOrder: reordered,
      },
    });
  };

  const handleSetConfig = async (
    newConfig: Partial<TurnkeyProviderConfig>,
    newDemoConfig?: Partial<DemoConfig>,
  ) => {
    setConfig({ ...config, ...newConfig }, { ...demoConfig, ...newDemoConfig });
    storeConfig(
      { ...config, ...newConfig },
      { ...demoConfig, ...newDemoConfig },
    );
  };

  // Store config in local storage
  const storeConfig = (
    config: Partial<TurnkeyProviderConfig>,
    demoConfig?: Partial<DemoConfig>,
  ) => {
    // store everything but the omitted keys in local storage
    const filteredConfig = Object.fromEntries(
      Object.entries(config).filter(([key]) => !omitKeys.includes(key)),
    );

    localStorage.setItem("turnkeyConfig", JSON.stringify(filteredConfig));
    localStorage.setItem("turnkeyDemoConfig", JSON.stringify(demoConfig));
  };

  useEffect(() => {
    // Load config from local storage
    const loadConfig = () => {
      const storedConfig = localStorage.getItem("turnkeyConfig");
      const storedDemoConfig = localStorage.getItem("turnkeyDemoConfig");
      if (storedConfig) {
        setConfig(JSON.parse(storedConfig));
      }
      if (storedDemoConfig) {
        setConfig({}, JSON.parse(storedDemoConfig));
      }
    };
    loadConfig();
  }, []);

  return (
    <div className="space-y-11 overflow-y-auto tk-scrollbar pr-1">
      {/* Auth Methods with Reordering & Toggle */}
      <PanelDisclosure
        icon={<FontAwesomeIcon icon={faUserLock} />}
        title="Auth"
      >
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="methodOrder">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2"
              >
                {(config.auth?.methodOrder ?? []).map((methodKey, index) => {
                  const method = authMethods.find(
                    (m) => m.order === methodKey,
                  )!;
                  const someEnabled = method.toggles.some(
                    (key) =>
                      config.auth?.methods?.[
                        key.toggle as keyof typeof config.auth.methods
                      ] ?? false,
                  );
                  return (
                    <Draggable
                      key={method.order}
                      draggableId={method.order}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="bg-draggable-background-light dark:bg-draggable-background-dark px-3 py-2 rounded shadow-sm space-y-2"
                        >
                          <div className="flex flex-row gap-2 items-center">
                            <FontAwesomeIcon icon={faGripLines} />
                            {/* Top Row: Name + Master Toggle */}
                            <div className="flex-1">
                              <ToggleSwitch
                                label={method.name}
                                checked={someEnabled}
                                onChange={(val) => {
                                  const newToggles = method.toggles.reduce(
                                    (acc, { toggle }) => {
                                      acc[toggle] = val;
                                      return acc;
                                    },
                                    {} as Record<string, boolean>,
                                  );

                                  handleSetConfig({
                                    auth: {
                                      ...config.auth,
                                      methods: {
                                        ...config.auth?.methods,
                                        ...newToggles,
                                      },
                                    },
                                  });
                                }}
                              />
                            </div>
                          </div>

                          {/* Individual Toggles */}
                          {method.toggles.length > 1 && (
                            <div className="flex flex-col justify-between mt-3 w-full">
                              {method.toggles.map((toggleKey) => {
                                const isChecked =
                                  config.auth?.methods?.[
                                    toggleKey.toggle as keyof typeof config.auth.methods
                                  ] ?? false;
                                return (
                                  <Checkbox
                                    key={toggleKey.toggle}
                                    className="flex justify-between items-center cursor-pointer py-1.5"
                                    checked={isChecked}
                                    onChange={(val: boolean) =>
                                      handleSetConfig({
                                        auth: {
                                          ...config.auth,
                                          methods: {
                                            ...config.auth?.methods,
                                            [toggleKey.toggle]: val,
                                          },
                                        },
                                      })
                                    }
                                  >
                                    <p className="flex items-center">
                                      {toggleKey?.icon && (
                                        <toggleKey.icon className="mr-3 size-5.5" />
                                      )}
                                      {toggleKey?.overrideDisplayName ||
                                        toggleKey.toggle}
                                    </p>
                                    <div
                                      className={`rounded-md flex items-center justify-center size-5.5 border-2 ${isChecked ? "bg-primary-light dark:bg-primary-dark border-transparent" : "bg-transparent border-primary-text-light dark:border-primary-text-dark"} transition-colors`}
                                    >
                                      <FontAwesomeIcon
                                        icon={faCheck}
                                        className={`size-4 text-primary-text-light dark:text-primary-text-dark ${isChecked ? "" : "invisible"}`}
                                      />
                                    </div>
                                  </Checkbox>
                                );
                              })}

                              {method.name === "OAuth" && (
                                <>
                                  <div className="w-full my-3 h-[1px] bg-icon-text-light dark:bg-icon-text-dark" />
                                  <ToggleSwitch
                                    label="Open OAuth In Page"
                                    size="sm"
                                    checked={
                                      config.auth?.oauthConfig
                                        ?.openOauthInPage ?? false
                                    }
                                    onChange={(val) =>
                                      handleSetConfig({
                                        auth: {
                                          ...config.auth,
                                          oauthConfig: {
                                            ...config.auth?.oauthConfig,
                                            openOauthInPage: val,
                                          },
                                        },
                                      })
                                    }
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </PanelDisclosure>

      {/* UI Toggles */}
      <PanelDisclosure title="UI" icon={<FontAwesomeIcon icon={faPalette} />}>
        <>
          <ToggleSwitch
            label="Dark Mode"
            checked={config.ui?.darkMode ?? false}
            onChange={(val) =>
              handleSetConfig({
                ui: {
                  ...config.ui,
                  darkMode: val,
                },
              })
            }
          />
          <ColourPicker
            label="Primary Color"
            value={
              !config.ui?.darkMode
                ? config.ui?.colors?.light?.primary || "#000000"
                : config.ui?.colors?.dark?.primary || "#000000"
            }
            onChange={(val) => {
              const primaryText = textColour(val);
              handleSetConfig({
                ui: {
                  ...config.ui,
                  colors: !config.ui?.darkMode
                    ? {
                        ...config.ui?.colors,
                        light: {
                          ...config.ui?.colors?.light,
                          primary: val,
                          primaryText,
                        },
                      }
                    : {
                        ...config.ui?.colors,
                        dark: {
                          ...config.ui?.colors?.dark,
                          primary: val,
                          primaryText,
                        },
                      },
                },
              });
            }}
          />
          <ColourPicker
            label="Primary Background"
            value={
              !config.ui?.darkMode
                ? config.ui?.colors?.light?.modalBackground || "#000000"
                : config.ui?.colors?.dark?.modalBackground || "#000000"
            }
            onChange={(val) => {
              const newColors = completeTheme(val);

              handleSetConfig(
                {
                  ui: {
                    ...config.ui,
                    colors: !config.ui?.darkMode
                      ? {
                          ...config.ui?.colors,
                          light: {
                            ...config.ui?.colors?.light,
                            modalBackground: val,
                            modalText: textColour(val, true),
                            iconBackground: newColors.iconBackground,
                            iconText: newColors.iconText,
                            button: newColors.buttonBackground,
                          },
                        }
                      : {
                          ...config.ui?.colors,
                          dark: {
                            ...config.ui?.colors?.dark,
                            modalBackground: val,
                            modalText: textColour(val, true),
                            iconBackground: newColors.iconBackground,
                            iconText: newColors.iconText,
                            button: newColors.buttonBackground,
                          },
                        },
                  },
                },
                {
                  ui: !config.ui?.darkMode
                    ? {
                        ...demoConfig.ui,
                        light: {
                          background: newColors.background,
                          text: textColour(newColors.background, true),
                          panelBackground: newColors.panelBackground,
                          draggableBackground: newColors.draggableBackground,
                        },
                      }
                    : {
                        ...demoConfig.ui,
                        dark: {
                          background: newColors.background,
                          text: textColour(newColors.background, true),
                          panelBackground: newColors.panelBackground,
                          draggableBackground: newColors.draggableBackground,
                        },
                      },
                },
              );
            }}
          />

          <SliderField
            label="Border Radius"
            min={0}
            max={48}
            step={2}
            suffix="px"
            value={config.ui?.borderRadius as number}
            onChange={(val) =>
              handleSetConfig({
                ui: {
                  ...config.ui,
                  borderRadius: val || 0,
                },
              })
            }
          />

          <SliderField
            label="Background Blur"
            min={0}
            max={20}
            step={1}
            suffix="px"
            value={config.ui?.backgroundBlur as number}
            onChange={(val) =>
              handleSetConfig({
                ui: {
                  ...config.ui,
                  backgroundBlur: val || 0,
                },
              })
            }
          />

          <ToggleSwitch
            label="Prefer Large Action Buttons"
            checked={config.ui?.preferLargeActionButtons ?? false}
            onChange={(val) =>
              handleSetConfig({
                ui: {
                  ...config.ui,
                  preferLargeActionButtons: val,
                },
              })
            }
          />
        </>
      </PanelDisclosure>
      <PanelDisclosure
        title="Demo Options"
        icon={<FontAwesomeIcon icon={faGamepad} />}
      >
        <p className="text-xs text-icon-text-light dark:text-icon-text-dark">
          These settings are just for the demo, they do not affect the
          TurnkeyProvider config.
        </p>
        <ToggleSwitch
          label="3D Background Enabled"
          checked={
            hardwareAccelerationEnabled
              ? (demoConfig.backgroundEnabled ?? false)
              : false
          }
          disabled={!hardwareAccelerationEnabled}
          tooltip={
            !hardwareAccelerationEnabled
              ? "Hardware acceleration is not enabled."
              : ""
          }
          onChange={(val) =>
            handleSetConfig({}, { backgroundEnabled: val, ui: demoConfig.ui })
          }
        />
      </PanelDisclosure>
      <PanelDisclosure title="Config" icon={<FontAwesomeIcon icon={faGears} />}>
        <p className="text-xs text-icon-text-light dark:text-icon-text-dark">
          Paste this config into your TurnkeyProvider config to use in your own
          app.
        </p>
        <ConfigViewer />
      </PanelDisclosure>
      <Button
        className="w-full hover:cursor-pointer p-2 text-sm rounded-md bg-primary-light dark:bg-primary-dark text-primary-text-light dark:text-primary-text-dark hover:bg-primary-light/90 dark:hover:bg-primary-dark/90 transition-colors"
        onClick={() => {
          handleSetConfig(initialConfig, {
            backgroundEnabled: demoConfig.backgroundEnabled,
            ui: undefined,
          });
        }}
      >
        Reset to Defaults
      </Button>
    </div>
  );
}

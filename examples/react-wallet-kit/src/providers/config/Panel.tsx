import {
  Disclosure,
  DisclosurePanel,
  DisclosureButton,
  Transition,
} from "@headlessui/react";
import { faChevronDown, faGripLines } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { Draggable, DragDropContext, Droppable } from "@hello-pangea/dnd";
import { useTurnkeyConfig } from "./ConfigProvider";
import { ToggleSwitch } from "@/components/Switch";
import { SliderField } from "@/components/Slider";
import { ColourPicker } from "@/components/Color";
import { PanelDisclosure } from "@/components/Disclosure";

interface AuthMethod {
  name: string;
  toggles: { toggle: string; overrideDisplayName?: string }[];
  order: "socials" | "email" | "sms" | "passkey" | "wallet";
}

const authMethods: AuthMethod[] = [
  {
    name: "Socials",
    toggles: [
      { overrideDisplayName: "Google", toggle: "googleOAuthEnabled" },
      { overrideDisplayName: "Apple", toggle: "appleOAuthEnabled" },
      { overrideDisplayName: "Facebook", toggle: "facebookOAuthEnabled" },
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
  const { config, setConfig } = useTurnkeyConfig();

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const currentOrder = config.auth?.methodOrder ?? [];
    const reordered = Array.from(currentOrder);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    setConfig({
      auth: {
        ...config.auth,
        methodOrder: reordered,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Auth Methods with Reordering & Toggle */}
      <PanelDisclosure title="Auth">
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
                  const allEnabled = method.toggles.every(
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
                                checked={allEnabled}
                                onChange={(val) => {
                                  const newToggles = method.toggles.reduce(
                                    (acc, { toggle }) => {
                                      acc[toggle] = val;
                                      return acc;
                                    },
                                    {} as Record<string, boolean>,
                                  );

                                  setConfig({
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
                            <div className="space-y-1">
                              {method.toggles.map((toggleKey) => (
                                <ToggleSwitch
                                  key={toggleKey.toggle}
                                  size="sm"
                                  label={
                                    toggleKey?.overrideDisplayName ||
                                    toggleKey.toggle
                                  }
                                  checked={
                                    config.auth?.methods?.[
                                      toggleKey.toggle as keyof typeof config.auth.methods
                                    ] ?? false
                                  }
                                  onChange={(val) =>
                                    setConfig({
                                      auth: {
                                        ...config.auth,
                                        methods: {
                                          ...config.auth?.methods,
                                          [toggleKey.toggle]: val,
                                        },
                                      },
                                    })
                                  }
                                />
                              ))}

                              {method.name === "Socials" && (
                                <>
                                  <div className="w-full h-[1px] mb-2 mt-3 bg-gray-300" />
                                  <ToggleSwitch
                                    label="Open OAuth In Page"
                                    size="sm"
                                    checked={
                                      config.auth?.oAuthConfig
                                        ?.openOAuthInPage ?? false
                                    }
                                    onChange={(val) =>
                                      setConfig({
                                        auth: {
                                          ...config.auth,
                                          oAuthConfig: {
                                            ...config.auth?.oAuthConfig,
                                            openOAuthInPage: val,
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
      <PanelDisclosure title="UI">
        <>
          <ToggleSwitch
            label="Dark Mode"
            checked={config.ui?.darkMode ?? false}
            onChange={(val) =>
              setConfig({
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
            onChange={(val) =>
              setConfig({
                ui: {
                  ...config.ui,
                  colors: !config.ui?.darkMode
                    ? {
                        ...config.ui?.colors,
                        light: {
                          ...config.ui?.colors?.light,
                          primary: val,
                        },
                      }
                    : {
                        ...config.ui?.colors,
                        dark: {
                          ...config.ui?.colors?.dark,
                          primary: val,
                        },
                      },
                },
              })
            }
          />

          <SliderField
            label="Border Radius"
            min={0}
            max={48}
            step={2}
            suffix="px"
            value={config.ui?.borderRadius as number}
            onChange={(val) =>
              setConfig({
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
              setConfig({
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
              setConfig({
                ui: {
                  ...config.ui,
                  preferLargeActionButtons: val,
                },
              })
            }
          />
        </>
      </PanelDisclosure>
    </div>
  );
}

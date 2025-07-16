import {
  Disclosure,
  Switch,
  Listbox,
  Transition,
  DisclosurePanel,
  DisclosureButton,
} from "@headlessui/react";
import { faChevronDown, faGripLines } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { Draggable, DragDropContext, Droppable } from "@hello-pangea/dnd";
import { useTurnkeyConfig } from "./ConfigProvider";

const authMethods = [
  {
    name: "Socials",
    toggles: [
      "googleOAuthEnabled",
      "appleOAuthEnabled",
      "facebookOAuthEnabled",
    ],
    order: "socials",
  },
  { name: "Email OTP", toggles: ["emailOtpAuthEnabled"], order: "email" },
  { name: "SMS OTP", toggles: ["smsOtpAuthEnabled"], order: "sms" },
  { name: "Passkey", toggles: ["passkeyAuthEnabled"], order: "passkey" },
  { name: "Wallet", toggles: ["walletAuthEnabled"], order: "wallet" },
];

const defaultMethodOrder = ["socials", "email", "sms", "passkey", "wallet"];

//const oauthOrderList = ["google", "apple", "facebook"];

export function TurnkeyConfigPanel() {
  const { config, setConfig } = useTurnkeyConfig();

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const currentOrder = config.auth?.methodOrder ?? defaultMethodOrder;
    const reordered = Array.from(currentOrder);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    setConfig({
      auth: {
        ...config.auth,
        methodOrder: reordered as (
          | "socials"
          | "email"
          | "sms"
          | "passkey"
          | "wallet"
        )[],
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Auth Methods with Reordering & Toggle */}
      <Disclosure defaultOpen>
        {({ open }) => (
          <div>
            <DisclosureButton className="flex justify-between w-full font-semibold">
              <span>Auth Methods</span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}
              />
            </DisclosureButton>
            <DisclosurePanel className="mt-2">
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="methodOrder">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2"
                    >
                      {(config.auth?.methodOrder ?? defaultMethodOrder).map(
                        (methodKey, index) => {
                          const method = authMethods.find(
                            (m) => m.order === methodKey,
                          )!;
                          const allEnabled = method.toggles.every(
                            (key) =>
                              config.auth?.methods?.[
                                key as keyof typeof config.auth.methods
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
                                  className="bg-gray-100 px-3 py-2 rounded shadow-sm space-y-2"
                                >
                                  {/* Top Row: Name + Master Toggle */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <FontAwesomeIcon
                                        icon={faGripLines}
                                        className="text-gray-400"
                                      />
                                      <span className="text-sm">
                                        {method.name}
                                      </span>
                                    </div>
                                    <Switch
                                      checked={allEnabled}
                                      onChange={(val) => {
                                        const newToggles =
                                          method.toggles.reduce(
                                            (acc, toggle) => {
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
                                      className={`${
                                        allEnabled
                                          ? "bg-blue-600"
                                          : "bg-gray-300"
                                      } relative inline-flex h-5 w-10 items-center rounded-full transition`}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                          allEnabled
                                            ? "translate-x-5"
                                            : "translate-x-1"
                                        }`}
                                      />
                                    </Switch>
                                  </div>

                                  {/* Individual Toggles */}
                                  {method.toggles.length > 1 && (
                                    <div className="pl-6 space-y-1">
                                      {method.toggles.map((toggleKey) => (
                                        <div
                                          key={toggleKey}
                                          className="flex items-center justify-between"
                                        >
                                          <span className="text-xs text-gray-600">
                                            {toggleKey}
                                          </span>
                                          <Switch
                                            checked={
                                              config.auth?.methods?.[
                                                toggleKey as keyof typeof config.auth.methods
                                              ] ?? false
                                            }
                                            onChange={(val) =>
                                              setConfig({
                                                auth: {
                                                  ...config.auth,
                                                  methods: {
                                                    ...config.auth?.methods,
                                                    [toggleKey]: val,
                                                  },
                                                },
                                              })
                                            }
                                            className={`${
                                              config.auth?.methods?.[
                                                toggleKey as keyof typeof config.auth.methods
                                              ]
                                                ? "bg-blue-600"
                                                : "bg-gray-300"
                                            } relative inline-flex h-4 w-8 items-center rounded-full transition`}
                                          >
                                            <span
                                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${
                                                config.auth?.methods?.[
                                                  toggleKey as keyof typeof config.auth.methods
                                                ]
                                                  ? "translate-x-4"
                                                  : "translate-x-1"
                                              }`}
                                            />
                                          </Switch>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        },
                      )}

                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </DisclosurePanel>
          </div>
        )}
      </Disclosure>

      {/* OAuth In Page */}
      <Disclosure defaultOpen>
        {({ open }) => (
          <div>
            <DisclosureButton className="flex justify-between w-full font-semibold">
              <span>OAuth Settings</span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}
              />
            </DisclosureButton>
            <DisclosurePanel className="mt-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Open OAuth In Page</span>
                <Switch
                  checked={config.auth?.oAuthConfig?.openOAuthInPage ?? false}
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
                  className={`${config.auth?.oAuthConfig?.openOAuthInPage ? "bg-blue-600" : "bg-gray-300"} relative inline-flex h-5 w-10 items-center rounded-full transition`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${config.auth?.oAuthConfig?.openOAuthInPage ? "translate-x-5" : "translate-x-1"}`}
                  />
                </Switch>
              </div>
            </DisclosurePanel>
          </div>
        )}
      </Disclosure>

      {/* UI Toggles (darkMode, preferLargeActionButtons, etc) */}
      <Disclosure defaultOpen>
        {({ open }) => (
          <div>
            <DisclosureButton className="flex justify-between w-full font-semibold">
              <span>UI Settings</span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}
              />
            </DisclosureButton>
            <DisclosurePanel className="mt-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Dark Mode</span>
                <Switch
                  checked={config.ui?.darkMode ?? false}
                  onChange={(val) =>
                    setConfig({
                      ui: {
                        ...config.ui,
                        darkMode: val,
                      },
                    })
                  }
                  className={`${config.ui?.darkMode ? "bg-blue-600" : "bg-gray-300"} relative inline-flex h-5 w-10 items-center rounded-full transition`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${config.ui?.darkMode ? "translate-x-5" : "translate-x-1"}`}
                  />
                </Switch>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Prefer Large Action Buttons</span>
                <Switch
                  checked={config.ui?.preferLargeActionButtons ?? false}
                  onChange={(val) =>
                    setConfig({
                      ui: {
                        ...config.ui,
                        preferLargeActionButtons: val,
                      },
                    })
                  }
                  className={`${config.ui?.preferLargeActionButtons ? "bg-blue-600" : "bg-gray-300"} relative inline-flex h-5 w-10 items-center rounded-full transition`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${config.ui?.preferLargeActionButtons ? "translate-x-5" : "translate-x-1"}`}
                  />
                </Switch>
              </div>
            </DisclosurePanel>
          </div>
        )}
      </Disclosure>
    </div>
  );
}

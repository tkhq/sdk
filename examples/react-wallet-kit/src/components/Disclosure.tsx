import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Transition,
} from "@headlessui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { type ReactNode } from "react";

interface PanelDisclosureProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function PanelDisclosure(props: PanelDisclosureProps) {
  const { title, icon, children, defaultOpen = true } = props;
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div>
          <DisclosureButton className="flex justify-between w-full font-semibold cursor-pointer">
            <div className="flex items-center gap-3">
              {icon}
              <span>{title}</span>
            </div>

            <FontAwesomeIcon
              icon={faChevronDown}
              className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}
            />
          </DisclosureButton>

          <Transition
            show={open}
            enter="transition-all duration-150 ease-out"
            enterFrom="opacity-0 max-h-0 -translate-y-6"
            enterTo="opacity-100 max-h-[1000px] translate-y-0"
            leave="transition-all duration-150 ease-in-out"
            leaveFrom="opacity-100 max-h-[1000px] translate-y-0"
            leaveTo="opacity-0 max-h-0 -translate-y-6"
          >
            <DisclosurePanel
              transition
              className="overflow-hidden mt-2 space-y-3"
            >
              {children}
            </DisclosurePanel>
          </Transition>
        </div>
      )}
    </Disclosure>
  );
}

interface InputPanelDisclosureProps {
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
}

export function InputPanelDisclosure({
  value,
  setValue,
  children,
  defaultOpen = true,
  placeholder,
}: InputPanelDisclosureProps) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div>
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full shadow px-2 py-1 rounded-lg bg-background-light dark:bg-background-dark focus:outline-none"
              placeholder={placeholder}
            />
            <DisclosureButton className="flex justify-between w-fit font-semibold cursor-pointer">
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}
              />
            </DisclosureButton>
          </div>

          <Transition
            show={open}
            enter="transition-all duration-150 ease-out"
            enterFrom="opacity-0 max-h-0 -translate-y-6"
            enterTo="opacity-100 max-h-[1000px] translate-y-0"
            leave="transition-all duration-150 ease-in-out"
            leaveFrom="opacity-100 max-h-[1000px] translate-y-0"
            leaveTo="opacity-0 max-h-0 -translate-y-6"
          >
            <DisclosurePanel
              transition
              className="overflow-hidden mt-2 space-y-3"
            >
              {children}
            </DisclosurePanel>
          </Transition>
        </div>
      )}
    </Disclosure>
  );
}

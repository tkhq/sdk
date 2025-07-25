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
  children: ReactNode;
  defaultOpen?: boolean;
}

export function PanelDisclosure(props: PanelDisclosureProps) {
  const { title, children, defaultOpen = true } = props;
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div>
          <DisclosureButton className="flex justify-between w-full font-semibold cursor-pointer">
            <span>{title}</span>
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

import { Transition } from "@headlessui/react";
import clsx from "clsx";
import { useState, type ReactNode } from "react";
import { BaseButton } from "./Buttons";

export type TabNavItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
};

export type TabNavProps = {
  tabs: TabNavItem[];
  defaultTab?: string;
};

export function TabNav(props: TabNavProps) {
  const { tabs, defaultTab } = props;
  const [selectedId, setSelectedId] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [animate, setAnimate] = useState(false);
  const selected = tabs.find((tab) => tab.id === selectedId) ?? tabs[0];
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === selected?.id),
  );

  const selectTab = (id: string) => {
    if (id === selected?.id) return;
    const nextIndex = tabs.findIndex((tab) => tab.id === id);
    const currentIndex = tabs.findIndex((tab) => tab.id === selected?.id);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setAnimate(true);
    setSelectedId(id);
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="relative flex w-full rounded-md">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 rounded-md bg-button-light transition-transform duration-300 ease-out dark:bg-button-dark"
          style={{
            width: `${100 / Math.max(tabs.length, 1)}%`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
        />
        {tabs.map((tab) => {
          const active = tab.id === selected?.id;
          return (
            <BaseButton
              key={tab.id}
              type="button"
              name={`tab-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              className={clsx(
                "relative z-10 flex flex-1 items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-transparent bg-transparent focus:outline-primary-light focus:dark:outline-primary-dark focus:outline-[1px] focus:outline-offset-0 transition-colors duration-200",
                active
                  ? "text-primary-text-light dark:text-primary-text-dark"
                  : "text-primary-text-light/70 dark:text-primary-text-dark/70",
              )}
            >
              {tab.icon}
              {tab.label}
            </BaseButton>
          );
        })}
      </div>
      <div className="w-full overflow-x-clip p-0.5">
        <Transition
          key={selected?.id}
          appear={animate}
          show
          as="div"
          enter="transition ease-out duration-200"
          enterFrom={
            direction > 0
              ? "opacity-30 translate-x-4"
              : "opacity-30 -translate-x-4"
          }
          enterTo="opacity-100 translate-x-0"
        >
          {selected?.content}
        </Transition>
      </div>
    </div>
  );
}

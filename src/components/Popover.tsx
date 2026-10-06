import * as RadixPopover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

import styles from "./Popover.module.css";

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  width?: number;
}

/** Riquadro che si apre sotto un pulsante (filtri, scelte rapide). */
export function Popover({ trigger, children, align = "start", width = 260 }: PopoverProps) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content className={styles.content} align={align} sideOffset={6} style={{ width }}>
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

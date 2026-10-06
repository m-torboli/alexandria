// Menu contestuali (tasto destro) e a tendina con un unico stile.

import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import clsx from "clsx";

import styles from "./Menu.module.css";

type ItemProps = {
  icon?: ReactNode;
  children: ReactNode;
  destructive?: boolean;
  shortcut?: string;
};

function ItemBody({ icon, children, shortcut }: ItemProps) {
  return (
    <>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{children}</span>
      {shortcut && <span className={styles.shortcut}>{shortcut}</span>}
    </>
  );
}

// ── Menu contestuale ────────────────────────────────────────────────────────

export const ContextRoot = ContextMenu.Root;
export const ContextTrigger = ContextMenu.Trigger;

export function ContextContent({ children }: { children: ReactNode }) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Content className={styles.content}>{children}</ContextMenu.Content>
    </ContextMenu.Portal>
  );
}

export function ContextItem({
  icon,
  children,
  shortcut,
  destructive,
  className,
  ...props
}: ItemProps & Omit<ComponentProps<typeof ContextMenu.Item>, "children">) {
  return (
    <ContextMenu.Item className={clsx(styles.item, destructive && styles.destructive, className)} {...props}>
      <ItemBody icon={icon} shortcut={shortcut}>
        {children}
      </ItemBody>
    </ContextMenu.Item>
  );
}

export function ContextSeparator() {
  return <ContextMenu.Separator className={styles.separator} />;
}

export function ContextSub({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger className={styles.item}>
        <ItemBody icon={icon}>{label}</ItemBody>
        <ChevronRight size={13} className={styles.subArrow} />
      </ContextMenu.SubTrigger>
      <ContextMenu.Portal>
        <ContextMenu.SubContent className={styles.content} sideOffset={4} alignOffset={-5}>
          {children}
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
}

export function ContextCheckItem({
  icon,
  children,
  checked,
  onSelect,
}: ItemProps & { checked: boolean; onSelect: () => void }) {
  return (
    <ContextMenu.Item className={styles.item} onSelect={onSelect}>
      <ItemBody icon={icon}>{children}</ItemBody>
      <span className={styles.check}>{checked && <Check size={13} />}</span>
    </ContextMenu.Item>
  );
}

// ── Menu a tendina ──────────────────────────────────────────────────────────

export const DropdownRoot = DropdownMenu.Root;
export const DropdownTrigger = DropdownMenu.Trigger;

export function DropdownContent({
  children,
  ...props
}: { children: ReactNode } & ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={styles.content} sideOffset={6} {...props}>
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function DropdownItem({
  icon,
  children,
  shortcut,
  destructive,
  className,
  ...props
}: ItemProps & Omit<ComponentProps<typeof DropdownMenu.Item>, "children">) {
  return (
    <DropdownMenu.Item className={clsx(styles.item, destructive && styles.destructive, className)} {...props}>
      <ItemBody icon={icon} shortcut={shortcut}>
        {children}
      </ItemBody>
    </DropdownMenu.Item>
  );
}

/** Voce con spunta che lascia il menu aperto, per scelte multiple. */
export function DropdownCheckItem({
  icon,
  children,
  checked,
  indent = 0,
  onCheckedChange,
}: ItemProps & { checked: boolean; indent?: number; onCheckedChange: (checked: boolean) => void }) {
  return (
    <DropdownMenu.CheckboxItem
      className={styles.item}
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(e) => e.preventDefault()}
      style={{ paddingLeft: 8 + indent * 14 }}
    >
      <ItemBody icon={icon}>{children}</ItemBody>
      <span className={styles.check}>{checked && <Check size={13} />}</span>
    </DropdownMenu.CheckboxItem>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className={styles.menuLabel}>{children}</DropdownMenu.Label>;
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator className={styles.separator} />;
}

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

function Sheet({ ...props }: ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />;
}

function SheetTrigger({ ...props }: ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger {...props} />;
}

function SheetContent({
  className,
  children,
  side = "right",
  title,
  ...props
}: ComponentProps<typeof Dialog.Content> & {
  side?: "right" | "bottom";
  title?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70" />
      <Dialog.Content
        className={cn(
          "fixed z-50 flex flex-col border-border bg-card text-card-foreground outline-none",
          side === "right" &&
            "inset-y-0 right-0 h-full w-full max-w-md border-l",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t",
          className,
        )}
        {...props}
      >
        <Dialog.Title className="sr-only">{title ?? "Panel"}</Dialog.Title>
        <div className="absolute right-3 top-3">
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X />
            </Button>
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export { Sheet, SheetTrigger, SheetContent };

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import { cn } from "@/lib/utils"

type ScrollAreaProps = ScrollAreaPrimitive.Root.Props & {
  /** Which scrollbars to render. Defaults to vertical only. */
  orientation?: "vertical" | "horizontal" | "both"
  /** Applied to the scrollable viewport rather than the wrapper. */
  viewportClassName?: string
  /** Forwarded to the scrollable viewport so callers can scroll it directly. */
  viewportRef?: React.Ref<HTMLDivElement>
  viewportProps?: Omit<ScrollAreaPrimitive.Viewport.Props, "className" | "ref">
}

function ScrollArea({
  children,
  className,
  orientation = "vertical",
  viewportClassName,
  viewportRef,
  viewportProps,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("group/scroll-area relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          viewportClassName
        )}
        {...viewportProps}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      {orientation !== "horizontal" && <ScrollBar orientation="vertical" />}
      {orientation !== "vertical" && <ScrollBar orientation="horizontal" />}

      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-0.5 opacity-0 transition-opacity duration-150 select-none data-scrolling:opacity-100 data-hovering:opacity-100",
        "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2.5",
        "data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col",
        "group-[.no-scrollbar]/scroll-area:hidden",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-foreground/22"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }

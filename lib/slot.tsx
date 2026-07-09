import * as React from "react"

interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
}

const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...slotProps }, ref) => {
    const child = React.isValidElement(children) ? children : null
    if (!child) return null

    const childProps = child.props as Record<string, any>
    const merged: Record<string, any> = {}

    for (const key of Object.keys(slotProps)) {
      const slotVal = (slotProps as any)[key]
      const childVal = childProps[key]

      if (
        /^on[A-Z]/.test(key) &&
        typeof slotVal === "function" &&
        typeof childVal === "function"
      ) {
        merged[key] = (...args: unknown[]) => {
          childVal(...args)
          slotVal(...args)
        }
      } else if (key === "className") {
        merged[key] = [slotVal, childVal].filter(Boolean).join(" ")
      } else if (key === "style") {
        merged[key] = { ...slotVal, ...childVal }
      } else {
        merged[key] = slotVal
      }
    }

    for (const key of Object.keys(childProps)) {
      if (!(key in merged) && key !== "children") {
        merged[key] = childProps[key]
      }
    }

    return React.cloneElement(child, { ...merged, ref } as any)
  }
)
Slot.displayName = "Slot"

export { Slot }

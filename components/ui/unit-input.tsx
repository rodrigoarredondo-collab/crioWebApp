"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UnitInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
    value: string | number
    onChange: (value: string | number) => void
    unit: string
    onUnitChange?: (unit: string) => void
    unitOptions?: string[]
    allowUnitSelection?: boolean
    unitPosition?: 'left' | 'right'
}

export const UnitInput = React.forwardRef<HTMLInputElement, UnitInputProps>(
    ({ className, value, onChange, unit, onUnitChange, unitOptions, allowUnitSelection, unitPosition = 'right', ...props }, ref) => {
        const spanRef = React.useRef<HTMLSpanElement>(null)
        const unitRef = React.useRef<HTMLDivElement>(null)
        const [textWidth, setTextWidth] = React.useState(0)
        const [unitWidth, setUnitWidth] = React.useState(0)

        React.useEffect(() => {
            // Measure text width for right positioning
            if (spanRef.current) {
                setTextWidth(spanRef.current.offsetWidth)
            }
        }, [value])

        React.useEffect(() => {
            // Measure unit width for left padding
            if (unitRef.current) {
                setUnitWidth(unitRef.current.offsetWidth)
            }
        }, [unit, allowUnitSelection])

        const isLeft = unitPosition === 'left'

        return (
            <div
                className={cn(
                    "relative flex h-10 w-full items-center rounded-md border border-input bg-background ring-offset-background text-sm transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
            >
                <span
                    ref={spanRef}
                    className="absolute invisible whitespace-pre pointer-events-none px-3"
                    style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
                    aria-hidden
                >
                    {value || props.placeholder || ""}
                </span>

                {/* Unit Element */}
                <div
                    ref={unitRef}
                    className={cn(
                        "absolute flex items-center h-full pointer-events-none z-10",
                        isLeft ? "left-0 pl-3" : "transition-all duration-100 ease-out"
                    )}
                    style={!isLeft ? { left: `${textWidth + 12}px` } : undefined} // 12px = px-3 padding
                >
                    {allowUnitSelection && unitOptions && onUnitChange ? (
                        <div className="pointer-events-auto">
                            <Select value={unit} onValueChange={onUnitChange}>
                                <SelectTrigger className="h-auto border-0 p-0 focus:ring-0 w-auto gap-1 text-muted-foreground hover:text-foreground bg-transparent shadow-none">
                                    <SelectValue>{unit}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {unitOptions.map((u) => (
                                        <SelectItem key={u} value={u}>
                                            {u}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <span className="text-muted-foreground whitespace-nowrap select-none">
                            {unit}
                        </span>
                    )}
                </div>

                <input
                    {...props}
                    ref={ref}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={cn(
                        "flex h-full w-full rounded-md bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                    style={{
                        paddingLeft: isLeft ? `${unitWidth + 16}px` : undefined // 12px (pl-3) + 4px gap
                    }}
                />
            </div>
        )
    }
)
UnitInput.displayName = "UnitInput"

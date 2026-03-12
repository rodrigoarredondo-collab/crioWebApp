"use client"

import { useEffect, useState } from "react"

interface Snowflake {
    id: number
    x: number
    y: number
    radius: number
    speed: number
    opacity: number
}

export function SnowEffect() {
    const [snowflakes, setSnowflakes] = useState<Snowflake[]>([])

    useEffect(() => {
        // Generate initial snowflakes
        const count = 300
        const initialSnowflakes: Snowflake[] = []

        for (let i = 0; i < count; i++) {
            initialSnowflakes.push({
                id: i,
                x: Math.random() * 100, // vw
                y: Math.random() * 100, // vh
                radius: Math.random() * 5 + 2,
                speed: Math.random() * 30 + 15, // seconds for full fall (slower is better for background)
                opacity: Math.random() * 0.5 + 0.1,
            })
        }

        setSnowflakes(initialSnowflakes)
    }, [])

    return (
        <div className="w-[100%] h-[100%] absolute inset-0 pointer-events-none z-[0] overflow-hidden" aria-hidden="true">
            {snowflakes.map((flake) => (
                <div
                    key={flake.id}
                    className="absolute rounded-full bg-white animate-fall"
                    style={{
                        left: `${flake.x}%`,
                        top: `${flake.y}%`, // Start at random positions
                        width: `${flake.radius}px`,
                        height: `${flake.radius}px`,
                        opacity: flake.opacity,
                        animationDuration: `${flake.speed}s`,
                        animationDelay: `-${Math.random() * 20}s`, // Random start time in cycle
                    }}
                />
            ))}
            <style jsx global>{`
        @keyframes fall {
          0% {
            transform: translateY(-10vh);
          }
          100% {
            transform: translateY(110vh);
          }
        }
        .animate-fall {
          animation-name: fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
        </div>
    )
}

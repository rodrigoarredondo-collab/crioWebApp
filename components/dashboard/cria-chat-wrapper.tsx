"use client";

import dynamic from "next/dynamic";

export const CriaChatWrapper = dynamic(
    () => import("@/components/dashboard/cria-chat").then((mod) => mod.CriaChat),
    {
        ssr: false,
        loading: () => <div className="h-[calc(100vh-80px)] w-full animate-pulse bg-muted/10 rounded-xl m-4 border border-primary/10" />
    }
);

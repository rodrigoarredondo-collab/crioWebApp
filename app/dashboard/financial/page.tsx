import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PriceConfigurator } from "@/components/financial/price-configurator"

export default async function FinancialPage() {
    const supabase = await createClient()
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error || !user) {
        redirect("/auth/login")
    }

    if (!user.email?.endsWith("@criocore.com")) {
        redirect("/dashboard")
    }

    // Fetch user profile
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

    // Fetch user price configuration
    let { data: priceConfig } = await supabase
        .from("price_configuration")
        .select("*")
        .eq("user_id", user.id)
        .single()

    let { data: productPrice } = await supabase
        .from("prices")
        .select("*")

    const reagentPriceMap = productPrice?.reduce((acc, item) => {
        acc[item.reagent] = { price: item.price, quantity: item.quantity };
        return acc;
    }, {});

    // If no configuration exists, create one with default values
    if (!priceConfig) {
        const defaultConfig = {
            volume_96: 4,
            cell_concentration: "12M",
            gelma: 5,
            lap: 0.2,
            dmso: 5,
            raffinose: 10,
            ink_vol: 20,
            cell: "liver",
            ink_type: "gelma_based",
            consumables: 93.23,
            human_hours: {
                ink: 2,
                cell: 3,
                printing: 3,
                post: 12
            },
            assays: {
                cell_viability_assay: 18,
                albumin_assay: 18,
                tryglicerides_assay: 18,
                alt_assay: 18,
                lactate_assay: 18
            }
        }

        const { data: newConfig, error: createError } = await supabase
            .from("price_configuration")
            .insert({
                user_id: user.id,
                // configuration: JSON.stringify(defaultConfig)
            })
            .select()
            .single()

        if (createError) {
            console.error("Error creating default configuration:", createError)
            // Handle error appropriately, maybe show an error state
        } else {
            priceConfig = newConfig
        }
    }

    return (
        <DashboardShell user={user} profile={profile}>
            <div className="flex flex-col gap-4 p-4 md:p-8">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Financial</h2>
                </div>
                {priceConfig ? (
                    <PriceConfigurator priceMap={reagentPriceMap} initialConfig={priceConfig.configuration} userId={user.id} />
                ) : (
                    <div>Error loading configuration. Please try again later.</div>
                )}
            </div>
        </DashboardShell>
    )
}

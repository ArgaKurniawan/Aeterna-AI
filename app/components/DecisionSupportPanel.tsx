"use client";

import React, { useMemo } from "react";
import { Truck, Users, Calendar, AlertTriangle, Lightbulb, Pickaxe, Wallet, PiggyBank, ArrowRight, Activity, CheckCircle, TrendingDown } from "lucide-react";

export default function DecisionSupportPanel({ dashboard }: { dashboard: any }) {
    const { predictionData, totalVolume, staffCount, manHours, recommendedTrucks, isLoading } = dashboard;

    const results = predictionData?.data?.prediction_results || [];

    const costAnalysis = useMemo(() => {
        // Standard assumed constants for estimation
        const WAGE_PER_HOUR = 25000;
        const TRUCK_COST_PER_DAY = 800000;

        // Proactive (AI-driven) cost
        const workerCost = staffCount * 8 * WAGE_PER_HOUR;
        const truckCost = recommendedTrucks * TRUCK_COST_PER_DAY;
        const totalCost = workerCost + truckCost;

        // Calculate Reactive (traditional) baseline:
        // Without predictions, operations must deploy peak (worst-case) resources every day to avoid overflow.
        let maxVolume = 0;
        let maxTrucks = 0;
        results.forEach((r: any) => {
            const vol = r.total_volume_ton || 0;
            if (vol > maxVolume) maxVolume = vol;
            const trk = r.recommended_trucks || Math.ceil(vol / 8);
            if (trk > maxTrucks) maxTrucks = trk;
        });

        const reactiveTrucksPerDay = Math.max(maxTrucks, Math.ceil(maxVolume / 8));
        // Proportional workers for the peak day
        const reactiveStaffPerDay = Math.ceil(staffCount * (reactiveTrucksPerDay / Math.max(1, recommendedTrucks)));

        const reactiveWorkerCost = reactiveStaffPerDay * 8 * WAGE_PER_HOUR * (results.length || 1);
        const reactiveTruckCost = reactiveTrucksPerDay * TRUCK_COST_PER_DAY * (results.length || 1);
        const reactiveTotalCost = reactiveWorkerCost + reactiveTruckCost;

        // Savings & Efficiency
        const savings = Math.max(0, reactiveTotalCost - totalCost);
        const savingsPercent = reactiveTotalCost > 0 ? (savings / reactiveTotalCost) * 100 : 0;

        return {
            workerCost,
            truckCost,
            totalCost,
            reactiveTotalCost,
            savings,
            savingsPercent
        }
    }, [staffCount, recommendedTrucks, results, totalVolume]);

    const truckBreakdown = useMemo(() => {
        // Heuristic: 60% Big Trucks, 40% Small Pick-ups
        const big = Math.round(recommendedTrucks * 0.6);
        const small = recommendedTrucks - big;
        return { big, small };
    }, [recommendedTrucks]);

    const scheduleHeatmap = useMemo(() => {
        const avgVolume = results.length > 0 ? (totalVolume / results.length) : 0;

        return results.map((r: any, idx: number) => {
            // Evaluate load to determine status and color (Darurat = Red, Sedang = Yellow/Orange, Aman = Green)
            let status = "AMAN";
            let color = "var(--accent-green)";
            let bg = "var(--accent-green-dim)";

            const vol = r.total_volume_ton || 0;

            if (r.risk_status === "HIGH" || vol > avgVolume * 1.05) {
                status = "DARURAT";
                color = "var(--accent-red)";
                bg = "var(--accent-red-dim)";
            } else if (r.risk_status === "WARNING" || vol > avgVolume * 0.95) {
                status = "SEDANG";
                color = "var(--accent-orange)";
                bg = "var(--accent-orange-dim)";
            }

            // Get day of week
            const dateObj = new Date(r.date);
            const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
            const dayName = isNaN(dateObj.getTime()) ? `H+${idx + 1}` : days[dateObj.getDay()];

            const trucks = r.recommended_trucks || Math.ceil((r.total_volume_ton || 0) / 8);
            const shifts = status === "DARURAT" ? 3 : 2;

            return {
                day: dayName,
                fullDate: r.date || `Hari ${idx + 1}`,
                volume: vol.toFixed(1),
                trucks,
                shifts,
                status,
                color,
                bg
            }
        });
    }, [results, totalVolume]);

    const actionPlans = useMemo(() => {
        const plans: { dayTitle: string; description: string; type: "warning" | "danger" | "info" }[] = [];

        if (results.length === 0) return plans;

        // Find the peak day (day with the highest volume)
        let peakIdx = -1;
        let maxVol = 0;
        scheduleHeatmap.forEach((d: any, idx: number) => {
            const vol = parseFloat(d.volume);
            if (vol > maxVol) {
                maxVol = vol;
                peakIdx = idx;
            }
        });

        const isHeavyRainPeriod = (dashboard.rainfallMm || 0) > 8.0;

        scheduleHeatmap.forEach((dayData: any, idx: number) => {
            const isPeak = idx === peakIdx;
            const isDarurat = dayData.status === "DARURAT";
            const isSedang = dayData.status === "SEDANG";

            if (isPeak && isHeavyRainPeriod) {
                // Action for H-1 (Day before peak/rain)
                const prevIdx = idx - 1;
                if (prevIdx >= 0) {
                    const prevDay = scheduleHeatmap[prevIdx];
                    plans.push({
                        dayTitle: `Aksi Hari ${prevDay.day} (Antisipasi Hujan Lebat Hari ${dayData.day})`,
                        description: `Kosongkan seluruh TPS utama lebih awal (H-1 sebelum hujan lebat esok hari) untuk mencegah air genangan bercampur sampah basah yang dapat memicu banjir dan bau menyengat.`,
                        type: "danger"
                    });
                }

                // Action for the peak day itself
                plans.push({
                    dayTitle: `Aksi Hari ${dayData.day} (Hujan Lebat & Beban Puncak)`,
                    description: `Volume sampah memuncak hingga ${dayData.volume} TON. Siapkan armada pompa air mobile di titik TPS rawan banjir dan maksimalkan pembersihan saluran drainase sekitarnya.`,
                    type: "danger"
                });
            } else if (isDarurat) {
                plans.push({
                    dayTitle: `Aksi Hari ${dayData.day} (Status Darurat)`,
                    description: `Beban kerja sangat tinggi dengan volume ${dayData.volume} TON. Kerahkan seluruh ${dayData.trucks} armada truk besar secara optimal (3 Shift penuh) dan siapkan kru lapangan.`,
                    type: "danger"
                });
            } else if (isSedang) {
                plans.push({
                    dayTitle: `Aksi Hari ${dayData.day} (Status Sedang)`,
                    description: `Volume sampah terpantau meningkat (${dayData.volume} TON). Siapkan koordinasi rute tambahan untuk mengantisipasi keterlambatan pengangkutan harian.`,
                    type: "warning"
                });
            } else if (isPeak) {
                // Peak day but no heavy rain
                plans.push({
                    dayTitle: `Aksi Hari ${dayData.day} (Beban Puncak Mingguan)`,
                    description: `Hari dengan volume sampah tertinggi minggu ini (${dayData.volume} TON). Optimalkan rute angkut agar ritase pengangkutan berjalan efisien dan cepat selesai.`,
                    type: "warning"
                });
            }
        });

        // Fallback if no actions generated
        if (plans.length === 0) {
            plans.push({
                dayTitle: "Rencana Operasional Standar",
                description: "Beban kerja terpantau aman dan cuaca diprediksi bersahabat. Lanjutkan jadwal pengambilan rutin.",
                type: "info"
            });
        }

        return plans;
    }, [scheduleHeatmap, dashboard.rainfallMm, results.length]);

    const formatIDR = (num: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
    };

    if (!predictionData?.data) {
        return (
            <div className="card" style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-muted)", marginTop: 24 }}>
                Belum ada data prediksi. Silakan jalankan model AI terlebih dahulu.
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: -8 }}>
                <Activity size={24} style={{ color: "var(--accent-blue)" }} />
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Dashboard Keputusan</h2>
            </div>

            {/* Executive Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                <div className="stat-card">
                    <div className="stat-label">Total Volume Prediksi</div>
                    <div className="stat-value" style={{ fontSize: "clamp(24px, 5vw, 32px)", color: "var(--text-primary)" }}>
                        {totalVolume.toFixed(1)} <span style={{ fontSize: 16, color: "var(--text-muted)" }}>TON</span>
                    </div>
                    <div className="stat-trend" style={{ color: "var(--accent-green)" }}>
                        <CheckCircle size={14} /> Berhasil diprediksi ({results.length} hari)
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Estimasi Biaya Operasional</div>
                    <div className="stat-value" style={{ fontSize: "clamp(20px, 4vw, 26px)" }}>{formatIDR(costAnalysis.totalCost)}</div>
                    <div className="stat-trend" style={{ color: "var(--text-secondary)" }}>
                        Total Anggaran Logistik & SDM
                    </div>
                </div>

                <div className="stat-card" style={{ border: "1px solid rgba(45, 212, 168, 0.3)" }}>
                    <div className="stat-label">Efisiensi AI (Proaktif vs Reaktif)</div>
                    <div className="stat-value" style={{ fontSize: "clamp(24px, 5vw, 32px)", color: "var(--accent-green)" }}>
                        {costAnalysis.savingsPercent.toFixed(1)}%
                    </div>
                    <div className="stat-trend" style={{ color: "var(--accent-green)", fontWeight: 600 }}>
                        <TrendingDown size={14} /> Hemat {formatIDR(costAnalysis.savings)} dibanding Reaktif
                    </div>
                </div>
            </div>

            {/* Main Operational Container */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>

                {/* Weekly Heatmap / Peta Beban Kerja */}
                <div className="card" style={{ padding: "16px 20px", flex: 2, minWidth: 320 }}>
                    <div className="card-title" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={18} style={{ color: "var(--accent-green)" }} />
                        Peta Beban Kerja Harian
                    </div>
                    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }} className="no-scrollbar">
                        {scheduleHeatmap.map((dayData: any, i: number) => (
                            <div key={i} style={{
                                flex: 1,
                                minWidth: 80,
                                background: "var(--bg-input)",
                                borderRadius: "var(--radius-md)",
                                overflow: "hidden",
                                border: "1px solid var(--border-primary)",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                <div style={{ background: dayData.bg, color: dayData.color, fontSize: 11, fontWeight: 700, textAlign: "center", padding: "6px 0", textTransform: "uppercase" }}>
                                    {dayData.day}
                                </div>
                                <div style={{ padding: "10px 0", textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>{dayData.volume}</div>
                                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>TON</div>
                                </div>
                                <div style={{ background: "rgba(0,0,0,0.15)", padding: "6px 0", textAlign: "center", fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                    <Truck size={12} /> {dayData.trucks}
                                </div>
                                <div style={{ padding: "6px 0", textAlign: "center", fontSize: 9, fontWeight: 700, display: "flex", flexDirection: "column", gap: 2, color: dayData.color, borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                                    <span>S1: 04:00-10:00</span>
                                    <span>S2: 10:00-16:00</span>
                                    {dayData.shifts === 3 && <span>S3: 19:00-01:00</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Resource & Actions Panel */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 320 }}>
                    {/* Resource Allocation */}
                    <div className="card" style={{ padding: "16px 20px" }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>Alokasi Armada Spesifik</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                            <div style={{ background: "var(--bg-input)", padding: 12, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ padding: 10, background: "rgba(56, 189, 248, 0.15)", borderRadius: "var(--radius-sm)", color: "var(--accent-blue)" }}>
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-heading)" }}>{truckBreakdown.big} Unit</div>
                                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Truk Besar (Dump Truck)</div>
                                </div>
                            </div>
                            <div style={{ background: "var(--bg-input)", padding: 12, borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ padding: 10, background: "rgba(245, 158, 11, 0.15)", borderRadius: "var(--radius-sm)", color: "var(--accent-orange)" }}>
                                    <Truck size={20} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-heading)" }}>{truckBreakdown.small} Unit</div>
                                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Armada Kecil (Pick-up)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Plans */}
                    <div className="card" style={{ padding: "16px 20px", flex: 1, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                        <div className="card-title" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                            <AlertTriangle size={18} style={{ color: "var(--accent-red)" }} />
                            Rencana Aksi Kritis
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto", paddingRight: 4 }}>
                            {actionPlans.map((plan: any, i: number) => {
                                const borderLeftColor =
                                    plan.type === "danger" ? "var(--accent-red)" :
                                        plan.type === "warning" ? "var(--accent-orange)" :
                                            "var(--accent-green)";
                                const iconColor = borderLeftColor;

                                return (
                                    <div key={i} style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                        fontSize: 13,
                                        color: "var(--text-primary)",
                                        background: "var(--bg-input)",
                                        padding: "12px 16px",
                                        borderRadius: "var(--radius-sm)",
                                        borderLeft: `4px solid ${borderLeftColor}`
                                    }}>
                                        <div style={{ fontWeight: 700, color: "var(--text-heading)", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                                            <div style={{ backgroundColor: iconColor, width: 8, height: 8, borderRadius: "50%" }} />
                                            {plan.dayTitle.toUpperCase()}
                                        </div>
                                        <span style={{ lineHeight: 1.5, color: "var(--text-secondary)", fontSize: 12 }}>{plan.description}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

'use client';

import React from "react";
import Link from "next/link";
import {
  LayoutGrid,
  CheckCircle2,
  Trophy,
  Banknote,
  ArrowUp,
} from "lucide-react";

// export const metadata = { title: "Goal-Based Savings - Nestera" };

export default function GoalBasedSavingsPage() {
  return (
    <section className="min-h-screen w-full bg-[#0b1f20]">
      {/* Header Band */}
      <div className="w-full bg-[#0f2a2a]">
        <div className="w-full max-w-7xl mx-auto px-6 md:px-8 pt-10 pb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white m-0 tracking-tight">
                Goal-Based Savings
              </h1>
              <p className="text-[#6a8a93] text-sm md:text-base m-0 mt-3 max-w-3xl">
                Create savings targets, track progress, and stay on course toward
                your personal financial goals
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-5 py-2.5 rounded-xl border border-cyan-400/40 text-cyan-200 hover:text-white hover:border-cyan-300 transition-colors">
                View Templates
              </button>
              <Link
                href="/savings/create-goal"
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#061a1a] font-semibold rounded-xl transition-all shadow-lg active:scale-95 inline-block"
              >
                Create New Goal
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {[
            {
              label: "Total Goals",
              value: "12",
              icon: LayoutGrid,
              color: "text-cyan-400",
            },
            {
              label: "Active Goals",
              value: "8",
              icon: CheckCircle2,
              color: "text-emerald-400",
            },
            {
              label: "Total Saved",
              value: "$43,250",
              icon: Banknote,
              color: "text-cyan-400",
            },
            {
              label: "Goals Completed",
              value: "4",
              icon: Trophy,
              color: "text-amber-400",
            },
            {
              label: "This Month's Contributions",
              value: "$1,840",
              icon: ArrowUp,
              color: "text-cyan-400",
            },
          ].map((stat) => (
            <div
              key={stat.label}
            className="rounded-2xl border border-white/5 bg-[#0f2c2c] p-6 shadow-[0_10px_24px_rgba(2,12,12,0.35)]"
            >
              <div className={stat.color}>
                <stat.icon size={20} strokeWidth={2} />
              </div>
              <p className="text-[#6a8a93] text-xs mt-3 mb-2">{stat.label}</p>
              <p className="text-white text-2xl font-semibold m-0">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const GoalManagementHeader: React.FC = () => {
  return (
    <header
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 sm:px-6"
      style={{
        minHeight: 64,
        background: "linear-gradient(45deg, #0F1F1F 0%, #132626 100%)"
      }}
    >
      {/* Left: Title and Subtitle */}
      <div className="flex flex-col gap-0.5">
        <h1
          className="m-0 text-white font-bold leading-none"
          style={{ fontSize: 22 }}
        >
          Goal Management & Creation
        </h1>
        <p className="m-0 text-[#4e8a96]" style={{ fontSize: 13 }}>
          Manage your goals in detail and create new savings targets with powerful tools
        </p>
      </div>

      {/* Right: Back Button */}
      <Link
        href="/dashboard"
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#6a9fae] text-[#6a9fae] hover:text-[#5de0e0] hover:border-[#5de0e0] transition-colors no-underline bg-transparent w-full sm:w-auto"
        style={{ fontSize: 14 }}
      >
        <ArrowLeft size={16} />
        <span className="font-medium">Back to Overview</span>
      </Link>
    </header>
  );
};

export default GoalManagementHeader;
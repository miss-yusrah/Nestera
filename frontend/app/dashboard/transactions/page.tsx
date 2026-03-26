"use client";

import React from "react";
import { Download, History, Search, ChevronDown } from "lucide-react";
import TransactionRow, { TransactionType, TransactionStatus } from "./components/TransactionRow";

type TransactionRowData = {
  date: string;
  time: string;
  transactionId: string;
  title: string;
  type: TransactionType;
  assetDetails: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  hash: string;
};

function csvEscape(value: string) {
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replaceAll('"', '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function toCsv(rows: TransactionRowData[]) {
  const header = ["date", "time", "transactionId", "type", "assetDetails", "amount", "currency", "status", "hash"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [r.date, r.time, r.transactionId, r.type, r.assetDetails, r.amount.toString(), r.currency, r.status, r.hash]
        .map(csvEscape)
        .join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function downloadTextFile(
  filename: string,
  text: string,
  mime = "text/csv;charset=utf-8",
) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TransactionHistoryPage() {
  const transactions: TransactionRowData[] = [
    {
      date: "2026-03-25",
      time: "10:23",
      transactionId: "0x9f2a...a1b3",
      title: "Deposit USDC",
      type: "deposit",
      assetDetails: "USDC Wallet",
      amount: 500.0,
      currency: "USDC",
      status: "completed",
      hash: "0x9f2a...a1b3",
    },
    {
      date: "2026-03-25",
      time: "08:15",
      transactionId: "0x3d10...c92e",
      title: "Yield Earned",
      type: "yield",
      assetDetails: "Auto-compound reward",
      amount: 12.45,
      currency: "USDC",
      status: "completed",
      hash: "0x3d10...c92e",
    },
    {
      date: "2026-03-24",
      time: "16:32",
      transactionId: "0x7a4c...1ff2",
      title: "Swap ETH → USDC",
      type: "swap",
      assetDetails: "0.5 ETH for 835 USDC",
      amount: -0.5,
      currency: "ETH",
      status: "completed",
      hash: "0x7a4c...1ff2",
    },
    {
      date: "2026-03-24",
      time: "14:18",
      transactionId: "0x0b22...8e91",
      title: "Withdraw USDC",
      type: "withdraw",
      assetDetails: "To external wallet",
      amount: -250.0,
      currency: "USDC",
      status: "pending",
      hash: "0x0b22...8e91",
    },
    {
      date: "2026-03-25",
      time: "12:00",
      transactionId: "0x5f99...d2be",
      title: "Swap USDC → DAI",
      type: "swap",
      assetDetails: "550 USDC to 549 DAI",
      amount: -550.0,
      currency: "USDC",
      status: "completed",
      hash: "0x5f99...d2be",
    },
  ];

  function onExportCsv() {
    const csv = toCsv(transactions);
    downloadTextFile(
      `nestera-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-b from-[#063d3d] to-[#0a6f6f] flex items-center justify-center text-cyan-400 shadow-[0_8px_20px_rgba(6,61,61,0.3)]">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white m-0 tracking-tight">
              Transaction History
            </h1>
            <p className="text-[#5e8c96] text-sm md:text-base m-0 mt-1">
              Download your transactions as a CSV file for reporting.
            </p>
          </div>
        </div>

        <button
          onClick={onExportCsv}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#061a1a] font-bold rounded-xl transition-all shadow-lg active:scale-95"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[280px]">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5e8c96]"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by transaction, token, or hash..."
            className="w-full bg-[#0e2330] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-[#4e7a86] focus:outline-hidden focus:border-cyan-500/50 transition-colors"
          />
        </div>

        {["Type: All", "Asset: All", "Status: All"].map((filter) => (
          <button
            type="button"
            key={filter}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-[#0e2330] border-white/5 text-[#5e8c96] hover:border-white/10 hover:text-white transition-all"
          >
            <span className="text-sm font-medium">{filter}</span>
            <ChevronDown size={14} opacity={0.7} />
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#0e2330] overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 border-b border-white/5 text-[#5e8c96] text-xs font-bold uppercase tracking-widest">
          <div className="col-span-4">Date</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Token</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>

        {transactions.map((t) => (
          <TransactionRow
            key={t.hash}
            date={t.date}
            time={t.time}
            transactionId={t.transactionId}
            type={t.type}
            assetDetails={t.assetDetails}
            amount={t.amount}
            currency={t.currency}
            status={t.status}
            onClick={(id) => console.log('Open transaction', id)}
          />
        ))}
      </div>
    </div>
  );
}

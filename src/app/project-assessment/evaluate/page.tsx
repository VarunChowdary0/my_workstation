"use client";

import { AlertTriangle } from "lucide-react";

export default function Page() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <AlertTriangle className="text-yellow-500" size={24} />
        </div>
        <h2 className="text-white text-lg font-semibold">
          No Evaluation Token
        </h2>
        <p className="text-gray-400 text-sm text-center max-w-md">
          No evaluation token was provided. Please use the link from the admin
          panel to access the evaluation.
        </p>
      </div>
    </div>
  );
}

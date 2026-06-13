"use client";

import { useEffect, useState } from "react";

export default function ProtectedPage() {
  const [scale, setScale] = useState(10);
  const clearPaymentSession = () => {
    document.cookie =
      "payment-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/";
  };

  const goHome = () => {
    window.location.href = "/";
  };

  useEffect(() => {
    setScale(500);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-800 text-white text-center">
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-4xl font-bold mb-4">Protected Content</h1>
        <p className="text-xl">Your payment was successful 🎉</p>
        <p className="mt-3">
          You used a Turnkey embedded wallet to pay for this page! <br /> You
          will be able to access this page for 5 minutes. If you want to clear
          your token before then, click the button below.
        </p>
        <div className="w-full flex justify-center items-center mt-2">
          <img
            className="transition-all duration-[100000ms] ease-linear"
            style={{ transform: `scale(${scale}%)` }}
            src="https://img.freepik.com/premium-vector/thumb-up-emoticon_1303870-11.jpg?semt=ais_hybrid&w=740&q=80"
            alt="Thumbs up emoticon"
          />
        </div>

        <div className="gap-2 flex flex-col justify-center items-center w-full">
          <button
            onClick={goHome}
            className="mt-5 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded z-50"
          >
            Go to Home
          </button>

          <button
            onClick={clearPaymentSession}
            className="mt-5 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded z-50"
          >
            Clear Payment Session
          </button>
        </div>
      </div>
    </div>
  );
}

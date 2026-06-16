"use client";

import dynamic from "next/dynamic";

const LoginPage = dynamic(() => import("./LoginPage"), { ssr: false });

export default function Home() {
  return <LoginPage />;
}

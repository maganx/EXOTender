import { redirect } from "next/navigation";

export default function Home() {
  redirect("/app");
}

export const runtime = "edge";

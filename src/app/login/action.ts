"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  verifyPin,
  createSession,
  checkRateLimit,
  recordAttempt,
  clearAttempts,
} from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const pin = formData.get("pin") as string;
  if (!pin) redirect("/login?error=1");

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    redirect("/login?locked=1");
  }

  const valid = await verifyPin(pin);
  if (!valid) {
    // The in-memory attempt counter resets on every serverless cold start, so
    // a fixed delay is the floor on brute-force throughput regardless of
    // which instance serves the request.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    recordAttempt(ip);
    const afterAttempt = checkRateLimit(ip);
    if (!afterAttempt.allowed) {
      redirect("/login?locked=1");
    }
    redirect("/login?error=1");
  }

  clearAttempts(ip);
  await createSession();
  redirect("/review");
}

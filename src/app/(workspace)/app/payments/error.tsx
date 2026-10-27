"use client";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
export default function ErrorScreen({reset}:{reset:()=>void}){return <Card><h1>Payment records unavailable</h1><p role="alert">Unable to load payment records. Please retry.</p><div className="client-actions"><Button onClick={reset}>Try again</Button><Link className="text-link" href="/app/payments">Payments</Link></div></Card>;}

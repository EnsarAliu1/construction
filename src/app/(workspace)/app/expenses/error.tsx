"use client";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
export default function ErrorScreen({reset}:{reset:()=>void}){return <Card><h1>Expense records unavailable</h1><p role="alert">Unable to load expenses. Please retry.</p><div className="client-actions"><Button type="button" onClick={reset}>Try again</Button><Link className="text-link" href="/app/expenses">Expenses</Link></div></Card>;}

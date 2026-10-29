"use client";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
export default function ErrorScreen({reset}:{reset:()=>void}){return <Card><h1>Shpenzimet janë të padisponueshme</h1><p role="alert">Shpenzimet nuk mund të ngarkohen. Provoni përsëri.</p><div className="client-actions"><Button type="button" onClick={reset}>Provoni përsëri</Button><Link className="text-link" href="/app/expenses">Shpenzimet</Link></div></Card>;}

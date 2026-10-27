"use client";
import {Button,Card} from "@/components/ui";
export default function Error({reset}:{reset:()=>void}){return <Card><h1>Receipt unavailable</h1><p role="alert">Unable to load receipt information. Please retry or contact your operator.</p><Button onClick={reset}>Try again</Button></Card>;}

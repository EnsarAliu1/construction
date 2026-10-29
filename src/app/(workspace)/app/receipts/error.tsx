"use client";
import {Button,Card} from "@/components/ui";
export default function Error({reset}:{reset:()=>void}){return <Card><h1>Dëftesa është e padisponueshme</h1><p role="alert">Të dhënat e dëftesës nuk mund të ngarkohen. Provoni përsëri ose kontaktoni operatorin.</p><Button onClick={reset}>Provoni përsëri</Button></Card>;}

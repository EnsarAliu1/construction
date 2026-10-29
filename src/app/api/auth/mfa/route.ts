import type { NextRequest } from 'next/server';
import qrcode from 'qrcode-generator';
import { authJson, limitedJson, challengeCookieSettings, setChallengeCookie, clearChallengeCookie, setSessionCookie } from '@/server/auth/http';
import { assertSameOrigin, safeReturnPath, sessionCookieSettings, AuthenticationRequired } from '@/server/auth/security';
import { withAuthConnection } from '@/server/auth/store';
import { challengeStatus, startEnrollment, proveEnrollment, acknowledgeCodes, verifyMfa, beginFactorChange, cancelMfa, type MfaResult } from '@/server/auth/mfa';
export const runtime = 'nodejs';
const pending = (r: NextRequest) => r.cookies.get(challengeCookieSettings().name)?.value;
export async function GET(r: NextRequest) { try {
    const result = await withAuthConnection(c => challengeStatus(c, pending(r)));
    return authJson(result, result.ok ? 200 : 401);
}
catch {
    return authJson({ ok: false, message: "Autentikimi është përkohësisht i padisponueshëm." }, 503);
} }
export async function POST(r: NextRequest) {
    try {
        assertSameOrigin(r.headers);
    }
    catch {
        return authJson({ ok: false, message: "Kërkesa u refuzua." }, 403);
    }
    let body: Record<string, unknown>;
    try {
        body = await limitedJson(r);
        if (Object.keys(body).some(k => !['action', 'code', 'confirmation', 'password', 'returnTo'].includes(k)))
            throw new Error();
    }
    catch {
        return authJson({ ok: false, message: "Dërgoni kërkesë të vlefshme autentikimi brenda kufirit të lejuar." }, 400);
    }
    try {
        const result: MfaResult = await withAuthConnection(async (c) => {
            switch (body.action) {
                case 'start': return startEnrollment(c, pending(r));
                case 'enroll': return proveEnrollment(c, pending(r), body.code);
                case 'acknowledge': return acknowledgeCodes(c, pending(r), body.confirmation);
                case 'verify': return verifyMfa(c, pending(r), body.code);
                case 'recovery': return verifyMfa(c, pending(r), body.code, true);
                case 'replace':
                case 'codes': return beginFactorChange(c, r.cookies.get(sessionCookieSettings().name)?.value, body.password, body.code, body.action);
                case 'cancel':
                    await cancelMfa(c, pending(r));
                    return { ok: true, state: 'complete' };
                default: return { ok: false };
            }
        });
        if (!result.ok)
            return authJson({ ok: false, message: result.limited ? "Shumë përpjekje verifikimi. Prisni para se të provoni hyrjen përsëri." : "Verifikimi dështoi ose skadoi. Kontrolloni kodin ose nisni hyrjen përsëri." }, result.limited ? 429 : 401);
        const { token, ...safe } = result;
        let qr: string | undefined;
        if (result.uri) {
            const image = qrcode(0, 'M');
            image.addData(result.uri);
            image.make();
            qr = image.createDataURL(4, 16);
        }
        const response = authJson({ ...safe, ...(qr ? { qr } : {}), returnTo: safeReturnPath(body.returnTo) });
        if (result.state === 'complete') {
            clearChallengeCookie(response);
            if (token)
                setSessionCookie(response, token);
        }
        else if (token)
            setChallengeCookie(response, token);
        return response;
    }
    catch (error) {
        if (error instanceof AuthenticationRequired)
            return authJson({ ok: false, message: "Përfundoni hyrjen para se të ndryshoni cilësimet e sigurisë." }, 401);
        return authJson({ ok: false, message: "Autentikimi është përkohësisht i padisponueshëm. Kontrolloni hapin aktual para se të provoni përsëri; nisni hyrjen nga fillimi ose kontaktoni operatorin." }, 503);
    }
}

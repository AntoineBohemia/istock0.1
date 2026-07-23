import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

/**
 * Envoi de l'email d'invitation, via Resend.
 *
 * L'envoi passait par une fonction Supabase en SMTP — a deployer et configurer
 * separement, et jamais branchee : les emails ne partaient pas, seul le lien
 * copie a la main fonctionnait. Ici l'envoi vit dans l'appli, deploye avec elle
 * sur Vercel, et n'exige qu'une cle Resend.
 *
 * Degrade proprement : sans cle, la route repond `skipped` plutot que d'echouer,
 * et l'interface retombe sur le lien a partager manuellement. Le manque de
 * configuration ne casse jamais l'invitation elle-meme.
 */
interface InvitePayload {
  email: string;
  token: string;
  organization_name: string;
  role?: "admin" | "member";
  invited_by_name?: string;
}

// Expediteur : une adresse d'un domaine verifie dans Resend. Par defaut,
// l'adresse de test de Resend — elle n'envoie qu'au proprietaire du compte,
// le temps de verifier un vrai domaine.
const FROM = process.env.INVITE_EMAIL_FROM || "iStock <onboarding@resend.dev>";

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;

  let payload: InvitePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const { email, token, organization_name, role, invited_by_name } = payload;
  if (!email || !token || !organization_name) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  // Pas de cle : on ne tente pas d'envoyer. L'appelant affichera le lien.
  if (!apiKey) {
    return NextResponse.json({ success: true, skipped: true, reason: "no_api_key" });
  }

  // Le lien pointe vers l'appli qui a recu la requete : l'email mene toujours
  // au bon domaine, sans variable a tenir a jour.
  const inviteUrl = `${req.nextUrl.origin}/invite/${token}`;
  const roleLabel = role === "admin" ? "Administrateur" : "Membre";
  const inviterText = invited_by_name ? `${invited_by_name} vous invite` : "Vous êtes invité(e)";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="font-size: 20px; font-weight: 600; color: #18181b; margin: 0 0 8px;">
      Rejoindre ${organization_name}
    </h1>
    <p style="color: #71717a; font-size: 14px; margin: 0 0 24px;">
      ${inviterText} à rejoindre <strong>${organization_name}</strong> sur iStock en tant que <strong>${roleLabel}</strong>.
    </p>
    <a href="${inviteUrl}"
       style="display: inline-block; background-color: #18181b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
      Accepter l'invitation
    </a>
    <p style="color: #a1a1aa; font-size: 12px; margin: 24px 0 0;">
      Ou copiez ce lien : <br><span style="color:#52525b; word-break:break-all;">${inviteUrl}</span>
    </p>
    <p style="color: #a1a1aa; font-size: 12px; margin: 12px 0 0;">
      Ce lien expire dans 7 jours. Si vous n'avez pas demandé cette invitation, ignorez cet email.
    </p>
    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
    <p style="color: #a1a1aa; font-size: 11px; margin: 0;">iStock — Gestion de stock</p>
  </div>
</body>
</html>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Invitation à rejoindre ${organization_name} sur iStock`,
      html,
    });

    if (error) {
      // L'invitation existe deja en base : un envoi rate n'est pas une erreur
      // fatale, l'appelant proposera le lien. On renvoie 200 avec le detail.
      return NextResponse.json({ success: false, error: error.message });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Erreur d'envoi",
    });
  }
}

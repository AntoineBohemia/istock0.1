import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.16";

const SMTP_HOST = Deno.env.get("SMTP_HOST");
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER = Deno.env.get("SMTP_USER");
const SMTP_PASS = Deno.env.get("SMTP_PASS");
const SMTP_FROM = Deno.env.get("SMTP_FROM") || SMTP_USER;
const APP_URL = Deno.env.get("APP_URL") || "https://app.istock.fr";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InvitationPayload {
  email: string;
  token: string;
  organization_name: string;
  role: string;
  invited_by_name?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  // Check SMTP is configured
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("SMTP not configured — skipping email send");
    return new Response(
      JSON.stringify({
        success: true,
        skipped: true,
        reason: "smtp_not_configured",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const payload: InvitationPayload = await req.json();
    const { email, token, organization_name, role, invited_by_name } = payload;

    if (!email || !token || !organization_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inviteUrl = `${APP_URL}/invite/${token}`;
    const roleLabel =
      role === "admin" ? "Administrateur" :
      role === "guest" ? "Invité" :
      "Membre";
    const inviterText = invited_by_name
      ? `${invited_by_name} vous invite`
      : "Vous \u00eates invit\u00e9(e)";

    const htmlBody = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="font-size: 20px; font-weight: 600; color: #18181b; margin: 0 0 8px;">
      Rejoindre ${organization_name}
    </h1>
    <p style="color: #71717a; font-size: 14px; margin: 0 0 24px;">
      ${inviterText} \u00e0 rejoindre <strong>${organization_name}</strong> sur iStock en tant que <strong>${roleLabel}</strong>.
    </p>
    <a href="${inviteUrl}"
       style="display: inline-block; background-color: #18181b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
      Accepter l\u2019invitation
    </a>
    <p style="color: #a1a1aa; font-size: 12px; margin: 24px 0 0;">
      Ce lien expire dans 7 jours. Si vous n\u2019avez pas demand\u00e9 cette invitation, ignorez cet email.
    </p>
    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
    <p style="color: #a1a1aa; font-size: 11px; margin: 0;">
      iStock \u2014 Gestion de stock intelligente
    </p>
  </div>
</body>
</html>`;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `iStock <${SMTP_FROM}>`,
      to: email,
      subject: `Invitation \u00e0 rejoindre ${organization_name} sur iStock`,
      html: htmlBody,
    });

    console.log("Email sent:", info.messageId);

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

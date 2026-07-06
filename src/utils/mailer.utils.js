import transporter from "../config/mailer.js";

const PURPOSE_LABELS = {
  login: "Log In",
  signup: "Complete Sign Up",
  email_verification: "Verify Your Email",
};

/**
 * Send a branded HTML email containing the OTP.
 * @param {string} email - Recipient email address
 * @param {string} otp   - Plain-text OTP (never stored in DB)
 * @param {string} purpose - "login" | "signup" | "email_verification"
 */
export const sendOTPEmail = async (email, otp, purpose = "login") => {
  const label = PURPOSE_LABELS[purpose] || "Verify";

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:48px 16px;">
              <table width="480" cellpadding="0" cellspacing="0"
                style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="background:#1a1a2e;padding:28px 40px;">
                    <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">
                      Booking Engine
                    </p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">${label}</h1>
                    <p style="margin:0 0 32px;font-size:15px;color:#6b7280;line-height:1.6;">
                      Use the one-time code below. It expires in <strong>5 minutes</strong>.
                    </p>
                    <!-- OTP Box -->
                    <div style="background:#f3f4f6;border-radius:10px;padding:28px;text-align:center;margin-bottom:32px;">
                      <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#1a1a2e;font-family:monospace;">
                        ${otp}
                      </span>
                    </div>
                    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                      If you did not request this code, you can safely ignore this email.
                      Never share your OTP with anyone.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;">
                      © ${new Date().getFullYear()} Booking Engine. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Booking Engine" <no-reply@bookingengine.com>',
    to: email,
    subject: `${otp} is your Booking Engine OTP`,
    html,
  });
};

/**
 * Send a staff invite email with a 24-hour OTP for first login.
 * @param {string} email      - Staff email address
 * @param {string} otp        - Plain-text OTP (never stored in DB)
 * @param {string} ownerName  - Full name of the inviting owner
 */
export const sendStaffInviteEmail = async (email, otp, ownerName) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;padding:0;background:#f9fafb;font-family:'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding:48px 16px;">
              <table width="480" cellpadding="0" cellspacing="0"
                style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="background:#1a1a2e;padding:28px 40px;">
                    <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">
                      Booking Engine
                    </p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <h1 style="margin:0 0 8px;font-size:24px;color:#111827;">You've been invited!</h1>
                    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                      <strong>${ownerName}</strong> has added you as a staff member on
                      <strong>Booking Engine</strong>. Use the one-time code below to log in.
                      This code is valid for <strong>24 hours</strong>.
                    </p>
                    <!-- OTP Box -->
                    <div style="background:#f3f4f6;border-radius:10px;padding:28px;text-align:center;margin-bottom:24px;">
                      <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">
                        Your login code
                      </p>
                      <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#1a1a2e;font-family:monospace;">
                        ${otp}
                      </span>
                    </div>
                    <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">
                      Enter this code along with your email at the login page to get started.
                    </p>
                    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                      If you were not expecting this invitation, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:12px;color:#9ca3af;">
                      © ${new Date().getFullYear()} Booking Engine. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Booking Engine" <no-reply@bookingengine.com>',
    to: email,
    subject: `${ownerName} invited you to Booking Engine — your login code: ${otp}`,
    html,
  });
};

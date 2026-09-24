// api/contact.js — for rover-site (marketing site)

// Escape user input before it goes into the HTML email body.
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, email, detail, recaptchaToken } = req.body || {}
  if (!name || !email || !detail) return res.status(400).json({ error: 'Missing fields' })

  if (!process.env.RESEND_API_KEY) {
    console.error('CONFIG ERROR: RESEND_API_KEY is not set — cannot send mail')
    return res.status(500).json({ error: 'Mail not configured' })
  }

  // ── Spam scoring ──
  // Deliberately does NOT block on a low score. reCAPTCHA v3 routinely gives
  // low scores to VPN users, privacy browsers, and unusual-but-real traffic.
  // A real inquiry silently dropped is worse than spam in the inbox, so every
  // submission is delivered. The result is only logged (Vercel logs), never put
  // in the email: replies quote the subject and body back to the sender.
  let spamNote = ''
  if (!recaptchaToken) {
    spamNote = 'No captcha token supplied'
  } else if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.error('CONFIG ERROR: RECAPTCHA_SECRET_KEY is not set — skipping captcha check')
    spamNote = 'Captcha not configured on server'
  } else {
    try {
      const captchaRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken,
        }).toString(),
      })
      const captchaData = await captchaRes.json()

      if (!captchaData.success) {
        const codes = (captchaData['error-codes'] || []).join(', ')
        console.warn('Captcha verification failed:', codes)
        spamNote = `Captcha verification failed (${codes || 'unknown'})`
      } else if (typeof captchaData.score === 'number' && captchaData.score < 0.5) {
        console.warn('Low captcha score:', captchaData.score)
        spamNote = `Low captcha score: ${captchaData.score}`
      }
    } catch (err) {
      console.error('Captcha check error:', err.message)
      spamNote = 'Captcha check errored'
    }
  }

  if (spamNote) console.warn(`Possible spam from ${email}: ${spamNote}`)

  // Sender's name in the display name so inquiries are easy to tell apart in the inbox.
  const fromName = String(name).replace(/["<>\r\n]/g, '').trim().slice(0, 60) || 'Website'
  // Worded so it still reads naturally as "Re: ..." when Nick replies.
  const subject = `Your Rover Fulfillment inquiry — ${fromName}`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} via Rover Fulfillment <nick@rover-fulfillment.com>`,
        to: ['nick@rover-fulfillment.com'],
        reply_to: email,
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <p><strong>Name:</strong> ${esc(name)}</p>
            <p><strong>Email:</strong> ${esc(email)}</p>
            <p><strong>Message:</strong></p>
            <p style="background:#f5f5f5;padding:16px;border-radius:4px;white-space:pre-wrap">${esc(detail)}</p>
          </div>
        `,
        text: [
          `Name: ${name}`,
          `Email: ${email}`,
          '',
          'Message:',
          detail,
        ].filter(Boolean).join('\n'),
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('Resend error:', response.status, body)
      return res.status(500).json({ error: 'Failed to send' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Contact error:', err.message)
    return res.status(500).json({ error: 'Unexpected error' })
  }
}

// api/contact.js — for rover-site (marketing site)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, email, detail } = req.body || {}
  if (!name || !email || !detail) return res.status(400).json({ error: 'Missing fields' })

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Rover Fulfillment Website <nick@rover-fulfillment.com>',
        to: ['nick@rover-fulfillment.com'],
        reply_to: email,
        subject: `New Inquiry from ${name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2 style="color:#FF6200;margin-bottom:24px">New Website Inquiry</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <p style="background:#f5f5f5;padding:16px;border-radius:4px;white-space:pre-wrap">${detail}</p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
            <p style="color:#999;font-size:12px">Sent from rover-fulfillment.com contact form</p>
          </div>
        `,
      }),
    })

    if (!response.ok) {
      console.error('Resend error:', await response.text())
      return res.status(500).json({ error: 'Failed to send' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Contact error:', err.message)
    return res.status(500).json({ error: 'Unexpected error' })
  }
}

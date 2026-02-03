class WhatsAppService {
  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.isConfigured = !!(this.phoneNumberId && this.accessToken);

    if (!this.isConfigured) {
      console.warn('WhatsApp not configured. Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN');
    }
  }

  logMessage(type, to, payload) {
    console.log(`[WhatsApp ${type}] Would send to ${to}:`, JSON.stringify(payload, null, 2));
  }

  async sendTextMessage(to, text) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/^\+/, ''),
      type: 'text',
      text: { body: text },
    };

    if (!this.isConfigured) {
      this.logMessage('TEXT', to, payload);
      return true;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('WhatsApp API error:', error);
        return false;
      }

      const result = await response.json();
      console.log('WhatsApp message sent:', result);
      return true;
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      return false;
    }
  }

  async sendInteractiveButtons(to, bodyText, buttons) {
    const interactiveButtons = buttons.map((btn) => ({
      type: 'reply',
      reply: {
        id: btn.id,
        title: btn.title,
      },
    }));

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/^\+/, ''),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: interactiveButtons,
        },
      },
    };

    if (!this.isConfigured) {
      this.logMessage('INTERACTIVE', to, payload);
      return true;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('WhatsApp API error:', error);
        return false;
      }

      const result = await response.json();
      console.log('WhatsApp interactive message sent:', result);
      return true;
    } catch (error) {
      console.error('Failed to send WhatsApp interactive message:', error);
      return false;
    }
  }

  extractButtonResponse(webhookPayload) {
    try {
      const entry = webhookPayload?.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];

      if (!message || message.type !== 'interactive') {
        return null;
      }

      const buttonReply = message.interactive?.button_reply;
      if (!buttonReply) {
        return null;
      }

      return {
        from: message.from,
        buttonId: buttonReply.id,
      };
    } catch (error) {
      console.error('Failed to extract button response:', error);
      return null;
    }
  }

  verifyWebhook(mode, token, challenge) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'villa_booking_verify_2025';

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }

    return null;
  }
}

module.exports = { WhatsAppService };

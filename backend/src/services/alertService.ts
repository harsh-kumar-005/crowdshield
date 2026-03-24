// SMS Alert Service — uses Twilio if configured, otherwise logs to console
// Set TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_FROM in .env

interface AlertPayload {
  risk_score: number;
  total_crowd: number;
  venue_capacity: number;
}

class AlertService {
  private twilioClient: any = null;
  private fromNumber: string = '';

  constructor() {
    this.initTwilio();
  }

  private initTwilio() {
    const sid = process.env.TWILIO_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_FROM || '';

    if (sid && token && this.fromNumber) {
      try {
        // Dynamic import — only loads if Twilio is configured
        const twilio = require('twilio');
        this.twilioClient = twilio(sid, token);
        console.log('✅ Twilio SMS service initialized');
      } catch {
        console.log('⚠️  Twilio package not installed. SMS alerts disabled. Run: npm install twilio');
      }
    } else {
      console.log('ℹ️  Twilio not configured — SMS alerts will log to console only.');
      console.log('   Set TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_FROM in .env to enable.');
    }
  }

  async sendAlert(to: string, payload: AlertPayload): Promise<boolean> {
    const densityPct = Math.round((payload.total_crowd / payload.venue_capacity) * 100);
    const message = 
      `🚨 CrowdShield CRITICAL ALERT\n` +
      `Risk Score: ${payload.risk_score}/100\n` +
      `Crowd: ${payload.total_crowd.toLocaleString()} / ${payload.venue_capacity.toLocaleString()} (${densityPct}%)\n` +
      `Action Required Immediately`;

    if (this.twilioClient && this.fromNumber) {
      try {
        await this.twilioClient.messages.create({
          body: message,
          from: this.fromNumber,
          to,
        });
        console.log(`📱 SMS alert sent to ${to}`);
        return true;
      } catch (e: any) {
        console.error(`SMS send failed:`, e.message);
        return false;
      }
    } else {
      // Fallback: log to console (still useful for demo)
      console.log(`\n${'═'.repeat(50)}`);
      console.log(`📱 SMS ALERT (console mode — Twilio not configured)`);
      console.log(`   To: ${to || 'No phone configured'}`);
      console.log(`   ${message.replace(/\n/g, '\n   ')}`);
      console.log(`${'═'.repeat(50)}\n`);
      return true;
    }
  }
}

export const alertService = new AlertService();

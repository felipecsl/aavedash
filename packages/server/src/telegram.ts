export class TelegramClient {
  private readonly botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  async sendMessage(chatId: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`Telegram API error (${response.status}): ${body}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Telegram send failed:', error);
      return false;
    }
  }
}

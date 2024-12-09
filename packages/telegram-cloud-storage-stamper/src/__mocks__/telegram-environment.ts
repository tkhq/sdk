import JSDOMEnvironment from "jest-environment-jsdom";

class TelegramEnvironment extends JSDOMEnvironment {
  override async setup() {
    await super.setup();

    this.global.window.Telegram = {
      WebApp: {
        CloudStorage: {},
      },
    };
  }

  override async teardown() {
    await super.teardown();
  }
}

export default TelegramEnvironment;

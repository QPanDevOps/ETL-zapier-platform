const { Command } = require('@oclif/command');

const { startSpinner, endSpinner } = require('../utils/display');

const inquirer = require('inquirer');

class ZapierBaseCommand extends Command {
  run() {
    this.parseFlags();
    return this.perform();
  }

  parseFlags() {
    // normally this is called via `this.parse(SomeCommand)`, but that's error-prone and I got tired of typing it
    // .constructor is the static class
    const { flags, args } = this.parse(Object.getPrototypeOf(this).constructor);

    this.flags = flags;
    this.args = args;
  }

  perform() {
    throw new Error('subclass me');
  }

  // UTILS
  log(...message) {
    if (!['json', 'raw'].includes(this.flags.format)) {
      super.log(...message);
    }
  }

  async confirm(message, defaultAns = false) {
    const { ans } = await inquirer.prompt({
      type: 'confirm',
      message,
      default: defaultAns,
      name: 'ans'
    });
    return ans;
  }

  startSpinner(message) {
    startSpinner(message);
  }

  stopSpinner({ success = true, message = undefined } = {}) {
    endSpinner(success, message);
  }
}

module.exports = ZapierBaseCommand;

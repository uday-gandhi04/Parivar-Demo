import chalk from 'chalk';

export const log = {
  info: (msg) => console.log(chalk.blue('i'), msg),
  ok: (msg) => console.log(chalk.green('+'), msg),
  warn: (msg) => console.log(chalk.yellow('!'), msg),
  err: (msg) => console.log(chalk.red('x'), msg),
  hr: () => console.log(chalk.gray('-'.repeat(60))),
  title: (msg) => console.log('\n' + chalk.bold.cyan(msg)),
  dim: (msg) => console.log(chalk.gray(msg)),
};

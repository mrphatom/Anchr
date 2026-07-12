#!/usr/bin/env node
import { Command } from 'commander';
import { runInit } from '../lib/init.js';
import { runDeploy } from '../lib/deploy.js';

const program = new Command();

program
  .name('anchr')
  .description('Deploy static frontends to IPFS and resolve via .sol domains')
  .version('0.1.0');

program
  .command('init')
  .description('Detect your project and create an anchr.json config')
  .action(async () => {
    try {
      await runInit();
    } catch (err) {
      console.error(`\n❌ ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('deploy')
  .description('Build, pin to IPFS via Storacha, and update your SNS record')
  .action(async () => {
    try {
      await runDeploy();
    } catch (err) {
      console.error(`\n❌ ${err.message}`);
      process.exit(1);
    }
  });

program.parse();

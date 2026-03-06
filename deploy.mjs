/**
 * Deploy script - copies built files to Obsidian vaults
 * 
 * Usage:
 *   node deploy.mjs test        - Deploy to TEST vault (safe, for development)
 *   node deploy.mjs staging     - Deploy to STAGING vault (real files)
 *   node deploy.mjs production  - Deploy to PRODUCTION vault (requires confirmation)
 */

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

// Plugin directory paths (where main.js, manifest.json, styles.css go)
const VAULTS = {
    test: 'C:\\Quest-Board-Test-Vault\\.obsidian\\plugins\\hindsight-journal',
    staging: 'C:\\Quest-Board-Staging-Vault\\Staging Vault\\.obsidian\\plugins\\hindsight-journal',
    production: 'G:\\My Drive\\IT\\Obsidian Vault\\My Notebooks\\.obsidian\\plugins\\hindsight-journal'
};

// Core plugin files to copy (all targets)
const FILES_TO_COPY = [
    'main.js',
    'manifest.json',
    'styles.css'
];

// Get target from command line
const target = process.argv[2];

if (!target || !VAULTS[target]) {
    console.error('❌ Invalid deploy target!');
    console.error('');
    console.error('Usage:');
    console.error('  npm run deploy:test        - Deploy to TEST vault (safe)');
    console.error('  npm run deploy:staging     - Deploy to STAGING vault (real files)');
    console.error('  npm run deploy:production  - Deploy to PRODUCTION vault (dangerous!)');
    console.error('');
    process.exit(1);
}

const targetPath = VAULTS[target];

/**
 * Prompt user for confirmation (production only)
 */
async function confirmProduction() {
    if (target !== 'production') {
        return true;
    }

    console.log('');
    console.log('⚠️  ========================================');
    console.log('⚠️  PRODUCTION DEPLOY');
    console.log('⚠️  ========================================');
    console.log('');
    console.log(`Target: ${targetPath}`);
    console.log('');
    console.log('This will overwrite your REAL Obsidian vault!');
    console.log('');

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question('Type "yes" to continue: ', (answer) => {
            rl.close();
            if (answer.toLowerCase() === 'yes') {
                resolve(true);
            } else {
                console.log('');
                console.log('❌ Deploy cancelled.');
                resolve(false);
            }
        });
    });
}

/**
 * Deploy files to target vault
 */
async function deploy() {
    const confirmed = await confirmProduction();
    if (!confirmed) {
        process.exit(0);
    }

    // Ensure the destination directory exists
    if (!existsSync(targetPath)) {
        console.log(`Creating directory: ${targetPath}`);
        mkdirSync(targetPath, { recursive: true });
    }

    // Copy core plugin files
    const labels = {
        test: '🧪 TEST',
        staging: '📦 STAGING',
        production: '🚀 PRODUCTION'
    };
    const label = labels[target] || '🧪 TEST';
    console.log(`\nDeploying to ${label} vault...`);

    console.log('\n  Plugin files:');
    for (const file of FILES_TO_COPY) {
        const src = join(process.cwd(), file);
        const dest = join(targetPath, file);

        try {
            copyFileSync(src, dest);
            console.log(`    ✓ ${file}`);
        } catch (error) {
            console.error(`    ✗ Failed to copy ${file}:`, error.message);
            process.exit(1);
        }
    }

    console.log('');
    console.log('✅ Deployment complete!');
    console.log(`   Target: ${label}`);
    console.log(`   Plugin: ${targetPath}`);
    console.log('   Reload Obsidian to see changes.');
}

deploy();

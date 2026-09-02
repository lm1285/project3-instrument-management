
const path = require('path');

// This script is intended to be run from backend/scripts/
// It loads the compiled dbConfig and initializes the database (creating tables if missing)

// The compiled dbConfig should be in ../dist/config/dbConfig.js
const dbConfigPath = path.join(__dirname, '../dist/config/dbConfig.js');

console.log(`Loading dbConfig from ${dbConfigPath}...`);

try {
    const module = require(dbConfigPath);
    const dbConfig = module.default || module;

    if (!dbConfig || typeof dbConfig.init !== 'function') {
        console.error('Invalid dbConfig module loaded:', dbConfig);
        process.exit(1);
    }

    console.log('Initializing database schema...');
    dbConfig.init().then(() => {
        console.log('Database schema initialized successfully.');
        process.exit(0);
    }).catch(err => {
        console.error('Database initialization failed:', err);
        process.exit(1);
    });

} catch (err) {
    console.error('Failed to load dbConfig. Ensure the project is built (dist exists).', err);
    process.exit(1);
}

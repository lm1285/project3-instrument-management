
import dbConfig from '../src/config/dbConfig';

async function verify() {
    try {
        console.log('Starting SQLite verification...');
        await dbConfig.init();
        
        const db = dbConfig.getConnection();
        
        // Check a few tables
        const tables = ['instruments', 'flow_records', 'reservations', 'system_settings', 'site_messages'];
        
        for (const table of tables) {
            const count = await db.get(`SELECT count(*) as count FROM ${table}`);
            console.log(`Table ${table} exists. Row count: ${count.count}`);
        }
        
        console.log('Verification successful!');
        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verify();

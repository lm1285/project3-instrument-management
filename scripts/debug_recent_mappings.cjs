const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../backend/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, source_name, standard_instrument_id, updated_at FROM instrument_mappings ORDER BY updated_at DESC LIMIT 5", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(JSON.stringify(rows, null, 2));
    
    // Also check if any standard_instrument_id refers to a non-existent standard
    rows.forEach(row => {
        db.get("SELECT id, name, department FROM standard_instruments WHERE id = ?", [row.standard_instrument_id], (err, std) => {
            if (err) console.error(err);
            console.log(`Mapping ${row.source_name} -> Standard: ${std ? std.name + ' (' + std.department + ')' : 'NOT FOUND'}`);
        });
    });
});

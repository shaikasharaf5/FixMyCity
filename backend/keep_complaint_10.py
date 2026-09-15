"""One-off, user-approved cleanup. Retains CS-0010 and backs up the database."""
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

if __name__ == '__main__':
    database = Path(__file__).resolve().parent / 'civicsense.db'
    if not database.is_file():
        raise RuntimeError('Expected project database not found')
    with sqlite3.connect(database) as connection:
        ids = [row[0] for row in connection.execute('SELECT id FROM complaints ORDER BY id')]
        if ids != list(range(1, 11)):
            raise RuntimeError(f'Data changed; stop for review. Complaint IDs: {ids}')
        backup_dir = database.parent / 'backups'
        backup_dir.mkdir(exist_ok=True)
        backup = backup_dir / ('before-keep-CS0010-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite3')
        with sqlite3.connect(backup) as destination:
            connection.backup(destination)
        connection.execute('BEGIN IMMEDIATE')
        if [row[0] for row in connection.execute('SELECT id FROM complaints ORDER BY id')] != ids:
            raise RuntimeError('Complaints changed since backup; no deletion performed')
        connection.execute('UPDATE complaints SET duplicate_of_id=NULL WHERE duplicate_of_id BETWEEN 1 AND 9')
        connection.execute('UPDATE twilio_inbound_events SET complaint_id=NULL WHERE complaint_id BETWEEN 1 AND 9')
        connection.execute('DELETE FROM complaints WHERE id BETWEEN 1 AND 9')
        assert connection.execute('SELECT id FROM complaints').fetchall() == [(10,)]
        connection.commit()
        print('Retained CS-0010. Removed CS-0001 through CS-0009. Uploads and audit history retained.')
        print('Recovery backup:', backup)
